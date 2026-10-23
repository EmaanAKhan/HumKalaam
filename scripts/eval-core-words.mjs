#!/usr/bin/env node
// Accuracy of the 20 core camera words on SIMULATED signers (the avatar's own
// clips plus webcam-like noise; see eval-recognizer.mjs). An upper bound on real
// accuracy, not a measurement of it.
//
//   node scripts/eval-core-words.mjs [noiseLevel=1] [trials=8]

import { SignRecognizer } from '../src/camera/recognizer.js';
import { allTemplates } from '../src/camera/templates.js';
import { CORE_WORDS, coreTemplates } from '../src/camera/core-words.js';
import { simulate } from './eval-recognizer.mjs';

const noise = Number(process.argv[2] ?? 1);
const trials = Number(process.argv[3] ?? 8);

function recognise(word, templates) {
	const events = [];
	const rec = new SignRecognizer({ dominant: 'Right', templates, onEvent: (e) => events.push(e) });
	const frames = simulate(word, { noise });
	for (const { f, t } of frames) rec.push(f, t);
	const end = frames.at(-1).t;
	for (let t = end + 33; t < end + 2500; t += 33) rec.push(null, t); // hands down
	const got = events.filter((e) => e.type === 'word' || e.type === 'spelled').map((e) => e.text);
	return got.length === 1 && got[0] === word;
}

const core = coreTemplates('Right');
const all = allTemplates('Right');
let inCore = 0, inAll = 0, n = 0;
const weak = [];
for (const w of CORE_WORDS) {
	let ok = 0;
	for (let i = 0; i < trials; i++) {
		const hit = recognise(w, core);
		ok += hit;
		inCore += hit;
		inAll += recognise(w, all);
		n++;
	}
	if (ok < trials) weak.push(`${w} ${ok}/${trials}`);
}
console.log(`noise ${noise}: 20 core words ${((100 * inCore) / n).toFixed(0)}% correct; same words against all ${all.length} signs ${((100 * inAll) / n).toFixed(0)}%`);
if (weak.length) console.log('weakest:', weak.join(' | '));
