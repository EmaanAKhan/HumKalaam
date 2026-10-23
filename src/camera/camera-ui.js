// The "Sign to text and voice" panel: camera -> landmarks -> recogniser ->
// transcript -> speech, plus teach mode and a live view of what the camera sees.

import { CameraTracker } from './camera-tracker.js';
import { cameraFeatures, isActive } from './features.js';
import { SignRecognizer } from './recognizer.js';
import { allTemplates } from './templates.js';
import { CORE_WORDS, coreTemplates } from './core-words.js';
import { SampleRecorder, SampleStore, compact } from './teach.js';
import { Speaker } from '../voice/speak.js';
import { findSign, vocabulary } from '../text-to-sign/lexicon.js';

const display = (word) => word.toLowerCase();
const SAMPLES_WANTED = 3;

export function initCameraPanel({ getDominant }) {
	const $ = (id) => document.getElementById(id);
	const els = {
		btn: $('btn-cam'),
		say: $('btn-say'),
		clear: $('btn-clear-cam'),
		video: $('cam-video'),
		overlay: $('cam-overlay'),
		status: $('cam-status'),
		speak: $('cam-speak'),
		current: $('cam-current'),
		text: $('cam-text'),
		suggest: $('cam-suggest'),
		teachWord: $('teach-word'),
		teachWords: $('teach-words'),
		record: $('btn-record'),
		teachStatus: $('teach-status'),
		teachList: $('teach-list'),
		exportBtn: $('btn-teach-export'),
		importInput: $('teach-import'),
		debug: $('cam-debug'),
		core: $('cam-core'),
		coreList: $('cam-core-list'),
	};

	const speaker = new Speaker();
	const store = new SampleStore();
	let samples = [];
	const sentences = []; // finished sentences
	let words = []; // words of the sentence in progress
	let spelling = ''; // letters of the word being fingerspelled

	// ── transcript ───────────────────────────────────────────────────────────
	const render = () => {
		els.text.replaceChildren();
		const done = [...sentences, words.join(' ')].filter(Boolean).join('. ');
		els.text.append(document.createTextNode(done));
		if (spelling) {
			const span = document.createElement('span');
			span.className = 'pending';
			span.textContent = `${done ? ' ' : ''}${spelling}…`;
			els.text.append(span);
		}
		els.say.disabled = !speaker.supported || !(sentences.length || words.length);
	};

	const suggest = (candidates, frames) => {
		els.suggest.replaceChildren();
		if (!candidates?.length) {
			els.suggest.hidden = true;
			return;
		}
		els.suggest.append('Not sure. Did you sign:');
		for (const c of candidates.slice(0, 3)) {
			const b = document.createElement('button');
			b.type = 'button';
			b.textContent = display(c.word);
			b.addEventListener('click', async () => {
				words.push(display(c.word));
				els.suggest.hidden = true;
				render();
				// Learn from the correction: this movement becomes an example of the word.
				if (frames?.length) {
					await store.add(c.word, frames.map(compact), recognizer?.dominant ?? 'Right');
					await refreshSamples(`Learned: that movement is now an example of “${display(c.word)}”.`);
				}
			});
			els.suggest.append(b);
		}
		els.suggest.hidden = false;
	};

	const onEvent = (e) => {
		if (e.type === 'letter') {
			spelling += e.text;
			els.current.textContent = e.text;
		} else if (e.type === 'spelled') {
			spelling = '';
			words.push(display(e.text));
			els.current.textContent = display(e.text);
		} else if (e.type === 'word') {
			words.push(display(e.text));
			els.current.textContent = display(e.text);
			els.suggest.hidden = true;
		} else if (e.type === 'unknown') {
			els.current.textContent = '?';
			suggest(e.detail?.candidates, e.detail?.frames);
		} else if (e.type === 'sentence') {
			const sentence = words.join(' ');
			words = [];
			if (sentence) {
				sentences.push(sentence);
				if (els.speak.checked) speaker.say(sentence);
			}
			els.current.textContent = '';
		}
		render();
	};

	// ── teach mode ─────────────────────────────────────────────────────────────
	let recorder = null;
	let recordWord = '';

	const renderTaught = () => {
		const counts = new Map();
		for (const s of samples) counts.set(s.word, (counts.get(s.word) ?? 0) + 1);
		els.teachList.replaceChildren();
		for (const [word, n] of [...counts].sort()) {
			const li = document.createElement('li');
			li.className = n < SAMPLES_WANTED ? 'few' : '';
			li.title = n < SAMPLES_WANTED ? `Record ${SAMPLES_WANTED - n} more for reliable recognition` : '';
			li.append(`${display(word)} ×${n}`);
			const undo = document.createElement('button');
			undo.type = 'button';
			undo.textContent = 'Undo last';
			undo.addEventListener('click', async () => {
				await store.removeLast(word);
				await refreshSamples(`Removed the last recording of “${display(word)}”.`);
			});
			const del = document.createElement('button');
			del.type = 'button';
			del.textContent = 'Forget';
			del.addEventListener('click', async () => {
				await store.removeWord(word);
				await refreshSamples(`Forgot “${display(word)}”.`);
			});
			li.append(undo, del);
			els.teachList.append(li);
		}
		els.exportBtn.disabled = !samples.length;
	};

	async function refreshSamples(message) {
		samples = await store.all();
		recognizer?.setTaught(samples);
		renderTaught();
		if (message) setTeachStatus(message);
	}

	const setTeachStatus = (text) => {
		els.teachStatus.textContent = text;
	};

	const startRecording = () => {
		const word = els.teachWord.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
		if (!word) {
			setTeachStatus('Type the word you are going to sign first.');
			els.teachWord.focus();
			return;
		}
		recordWord = word;
		recorder = new SampleRecorder();
		els.record.textContent = 'Cancel';
		els.record.classList.add('recording');
		setTeachStatus(`Lower your hands, then sign “${display(word)}” once and lower them again.`);
	};

	const stopRecording = (message) => {
		recorder = null;
		els.record.textContent = 'Record';
		els.record.classList.remove('recording');
		if (message) setTeachStatus(message);
	};

	const recordFrame = async (f, t) => {
		const state = recorder.push(f, t);
		if (state === 'lower') setTeachStatus(`Lower your hands first, then sign “${display(recordWord)}”.`);
		else if (state === 'waiting') setTeachStatus(`Ready: sign “${display(recordWord)}” now.`);
		else if (state === 'recording') setTeachStatus(`Recording “${display(recordWord)}”… lower your hands when done.`);
		else if (state === 'done') {
			const frames = recorder.result();
			const word = recordWord;
			stopRecording();
			if (!frames) {
				setTeachStatus('That was too short to be a sign. Try again, a little slower.');
				return;
			}
			await store.add(word, frames, recognizer?.dominant ?? 'Right');
			const n = samples.filter((s) => s.word === word).length + 1;
			await refreshSamples(
				n < SAMPLES_WANTED
					? `Saved recording ${n} of “${display(word)}”. Record it ${SAMPLES_WANTED - n} more time${SAMPLES_WANTED - n > 1 ? 's' : ''}.`
					: `Saved recording ${n} of “${display(word)}”. It will now be recognised.`,
			);
		}
	};

	// ── live debug view ──────────────────────────────────────────────────────────
	const dbg = Object.fromEntries([...els.debug.querySelectorAll('dd')].map((d) => [d.dataset.k, d]));
	const setDbg = (k, text, cls = '') => {
		dbg[k].textContent = text;
		dbg[k].className = cls;
	};
	const describeHand = (h) => {
		if (!h) return ['not seen', 'no'];
		const where = isActive(h) ? 'raised' : 'down';
		return [h.fromPose ? `${where} (wrist only, fingers not seen)` : `${where}, fingers tracked`, 'yes'];
	};
	let lastDebug = 0;
	const updateDebug = (f, obs, t) => {
		if (t - lastDebug < 120) return; // about 8 times a second is plenty to read
		lastDebug = t;
		setDbg('body', f ? 'shoulders in view' : obs.pose ? 'shoulders not clear' : 'no person found', f ? 'yes' : 'no');
		const dom = recognizer.dominant;
		const right = dom === 'Right' ? f?.dom : f?.other;
		const left = dom === 'Right' ? f?.other : f?.dom;
		setDbg('right', ...describeHand(right));
		setDbg('left', ...describeHand(left));
		const st = recognizer.debugState();
		const state = recorder ? 'recording a teach sample' : st.spelling ? `fingerspelling: ${st.spelling}` : !st.moving ? 'hands resting' : st.still ? `holding still (${st.frames} frames)` : `moving (${st.frames} frames, path ${st.path.toFixed(2)})`;
		setDbg('state', state);
		setDbg('mode', st.mode);
		const last = st.last;
		setDbg('last', last ? `${last.word ? display(last.word) : 'not sure'} · closest: ${last.candidates.map((c) => `${display(c.word)} ${c.distance.toFixed(2)}`).join(', ')}` : '–');
	};

	// ── camera ─────────────────────────────────────────────────────────────────
	let recognizer = null;
	let bodyState = {}; // the signer's arm length, learned while the camera runs
	const tracker = new CameraTracker({
		video: els.video,
		overlay: els.overlay,
		onState: (state, message) => {
			const on = state === 'running' || state === 'starting' || state === 'loading';
			els.status.textContent = state === 'running' ? '' : message ?? '';
			els.btn.textContent = on ? 'Stop camera' : 'Start camera';
			els.record.disabled = state !== 'running';
			if (state !== 'running' && recorder) stopRecording('Recording stopped: the camera is off.');
			if (state !== 'running' && !recorder) setTeachStatus(state === 'stopped' ? 'Start the camera to record.' : els.teachStatus.textContent);
			if (state === 'running') setTeachStatus('Type a word and press Record.');
		},
		onFrame: (obs, t, size) => {
			if (!recognizer) return;
			const f = cameraFeatures(obs, { ...size, dominant: recognizer.dominant, state: bodyState });
			if (recorder) recordFrame(f, t);
			else recognizer.push(f, t);
			updateDebug(f, obs, t);
		},
	});

	els.btn.addEventListener('click', async () => {
		if (tracker.running || tracker.stream) {
			tracker.stop();
			return;
		}
		const dominant = getDominant();
		els.status.textContent = 'Preparing the sign references…';
		// Let the message paint before the (synchronous) template build.
		await new Promise((r) => setTimeout(r, 30));
		// The 20 core words by default (far more accurate); every sign when unticked.
		const templates = els.core?.checked === false ? allTemplates(dominant) : coreTemplates(dominant);
		recognizer = new SignRecognizer({ dominant, templates, taught: samples, onEvent });
		bodyState = {};
		await tracker.start();
	});
	els.record.addEventListener('click', () => (recorder ? stopRecording('Recording cancelled.') : startRecording()));
	els.teachWord.addEventListener('keydown', (e) => {
		if (e.key === 'Enter' && !els.record.disabled) {
			e.preventDefault();
			if (!recorder) startRecording();
		}
	});
	els.exportBtn.addEventListener('click', async () => {
		const blob = new Blob([await store.exportJson()], { type: 'application/json' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = 'hum-kalaam-signs.json';
		a.click();
		URL.revokeObjectURL(a.href);
	});
	els.importInput.addEventListener('change', async () => {
		const file = els.importInput.files?.[0];
		if (!file) return;
		try {
			const n = await store.importJson(await file.text());
			await refreshSamples(`Loaded ${n} recordings.`);
		} catch (err) {
			setTeachStatus(err.message);
		}
		els.importInput.value = '';
	});
	els.say.addEventListener('click', () => speaker.say([...sentences, words.join(' ')].filter(Boolean).join('. ')));
	els.clear.addEventListener('click', () => {
		sentences.length = 0;
		words = [];
		spelling = '';
		recognizer?.reset();
		els.current.textContent = '';
		els.suggest.hidden = true;
		render();
	});

	// Load the trackers as soon as the camera tab is opened, so Start camera is quick.
	const preload = () => tracker.preload().catch((err) => console.warn('[hum-kalaam] tracker preload failed', err));
	window.addEventListener('hk:tab', (e) => e.detail === 'to-text' && preload());
	if (location.hash === '#to-text') preload();

	// Show the words the camera knows without teaching.
	if (els.coreList) {
		els.coreList.replaceChildren(...CORE_WORDS.map((w) => Object.assign(document.createElement('span'), { textContent: display(w) })));
	}

	// Suggest the vocabulary's words while typing a word to teach.
	for (const w of vocabulary()) {
		if (findSign(w)?.name !== w) continue; // sign names only, not every spelling
		els.teachWords.append(new Option(display(w)));
	}

	if (!CameraTracker.supported) {
		els.btn.disabled = true;
		els.status.textContent = 'This browser cannot open a camera.';
	}
	render();
	refreshSamples();
	return { tracker, speaker, store, get recognizer() { return recognizer; }, onEvent };
}
