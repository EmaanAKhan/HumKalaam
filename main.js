// Hum Kalaam, text-to-sign milestone.
// Pipeline: text (typed, or spoken: src/voice/voice-input.js)
//                -> normalize (src/text-to-sign/normalize.js)
//                -> sign lookup + clip (src/text-to-sign/plan.js)
//                -> retarget + playback (src/avatar/stage.js)

import { AvatarStage } from './src/avatar/stage.js';
import { planUtterance, vocabulary, glossFor } from './src/text-to-sign/plan.js';
import { allSigns, findSign } from './src/text-to-sign/lexicon.js';
import { LANGUAGES, VoiceInput } from './src/voice/voice-input.js';
import { SignQueue } from './src/voice/sign-queue.js';
import { initCameraPanel } from './src/camera/camera-ui.js';

const $ = (id) => document.getElementById(id);
const els = {
	form: $('sign-form'),
	text: $('text'),
	sign: $('btn-sign'),
	replay: $('btn-replay'),
	pause: $('btn-pause'),
	stop: $('btn-stop'),
	view: $('btn-view'),
	speed: $('speed'),
	hand: $('hand'),
	avatarButtons: [...document.querySelectorAll('[data-avatar]')],
	vocabFilter: $('vocab-filter'),
	message: $('message'),
	result: $('result'),
	stageMsg: $('stage-msg'),
	nowWord: $('now-word'),
	nowLetter: $('now-letter'),
	bar: $('progress-bar'),
	vocabCount: $('vocab-count'),
	vocabList: $('vocab-list'),
	mic: $('btn-mic'),
	micLabel: $('mic-label'),
	micLevel: $('mic-level'),
	voiceLang: $('voice-lang'),
	voiceAuto: $('voice-auto'),
	voiceStatus: $('voice-status'),
	voiceLive: $('voice-live'),
};

const stage = new AvatarStage($('stage'));
let ready = false;
let plan = null;
let signing = false; // a signText() call is between planning and playback

const LABEL = { signed: 'signed', spelled: 'fingerspelled', omitted: 'omitted', unsupported: 'not supported', cut: 'not performed' };

function setMessage(text, kind = 'error') {
	els.message.textContent = text || '';
	els.message.className = `message${kind === 'info' ? ' info' : ''}`;
}

function setControls() {
	const playing = stage.isPlaying();
	els.sign.disabled = !ready;
	els.replay.disabled = !ready || !plan?.ok;
	els.pause.disabled = !playing;
	els.stop.disabled = !playing;
	els.pause.textContent = stage._userPaused ? 'Resume' : 'Pause';
}

function renderResult(p) {
	els.result.replaceChildren();
	for (const [i, item] of p.items.entries()) {
		const li = document.createElement('li');
		li.dataset.index = String(i);
		const w = document.createElement('span');
		w.className = 'w';
		w.textContent = item.raw;
		const chip = document.createElement('span');
		chip.className = `chip ${item.kind}`;
		chip.textContent = LABEL[item.kind];
		const d = document.createElement('span');
		d.className = 'd';
		if (item.kind === 'signed') d.textContent = `Sign for ${item.word}: ${item.gloss}`;
		else if (item.kind === 'spelled') d.textContent = `No sign in the vocabulary. Spelled: ${item.word.split('').join('-')}`;
		else if (item.kind === 'omitted') d.textContent = `${item.reason[0].toUpperCase()}${item.reason.slice(1)}.`;
		else d.textContent = `Not performed: ${item.reason}.`;
		li.append(w, chip, d);
		els.result.append(li);
	}
}

async function signText() {
	if (!ready) return;
	signing = true;
	try {
		await signTextNow();
	} finally {
		signing = false;
	}
}

async function signTextNow() {
	const p = planUtterance(els.text.value, { dominant: els.hand.value, rate: Number(els.speed.value) });
	plan = p;
	renderResult(p);
	if (!p.ok) {
		stage.stop();
		setMessage(p.message);
		setControls();
		return;
	}
	const skipped = p.items.filter((i) => i.kind === 'unsupported' || i.kind === 'cut');
	setMessage(
		skipped.length
			? `${skipped.length} word(s) will not be performed: ${skipped.map((i) => `"${i.raw}"`).join(', ')}. See the list below.`
			: '',
	);
	try {
		await stage.play(p.clip);
	} catch (err) {
		setMessage(err.message);
	}
	setControls();
}

function updateCaption() {
	const t = stage.currentTime();
	const playing = stage.isPlaying();
	const active = playing && plan?.ok ? plan.items.findIndex((i) => i.start != null && t >= i.start && t < i.end) : -1;
	for (const li of els.result.children) li.classList.toggle('active', Number(li.dataset.index) === active);
	const item = active >= 0 ? plan.items[active] : null;
	els.nowWord.textContent = item ? item.word : '';
	const letter = item?.letters?.find((l) => t >= l.start && t < l.end);
	els.nowLetter.textContent = letter ? letter.letter : '';
	els.bar.style.width = playing && stage.duration ? `${Math.min(100, (t / stage.duration) * 100)}%` : '0%';
	requestAnimationFrame(updateCaption);
}

async function loadAvatar(url) {
	ready = false;
	setControls();
	els.stageMsg.textContent = 'Loading avatar…';
	try {
		const { supported, bones } = await stage.load(url);
		if (!supported) {
			els.stageMsg.textContent = 'This avatar has no humanoid skeleton the signing engine can drive.';
			return;
		}
		els.stageMsg.textContent = '';
		console.info(`[hum-kalaam] avatar ready: ${bones} bones mapped to the signing skeleton`);
		ready = true;
	} catch (err) {
		console.error(err);
		els.stageMsg.textContent = `Could not load the avatar (${url}).`;
	}
	setControls();
}

