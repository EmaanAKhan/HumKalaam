// The camera recogniser on simulated signers (the avatar's own signing with
// camera-like noise). These check the logic: segmentation, letters, words,
// refusals and sentences. They are not a measure of accuracy on real people.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SignRecognizer, classifyLetter, dtw, STATIC_LETTERS } from '../src/camera/recognizer.js';
import { allTemplates, evaluateClip, signTemplate } from '../src/camera/templates.js';
import { poseFeatures, cameraFeatures, bodyFrame, toBody } from '../src/camera/features.js';
import { buildFingerspellingClip } from '../src/vendor/three-ws/fingerspelling.js';
import { runWord } from '../scripts/eval-recognizer.mjs';
import { buildClip } from '../src/text-to-sign/lexicon.js';

const templates = allTemplates('Right');

function feedClip(rec, clip, t0 = 0, fps = 30) {
	let t = t0;
	for (let s = 0; s <= clip.duration; s += 1 / fps) {
		rec.push(poseFeatures(evaluateClip(clip, s)), t);
		t += 1000 / fps;
	}
	return t;
}
function handsDown(rec, t, ms) {
	for (let i = 0; i < ms; i += 33) rec.push(null, t + i);
	return t + ms;
}

test('templates exist for every sign, from the signing space only', () => {
	assert.ok(templates.length >= 200);
	for (const { frames } of templates) assert.ok(frames.length >= 3);
});

test('a sign matches its own template better than any other', () => {
	for (const word of ['HELLO', 'THANK', 'MOTHER', 'WATER', 'HOME', 'SCHOOL', 'DOCTOR', 'SICK']) {
		const own = signTemplate(word);
		const scores = templates.map((t) => ({ w: t.name, d: dtw(own, t.frames) })).sort((a, b) => a.d - b.d);
		assert.equal(scores[0].w, word);
	}
});

test('every static letter is read back from its own handshape, including K/P and G/Q by direction', () => {
	const clip = buildFingerspellingClip(STATIC_LETTERS.join(''), { holdSeconds: 0.8 });
	const marks = [];
	buildFingerspellingClip(STATIC_LETTERS.join(''), { holdSeconds: 0.8, marks });
	const wrong = [];
	for (const m of marks) {
		if (m.letter === ' ') continue;
		const f = poseFeatures(evaluateClip(clip, (m.start + m.end) / 2));
		const got = classifyLetter(f.dom).letter;
		if (got !== m.letter) wrong.push(`${m.letter}->${got}`);
	}
	assert.deepEqual(wrong, []);
});

test('slow fingerspelling is read letter by letter and closed when the hands drop', () => {
	const events = [];
	const rec = new SignRecognizer({ templates, onEvent: (e) => events.push(e) });
	const t = feedClip(rec, buildFingerspellingClip('BOX', { holdSeconds: 0.9 }));
	handsDown(rec, t, 2000);
	assert.deepEqual(events.filter((e) => e.type === 'letter').map((e) => e.text), ['B', 'O', 'X']);
	assert.deepEqual(events.filter((e) => e.type === 'spelled').map((e) => e.text), ['BOX']);
	assert.deepEqual(events.filter((e) => e.type === 'sentence').map((e) => e.text), ['BOX']);
});

test('a double letter needs a release between the two holds', () => {
	const events = [];
	const rec = new SignRecognizer({ templates, onEvent: (e) => events.push(e) });
	const t = feedClip(rec, buildFingerspellingClip('BOOK', { holdSeconds: 0.9 }));
	handsDown(rec, t, 2000);
	assert.equal(events.find((e) => e.type === 'spelled')?.text, 'BOOK');
});

test('signed words are recognised from simulated signers with camera noise', () => {
	const got = {};
	for (const word of ['HELLO', 'THANK', 'MOTHER', 'WATER', 'SCHOOL', 'SICK', 'HOME', 'WHERE']) {
		const ev = runWord(word, { noise: 1 });
		got[word] = ev.filter((e) => e.type === 'word').map((e) => e.text).join('+') || '-';
	}
	const right = Object.entries(got).filter(([w, g]) => w === g).length;
	assert.ok(right >= 6, JSON.stringify(got));
});

test('two signs in a row, then hands down, make one sentence in order', () => {
	const events = [];
	const rec = new SignRecognizer({ templates, onEvent: (e) => events.push(e) });
	// Two clips back to back, with a hands-down gap shorter than a sentence break.
	let t = 0;
	t = feedClip(rec, buildClip('MOTHER', {}), t);
	t = handsDown(rec, t, 500);
	t = feedClip(rec, buildClip('SICK', {}), t);
	handsDown(rec, t, 2200);
	assert.deepEqual(events.filter((e) => e.type === 'word').map((e) => e.text), ['MOTHER', 'SICK']);
	assert.deepEqual(events.filter((e) => e.type === 'sentence').map((e) => e.text), ['MOTHER SICK']);
});

