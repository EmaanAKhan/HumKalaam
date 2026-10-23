#!/usr/bin/env node
// Measures the camera recogniser on SIMULATED signers: the avatar's own sign
// clips, sampled at 30 fps, with noise added the way a webcam tracker adds it
// (position jitter, landmark jitter, a different signing speed, a signer who
// holds their hands a little higher or lower). This is an upper bound on real
// accuracy, not a measurement of it.
//
//   node scripts/eval-recognizer.mjs [noiseLevel=1] [seed=1]

import { SignRecognizer } from '../src/camera/recognizer.js';
import { evaluateClip, allTemplates } from '../src/camera/templates.js';
import { poseFeatures, shapeVector } from '../src/camera/features.js';
import { buildClip, allSigns } from '../src/text-to-sign/lexicon.js';

const level = Number(process.argv[2] ?? 1);
let seed = Number(process.argv[3] ?? 1);
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;

export function simulate(word, { noise = 1, dominant = 'Right' } = {}) {
	const clip = buildClip(word, { dominant });
	const speed = 1 + 0.25 * rnd() * noise; // 0.75x .. 1.25x
	const shift = [0.08 * rnd() * noise, 0.1 * rnd() * noise];
	const frames = [];
	const dur = clip.duration / speed;
	for (let t = 0; t <= dur + 0.6; t += 1 / 30) {
		const f = poseFeatures(evaluateClip(clip, Math.min(t * speed, clip.duration)), dominant);
		for (const h of [f.dom, f.other]) {
			h.pos = [h.pos[0] + shift[0] + 0.02 * rnd() * noise, h.pos[1] + shift[1] + 0.02 * rnd() * noise];
			h.world = h.world.map((p) => p.map((v) => v + 0.004 * rnd() * noise));
			h.shape = shapeVector(h.world);
		}
		frames.push({ f, t: t * 1000 });
	}
	return frames;
}

export function runWord(word, opts = {}) {
	const events = [];
	const rec = new SignRecognizer({ dominant: opts.dominant ?? 'Right', templates: allTemplates(opts.dominant ?? 'Right'), onEvent: (e) => events.push(e) });
	const frames = simulate(word, opts);
	for (const { f, t } of frames) rec.push(f, t);
	const end = frames.at(-1).t;
	for (let t = end + 33; t < end + 2500; t += 33) rec.push(null, t); // hands down
	return events;
}

if (process.argv[1]?.endsWith('eval-recognizer.mjs')) {
	const words = [...allSigns().keys()];
	let correct = 0, wrong = 0, none = 0;
	const errors = [];
	for (const w of words) {
		const ev = runWord(w, { noise: level });
		const got = ev.filter((e) => e.type === 'word' || e.type === 'spelled').map((e) => e.text);
		if (got.length === 1 && got[0] === w) correct++;
		else if (!got.length) { none++; errors.push(`${w}: -`); }
		else { wrong++; errors.push(`${w}: ${got.join('+')}`); }
	}
	console.log(`noise ${level}: ${words.length} signs, correct ${correct} (${((100 * correct) / words.length).toFixed(1)}%), wrong ${wrong}, not recognised ${none}`);
	console.log(errors.slice(0, 60).join(' | '));
}
