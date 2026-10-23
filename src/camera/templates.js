// Reference trajectories for every sign, generated from the avatar's own sign
// definitions: each sign's clip is played on the canonical skeleton and sampled,
// giving the path of the hands and their shapes through the sign. The camera
// recogniser compares what it sees against these.
//
// No signing data was recorded for this: the templates are exactly as good as
// the authored signs, and recognising real people with them is a first
// approximation to be tested with real signers.

import { Pose } from '../vendor/three-ws/sign-rig.js';
import { buildClip, allSigns } from '../text-to-sign/lexicon.js';
import { isActive, poseFeatures } from './features.js';

/** Spherical interpolation between two [x,y,z,w] quaternions. */
function slerp(a, b, t) {
	let [ax, ay, az, aw] = a;
	let [bx, by, bz, bw] = b;
	let cos = ax * bx + ay * by + az * bz + aw * bw;
	if (cos < 0) {
		cos = -cos;
		bx = -bx; by = -by; bz = -bz; bw = -bw;
	}
	if (cos > 0.9995) {
		const q = [ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t, aw + (bw - aw) * t];
		const n = Math.hypot(...q);
		return q.map((v) => v / n);
	}
	const theta = Math.acos(cos);
	const s = Math.sin(theta);
	const wa = Math.sin((1 - t) * theta) / s;
	const wb = Math.sin(t * theta) / s;
	return [ax * wa + bx * wb, ay * wa + by * wb, az * wa + bz * wb, aw * wa + bw * wb];
}

/** Pose of the canonical rig at time `t` of a clip document (quaternion tracks). */
export function evaluateClip(clip, t) {
	const pose = new Pose();
	for (const track of clip.tracks) {
		if (track.type !== 'quaternion') continue;
		const bone = track.name.replace(/\.quaternion$/, '');
		const { times, values } = track;
		let i = 0;
		while (i < times.length - 1 && times[i + 1] < t) i++;
		const j = Math.min(i + 1, times.length - 1);
		const span = times[j] - times[i];
		const u = span > 0 ? Math.min(1, Math.max(0, (t - times[i]) / span)) : 0;
		const a = values.slice(i * 4, i * 4 + 4);
		const b = values.slice(j * 4, j * 4 + 4);
		pose.setLocal(bone, slerp(a, b, u));
	}
	return pose;
}

export const SAMPLE_HZ = 10;

/** Feature frames of one sign, while its dominant hand is up in signing space. */
export function signTemplate(word, dominant = 'Right') {
	const clip = buildClip(word, { dominant, lead: true, settle: true });
	if (!clip) return null;
	const frames = [];
	for (let t = 0; t <= clip.duration; t += 1 / SAMPLE_HZ) {
		const f = poseFeatures(evaluateClip(clip, t), dominant);
		if (isActive(f.dom) || isActive(f.other)) frames.push(f);
	}
	return frames.length ? frames : null;
}

const _cache = new Map();
/** Templates for every sign in the vocabulary (cached per dominant hand). */
export function allTemplates(dominant = 'Right') {
	if (!_cache.has(dominant)) {
		const out = [];
		for (const [name] of allSigns()) {
			const frames = signTemplate(name, dominant);
			if (frames) out.push({ name, frames });
		}
		_cache.set(dominant, out);
	}
	return _cache.get(dominant);
}
