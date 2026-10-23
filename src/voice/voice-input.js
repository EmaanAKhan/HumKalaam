// Speech to text for Hum Kalaam: the microphone half of "say it, see it signed".
//
// Recognition uses the browser's Web Speech API (SpeechRecognition), which Chrome,
// Edge and Safari provide. No model is downloaded and nothing is installed. Be
// aware that Chrome and Edge send the audio to their vendor's speech service to
// transcribe it; Safari can recognise on the device. Firefox has no
// SpeechRecognition, so the feature reports itself as unsupported there.
//
// Handling real-world sound:
//   - The microphone is opened with echo cancellation, noise suppression and
//     automatic gain control, and a live level meter shows whether the user is
//     being heard (too quiet / good / very loud).
//   - Results arrive as interim (still changing) and final text. Each final
//     sentence is emitted once, with the most confident of up to 3 alternatives.
//   - Long or silent sessions end on their own in most browsers; while the user
//     still wants to listen, recognition restarts automatically, with a limit so
//     a broken microphone cannot loop forever.
//   - "No speech heard" is a hint, not a failure; permission, missing
//     microphone, network and unsupported-language errors stop with a clear
//     message.
//
// Every browser dependency is injectable, so the logic is tested in Node with
// fakes (tests/voice-input.test.mjs).

export const LANGUAGES = Object.freeze([
	{ code: 'en-US', label: 'English (US)' },
	{ code: 'en-GB', label: 'English (UK)' },
	{ code: 'en-IN', label: 'English (India)' },
	{ code: 'en-PK', label: 'English (Pakistan)' },
]);

const FATAL = {
	'not-allowed': 'Microphone permission was denied. Allow the microphone for this site in the browser settings, then try again.',
	'service-not-allowed': 'The browser blocked speech recognition for this page. Check the site permissions, then try again.',
	'audio-capture': 'No microphone was found, or it is being used by another app.',
	network: 'Speech recognition needs an internet connection in this browser, and the connection failed.',
	'language-not-supported': 'This browser cannot recognise the selected English variant. Choose another one.',
	'bad-grammar': 'Speech recognition failed to start.',
};

// Restart limits for sessions the browser ends on its own.
const MAX_QUICK_RESTARTS = 5;
const QUICK_WINDOW_MS = 10_000;

// Level meter: dBFS mapped to 0..1, and the "too quiet" threshold.
const FLOOR_DB = -60;
const QUIET_LEVEL = 0.35; // about -39 dBFS: above room noise, below normal speech
const QUIET_HINT_MS = 6000;

/**
 * Pick the alternative with the highest confidence. Browsers report 0 when
 * they do not know, so 0 never beats the first (best-ranked) alternative.
 * @param {ArrayLike<{transcript: string, confidence: number}>} result
 */
export function bestAlternative(result) {
	let best = result[0];
	for (let i = 1; i < result.length; i++) {
		if ((result[i].confidence ?? 0) > (best.confidence ?? 0)) best = result[i];
	}
	return { text: String(best.transcript ?? '').trim(), confidence: best.confidence ?? 0 };
}

/** RMS of a time-domain byte buffer (128 = silence) as a 0..1 level. */
export function levelFromSamples(bytes) {
	let sum = 0;
	for (let i = 0; i < bytes.length; i++) {
		const v = (bytes[i] - 128) / 128;
		sum += v * v;
	}
	const rms = Math.sqrt(sum / Math.max(1, bytes.length));
	if (rms <= 0) return 0;
	const db = 20 * Math.log10(rms);
	return Math.min(1, Math.max(0, (db - FLOOR_DB) / -FLOOR_DB));
}

export class VoiceInput {
	/**
	 * @param {{
	 *   lang?: string,
	 *   onInterim?: (text: string) => void,
	 *   onFinal?: (r: { text: string, confidence: number }) => void,
	 *   onState?: (state: 'idle'|'starting'|'listening'|'stopping', hint?: string|null) => void,
	 *   onLevel?: (level: number) => void,
	 *   onError?: (message: string, code: string) => void,
	 *   Recognition?: any, mediaDevices?: any, AudioContextCtor?: any, now?: () => number,
	 *   setInterval?: typeof setInterval, clearInterval?: typeof clearInterval,
	 * }} [opts]
	 */
	constructor(opts = {}) {
		const g = globalThis;
		this.Recognition = opts.Recognition ?? g.SpeechRecognition ?? g.webkitSpeechRecognition ?? null;
		this.mediaDevices = opts.mediaDevices ?? g.navigator?.mediaDevices ?? null;
		this.AudioContextCtor = opts.AudioContextCtor ?? g.AudioContext ?? g.webkitAudioContext ?? null;
		this.now = opts.now ?? (() => Date.now());
		this._setInterval = opts.setInterval ?? g.setInterval.bind(g);
		this._clearInterval = opts.clearInterval ?? g.clearInterval.bind(g);
		this.lang = opts.lang ?? 'en-US';
		this.onInterim = opts.onInterim ?? (() => {});
		this.onFinal = opts.onFinal ?? (() => {});
		this.onState = opts.onState ?? (() => {});
		this.onLevel = opts.onLevel ?? (() => {});
		this.onError = opts.onError ?? (() => {});

		this.state = 'idle';
		this.wanted = false;
		this.rec = null;
		this._restarts = [];
		this._stream = null;
		this._ctx = null;
		this._meter = 0;
		this._quietSince = null;
		this._lastHeard = 0;
	}

	get supported() {
		return Boolean(this.Recognition);
	}

	_setState(state, hint = null) {
		this.state = state;
		this.onState(state, hint);
	}