els.form.addEventListener('submit', (e) => {
	e.preventDefault();
	signText();
});
els.text.addEventListener('keydown', (e) => {
	if (e.key === 'Enter' && !e.shiftKey) {
		e.preventDefault();
		signText();
	}
});
els.replay.addEventListener('click', async () => {
	await stage.replay();
	setControls();
});
els.pause.addEventListener('click', () => {
	stage.togglePause();
	setControls();
});
els.stop.addEventListener('click', () => {
	queue.clear();
	stage.stop();
	setControls();
});
els.view.addEventListener('click', () => stage.resetView());
// Speed and hand are baked into the compiled clip, so changing them recompiles.
for (const sel of [els.speed, els.hand]) sel.addEventListener('change', () => plan?.ok && signText());
for (const btn of els.avatarButtons) {
	btn.addEventListener('click', () => {
		if (btn.getAttribute('aria-pressed') === 'true') return;
		for (const b of els.avatarButtons) b.setAttribute('aria-pressed', String(b === btn));
		loadAvatar(btn.dataset.avatar);
	});
}
stage.onFinished = () => {
	setControls();
	queue.pump();
};

// ── Voice input ─────────────────────────────────────────────────────────────

const queue = new SignQueue({
	isBusy: () => !ready || signing || stage.isPlaying(),
	play: (text) => {
		els.text.value = text;
		signText();
	},
	onChange: (pending) => {
		if (pending.length && voice.state !== 'idle') setVoiceStatus(`Waiting to sign: “${pending.join(' ')}”`);
	},
});

function setVoiceStatus(text, kind = '') {
	els.voiceStatus.textContent = text;
	els.voiceStatus.className = `voice-status${kind ? ` ${kind}` : ''}`;
}

const voice = new VoiceInput({
	lang: 'en-US',
	onState: (state, hint) => {
		const on = state === 'starting' || state === 'listening';
		els.mic.setAttribute('aria-pressed', String(on));
		els.mic.classList.toggle('starting', state === 'starting');
		els.micLabel.textContent = on ? 'Stop' : state === 'stopping' ? 'Finishing…' : 'Speak';
		if (hint) setVoiceStatus(hint, 'warn');
		else if (state === 'starting') setVoiceStatus('Starting the microphone… allow access if the browser asks.');
		else if (state === 'listening') setVoiceStatus('Listening. Speak in English; pause briefly at the end of each sentence.');
		else if (state === 'idle') els.micLevel.style.width = '0%';
	},
	onLevel: (level) => {
		els.micLevel.style.width = `${Math.round(level * 100)}%`;
	},
	onInterim: (text) => {
		els.voiceLive.textContent = text ? `${text}…` : '';
	},
	onFinal: ({ text, confidence }) => {
		els.voiceLive.textContent = '';
		const low = confidence > 0 && confidence < 0.6;
		setVoiceStatus(
			low ? `Heard “${text}”, but not clearly. If it is wrong, edit the message and press Sign it.` : `Heard “${text}”.`,
			low ? 'warn' : '',
		);
		if (els.voiceAuto.checked) queue.push(text);
		else els.text.value = `${els.text.value.trim()} ${text}`.trim();
	},
	onError: (message) => {
		els.voiceLive.textContent = '';
		setVoiceStatus(message, 'error');
	},
});

for (const { code, label } of LANGUAGES) els.voiceLang.append(new Option(label, code));
els.voiceLang.addEventListener('change', () => voice.setLanguage(els.voiceLang.value));
if (!voice.supported) {
	els.mic.disabled = true;
	els.voiceLang.disabled = true;
	setVoiceStatus('Voice input is not available in this browser. Use Chrome, Edge or Safari, or type the message below.', 'error');
}
els.mic.addEventListener('click', () => {
	if (voice.state === 'idle') voice.start();
	else voice.stop();
});
document.addEventListener('keydown', (e) => {
	if (e.key === 'Escape' && voice.state !== 'idle') voice.stop();
});

const words = vocabulary();
els.vocabCount.textContent = `${allSigns().size} signs, ${words.length} word forms`;
for (const word of words) {
	const b = document.createElement('button');
	b.type = 'button';
	b.textContent = word.toLowerCase();
	b.title = glossFor(word) ?? '';
	if (findSign(word)?.source === 'hum-kalaam') b.classList.add('added');
	b.addEventListener('click', () => {
		els.text.value = `${els.text.value.trim()} ${word.toLowerCase()}`.trim();
		els.text.focus();
	});
	els.vocabList.append(b);
}
els.vocabFilter.addEventListener('input', () => {
	const q = els.vocabFilter.value.trim().toLowerCase();
	for (const b of els.vocabList.children) b.hidden = Boolean(q) && !b.textContent.includes(q);
});

// ── Camera: sign to text and voice ─────────────────────────────────────────
const camera = initCameraPanel({ getDominant: () => els.hand.value });

// Exposed for automated browser checks.
window.humKalaam = { stage, voice, queue, camera, planUtterance, signText, get plan() { return plan; }, get ready() { return ready; } };

requestAnimationFrame(updateCaption);
loadAvatar(els.avatarButtons.find((b) => b.getAttribute('aria-pressed') === 'true').dataset.avatar);