test('a movement that matches nothing is refused, with the closest candidates', () => {
	const events = [];
	const rec = new SignRecognizer({ templates, onEvent: (e) => events.push(e) });
	// A random scribble in signing space with an open hand.
	const base = poseFeatures(evaluateClip(buildFingerspellingClip('B', {}), 0.6));
	let t = 0;
	for (let i = 0; i < 40; i++) {
		const a = i / 6;
		const f = { dom: { ...base.dom, pos: [-0.3 + 0.5 * Math.sin(a * 2.3), 0.3 * Math.cos(a * 3.1)] }, other: null };
		rec.push(f, t);
		t += 33;
	}
	handsDown(rec, t, 2200);
	const unknown = events.filter((e) => e.type === 'unknown');
	assert.ok(unknown.length >= 1, JSON.stringify(events.map((e) => e.type)));
	assert.equal(unknown[0].detail.candidates.length, 5);
	assert.equal(events.filter((e) => e.type === 'word').length, 0);
});

test('frames where only the non-dominant hand is seen do not break recognition', () => {
	const events = [];
	const rec = new SignRecognizer({ templates, onEvent: (e) => events.push(e) });
	const clip = buildClip('MORE', {});
	let t = 0;
	for (let s = 0; s <= clip.duration; s += 1 / 30) {
		const f = poseFeatures(evaluateClip(clip, s));
		// The tracker loses the dominant hand in every third frame.
		rec.push(Math.round(s * 30) % 3 === 0 ? { dom: null, other: f.other } : f, t);
		t += 33;
	}
	assert.doesNotThrow(() => handsDown(rec, t, 2200));
	assert.ok(events.some((e) => e.type === 'word' || e.type === 'unknown'));
});

test('arm length sets the sideways unit, the nose sets the unit above the shoulders', () => {
	const pose = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
	pose[11] = { x: 0.6, y: 0.5 };
	pose[12] = { x: 0.4, y: 0.5 }; // 200 px shoulders on a 1000x1000 frame
	pose[14] = { x: 0.4, y: 0.65 };
	pose[16] = { x: 0.4, y: 0.8 }; // a 300 px arm hanging straight down
	pose[0] = { x: 0.5, y: 0.4 }; // nose 100 px above the shoulder line
	const state = {};
	const frame = bodyFrame(pose, 1000, 1000, state);
	assert.ok(Math.abs(frame.xUnit - 300 / 1.2786) < 1);
	assert.equal(state.reach, 300);
	// A point level with the nose is at the reference body's nose height.
	const up = toBody(frame, { x: 0.5, y: 0.4 })[1];
	assert.ok(Math.abs(up - 0.383) < 0.01, String(up));
	// The arm's length is remembered when it later points at the camera (looks shorter).
	pose[16] = { x: 0.4, y: 0.6 };
	bodyFrame(pose, 1000, 1000, state);
	assert.ok(state.reach > 299);
});

test('no body in view: frames are ignored, nothing is emitted', () => {
	const events = [];
	const rec = new SignRecognizer({ templates, onEvent: (e) => events.push(e) });
	for (let t = 0; t < 3000; t += 33) rec.push(null, t);
	assert.deepEqual(events, []);
});

test('camera landmarks map into the same body frame as the avatar, hands assigned by the body', () => {
	// A synthetic 640x480 frame: shoulders 200 px apart, the signer's right hand
	// raised beside their right shoulder (image left, unmirrored).
	const pose = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5 }));
	pose[11] = { x: 420 / 640, y: 240 / 480 }; // signer's left shoulder: image right
	pose[12] = { x: 220 / 640, y: 240 / 480 }; // signer's right shoulder: image left
	pose[16] = { x: 200 / 640, y: 140 / 480 }; // right wrist, where the hand is
	pose[15] = { x: 440 / 640, y: 400 / 480 }; // left wrist, hanging low
	// Elbows and nose not visible: units fall back to the shoulder width.
	pose[13] = { x: 0.5, y: 0.5, visibility: 0 };
	pose[14] = { x: 0.5, y: 0.5, visibility: 0 };
	pose[0] = { x: 0.5, y: 0.5, visibility: 0 };
	const frame = bodyFrame(pose, 640, 480);
	assert.equal(frame.span, 200);
	const hand = Array.from({ length: 21 }, () => ({ x: 200 / 640, y: 140 / 480 }));
	hand[5] = { x: 200 / 640, y: 100 / 480 };
	const f = cameraFeatures(
		// The tracker's own label says "Left": the body wins.
		{ pose, hands: [{ side: 'Left', image: hand, world: poseFeatures(evaluateClip(buildFingerspellingClip('B', {}), 0.6)).dom.world }] },
		{ width: 640, height: 480 },
	);
	// 120 px to the signer's right of centre and 100 px up: (-0.6, +0.5) shoulder widths.
	assert.deepEqual(f.dom.pos.map((v) => Math.round(v * 100) / 100), [-0.6, 0.5]);
	assert.equal(f.dom.pointsDown, false);
	// The hand tracker saw no left hand; the pose wrist still places it, without a shape.
	assert.deepEqual(f.other.pos.map((v) => Math.round(v * 100) / 100), [0.6, -0.8]);
	assert.equal(f.other.shape, null);
	assert.equal(f.other.fromPose, true);
});