	/** Open the microphone and start listening. Resolves once listening (or failed). */
	async start() {
		if (!this.supported) {
			this.onError('Voice input is not available in this browser. Use Chrome, Edge or Safari.', 'unsupported');
			return false;
		}
		if (this.wanted) return true;
		this.wanted = true;
		this._restarts = [];
		this._setState('starting');

		// Ask for the microphone ourselves first: it triggers one clear permission
		// prompt, applies noise suppression / echo cancellation / gain control to
		// the stream, and feeds the level meter.
		if (this.mediaDevices?.getUserMedia) {
			try {
				this._stream = await this.mediaDevices.getUserMedia({
					audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
				});
				this._startMeter();
			} catch (err) {
				const code = err?.name === 'NotAllowedError' || err?.name === 'SecurityError' ? 'not-allowed' : 'audio-capture';
				this._fail(code);
				return false;
			}
		}
		if (!this.wanted) {
			this._teardown();
			return false;
		}
		this._lastHeard = this.now();
		this._startRecognition();
		return this.wanted;
	}

	/** Stop listening. Text already spoken is still delivered as final. */
	stop() {
		if (!this.wanted && this.state === 'idle') return;
		this.wanted = false;
		if (this.rec) {
			this._setState('stopping');
			try {
				this.rec.stop();
			} catch {
				this._finish();
			}
		} else {
			this._finish();
		}
	}

	setLanguage(code) {
		this.lang = code;
		if (this.rec) {
			// Restart on the new language; onend sees `wanted` and restarts.
			try {
				this.rec.abort();
			} catch {
				/* already ended */
			}
		}
	}

	_startRecognition() {
		const rec = new this.Recognition();
		rec.lang = this.lang;
		rec.continuous = true;
		rec.interimResults = true;
		rec.maxAlternatives = 3;
		rec.onstart = () => this._setState('listening');
		rec.onresult = (event) => this._onResult(event);
		rec.onerror = (event) => this._onError(event?.error ?? 'unknown');
		rec.onend = () => this._onEnd(rec);
		this.rec = rec;
		try {
			rec.start();
		} catch (err) {
			// InvalidStateError: a previous instance is still shutting down.
			this.rec = null;
			this._fail('bad-grammar', err?.message);
		}
	}

	_onResult(event) {
		let interim = '';
		for (let i = event.resultIndex ?? 0; i < event.results.length; i++) {
			const result = event.results[i];
			if (result.isFinal) {
				const best = bestAlternative(result);
				if (best.text) this.onFinal(best);
			} else {
				interim += `${result[0]?.transcript ?? ''}`;
			}
		}
		this._lastHeard = this.now();
		this._quietSince = null;
		this.onInterim(interim.trim());
	}

	_onError(code) {
		if (code === 'aborted') return; // our own abort (language change / stop)
		if (code === 'no-speech') {
			this._setState(this.state, 'I can’t hear any speech. Move closer to the microphone or speak louder.');
			return; // onend follows and the session restarts
		}
		this._fail(code);
	}

	_onEnd(rec) {
		if (rec !== this.rec) return;
		this.rec = null;
		this.onInterim('');
		if (!this.wanted) {
			this._finish();
			return;
		}
		// The browser ended the session (silence, time limit, language change).
		const t = this.now();
		this._restarts = this._restarts.filter((x) => t - x < QUICK_WINDOW_MS);
		this._restarts.push(t);
		if (this._restarts.length > MAX_QUICK_RESTARTS) {
			this._fail('restart-loop');
			return;
		}
		this._startRecognition();
	}

	_fail(code, detail) {
		const message =
			FATAL[code] ??
			(code === 'restart-loop'
				? 'Speech recognition keeps stopping. Check the microphone and try again.'
				: `Speech recognition stopped (${detail || code}).`);
		this.wanted = false;
		if (this.rec) {
			const rec = this.rec;
			this.rec = null;
			try {
				rec.abort();
			} catch {
				/* already ended */
			}
		}
		this._finish();
		this.onError(message, code);
	}

	_finish() {
		this._teardown();
		this._setState('idle');
	}

	_startMeter() {
		if (!this.AudioContextCtor || !this._stream) return;
		try {
			const ctx = new this.AudioContextCtor();
			const source = ctx.createMediaStreamSource(this._stream);
			const analyser = ctx.createAnalyser();
			analyser.fftSize = 1024;
			source.connect(analyser);
			const buf = new Uint8Array(analyser.fftSize);
			this._ctx = ctx;
			this._meter = this._setInterval(() => {
				analyser.getByteTimeDomainData(buf);
				const level = levelFromSamples(buf);
				this.onLevel(level);
				this._quietCheck(level);
			}, 60);
		} catch {
			// The meter is a convenience; recognition works without it.
		}
	}

	_quietCheck(level) {
		if (this.state !== 'listening') return;
		const t = this.now();
		if (level >= QUIET_LEVEL) {
			this._quietSince = null;
			return;
		}
		if (this._quietSince == null) this._quietSince = t;
		if (t - this._quietSince > QUIET_HINT_MS && t - this._lastHeard > QUIET_HINT_MS) {
			this._quietSince = t; // repeat at most every QUIET_HINT_MS
			this._setState('listening', 'Listening, but it is very quiet. Speak closer to the microphone.');
		}
	}

	_teardown() {
		if (this._meter) this._clearInterval(this._meter);
		this._meter = 0;
		this.onLevel(0);
		try {
			this._ctx?.close?.();
		} catch {
			/* ignore */
		}
		this._ctx = null;
		for (const track of this._stream?.getTracks?.() ?? []) track.stop();
		this._stream = null;
		this._quietSince = null;
	}
}
