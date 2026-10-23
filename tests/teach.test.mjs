// Teach mode: recording samples and recognising from them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SampleRecorder, classifyTaught, spreadByWord, compact } from '../src/camera/teach.js';
import { SignRecognizer } from '../src/camera/recognizer.js';
import { simulate } from '../scripts/eval-recognizer.mjs';
import { isActive } from '../src/camera/features.js';

const activeFrames = (word, noise) => simulate(word, { noise }).map((x) => x.f).filter((f) => isActive(f.dom) || isActive(f.other));

test('recorder waits for lowered hands, records the sign, stops when hands drop', () => {
	const rec = new SampleRecorder({ dropMs: 300 });
	const frames = simulate('HELLO', { noise: 0 });
	const up = frames.find((x) => isActive(x.f.dom)).f;
	const down = frames[0].f; // the clip starts from the resting pose
	assert.ok(!isActive(down.dom) && !isActive(down.other));
	// Hands already raised when recording starts: it asks to lower them first.
	assert.equal(rec.push(up, 0), 'lower');
	// No person in view is not the same as hands down.
	assert.equal(rec.push(null, 16), 'lower');
	assert.equal(rec.push(down, 33), 'waiting');
	let state;
	let t = 66;
	for (const { f } of frames) state = rec.push(f, (t += 33));
	for (let i = 0; i < 12 && state !== 'done'; i++) state = rec.push(null, (t += 33));
	assert.equal(state, 'done');
	const out = rec.result();
	assert.ok(out.length >= 6);
	assert.ok(out.every((f) => isActive(f.dom) || isActive(f.other)));
});

test('a too-short movement is not saved', () => {
	const rec = new SampleRecorder({ dropMs: 100 });
	const up = activeFrames('HELLO', 0)[5];
	rec.push(simulate('HELLO', { noise: 0 })[0].f, 0);
	rec.push(up, 33);
	rec.push(up, 66);
	for (let t = 99; t < 400; t += 33) rec.push(null, t);
	assert.equal(rec.result(), null);
});

test('taught words are recognised from new performances by the same signer', () => {
	const words = ['HELLO', 'THANK', 'MOTHER', 'FATHER', 'WATER', 'EAT', 'DRINK', 'HOME', 'SCHOOL', 'SICK', 'HELP', 'PLEASE', 'SORRY', 'YES', 'NO', 'WHERE'];
	const samples = [];
	for (const w of words) for (let k = 0; k < 3; k++) samples.push({ word: w, frames: activeFrames(w, 1).map(compact) });
	const spreads = spreadByWord(samples);
	let right = 0, wrong = 0;
	for (const w of words) {
		for (let k = 0; k < 2; k++) {
			const res = classifyTaught(activeFrames(w, 1), samples, spreads);
			if (res.word === w) right++;
			else if (res.word) wrong++;
		}
	}
	const n = words.length * 2;
	assert.ok(right / n >= 0.85, `right ${right}/${n}`);
	assert.ok(wrong / n <= 0.05, `wrong ${wrong}/${n}`);
});

test('a word that was never taught is refused, not forced onto a taught one', () => {
	const samples = [];
	for (const w of ['HELLO', 'THANK', 'MOTHER']) for (let k = 0; k < 3; k++) samples.push({ word: w, frames: activeFrames(w, 1).map(compact) });
	const spreads = spreadByWord(samples);
	let forced = 0;
	for (const other of ['SCHOOL', 'WALK', 'BICYCLE', 'RAIN', 'BOOK']) if (classifyTaught(activeFrames(other, 1), samples, spreads).word) forced++;
	assert.ok(forced <= 1, `${forced} untaught signs were forced onto taught words`);
});

test('the recogniser switches to taught samples and ends signs when the hands drop', () => {
	const samples = [];
	for (const w of ['HELLO', 'THANK', 'WATER']) for (let k = 0; k < 3; k++) samples.push({ word: w, frames: activeFrames(w, 1).map(compact) });
	const events = [];
	const rec = new SignRecognizer({ taught: samples, templates: [], onEvent: (e) => events.push(e) });
	assert.match(rec.debugState().mode, /3 taught words/);
	let t = 0;
	for (const w of ['THANK', 'WATER']) {
		for (const { f } of simulate(w, { noise: 1 })) rec.push(f, (t += 33));
		for (let i = 0; i < 15; i++) rec.push(null, (t += 33));
	}
	for (let i = 0; i < 60; i++) rec.push(null, (t += 33));
	assert.deepEqual(events.filter((e) => e.type === 'word').map((e) => e.text), ['THANK', 'WATER']);
	assert.equal(events.find((e) => e.type === 'sentence')?.text, 'THANK WATER');
});
