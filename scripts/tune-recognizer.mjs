// Distance statistics on simulated signers, to choose the acceptance thresholds.
import { simulate } from './eval-recognizer.mjs';
import { classifyMovement, DEFAULTS } from '../src/camera/recognizer.js';
import { allTemplates } from '../src/camera/templates.js';
import { isActive } from '../src/camera/features.js';
import { allSigns } from '../src/text-to-sign/lexicon.js';

const templates = allTemplates('Right');
const rows = [];
for (const noise of [1, 1.5]) {
	for (const w of allSigns().keys()) {
		for (const seedShift of [0, 1]) {
			const frames = simulate(w, { noise }).map((x) => x.f).filter((f) => isActive(f.dom) || isActive(f.other));
			const res = classifyMovement(frames, { templates, opts: { ...DEFAULTS, acceptDistance: 99, acceptRatio: 1 } });
			const best = res.candidates[0], second = res.candidates[1];
			rows.push({ noise, ok: best.word === w, d: best.distance, ratio: second.distance / best.distance });
		}
	}
}
for (const noise of [1, 1.5]) {
	const r = rows.filter((x) => x.noise === noise);
	const top1 = r.filter((x) => x.ok).length / r.length;
	console.log(`noise ${noise}: top-1 if always accepting = ${(100 * top1).toFixed(1)}%`);
	for (const [D, R] of [[0.42, 1.12], [0.55, 1.08], [0.65, 1.06], [0.75, 1.05], [0.9, 1.04], [99, 1.0]]) {
		const acc = r.filter((x) => x.d <= D && x.ratio >= R);
		const right = acc.filter((x) => x.ok).length;
		console.log(`  accept d<=${D} ratio>=${R}: correct ${(100 * right / r.length).toFixed(1)}%  wrong ${(100 * (acc.length - right) / r.length).toFixed(1)}%  refused ${(100 * (r.length - acc.length) / r.length).toFixed(1)}%`);
	}
}
