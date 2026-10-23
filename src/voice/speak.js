// Text to speech with the browser's built-in voices (speechSynthesis). English
// only for now: the first available English voice for the chosen accent is
// used, falling back to any English voice, then to the browser default.

export class Speaker {
	constructor({ synth = globalThis.speechSynthesis ?? null, Utterance = globalThis.SpeechSynthesisUtterance ?? null } = {}) {
		this.synth = synth;
		this.Utterance = Utterance;
		this.lang = 'en-US';
		this.rate = 1;
	}

	get supported() {
		return Boolean(this.synth && this.Utterance);
	}

	/** The best English voice for this.lang, or null to use the default. */
	voice() {
		const voices = this.synth?.getVoices?.() ?? [];
		const exact = voices.find((v) => v.lang?.toLowerCase() === this.lang.toLowerCase());
		return exact ?? voices.find((v) => v.lang?.toLowerCase().startsWith('en')) ?? null;
	}

	/** Speak `text`. Resolves when it has been spoken (or immediately if unsupported). */
	say(text) {
		const clean = String(text ?? '').trim();
		if (!clean || !this.supported) return Promise.resolve(false);
		return new Promise((resolve) => {
			const u = new this.Utterance(clean);
			u.lang = this.lang;
			u.rate = this.rate;
			const v = this.voice();
			if (v) u.voice = v;
			u.onend = () => resolve(true);
			u.onerror = () => resolve(false);
			this.synth.speak(u);
		});
	}

	cancel() {
		this.synth?.cancel?.();
	}
}
