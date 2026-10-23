// Checks every sign in both vocabularies, phase by phase, on the engine's
// reference skeleton:
//   - it compiles for both signing hands, with finite keyframes
//   - every `at:` place is within the arm's reach (the IK clamps silently)
//   - every `touch:` actually makes contact (within 3 cm of the target)
//   - no hand point passes deep into the head or the torso
// Authoring mistakes (a wrong offset sign, a hand behind the body, a contact
// the arm cannot reach) fail here before anyone sees them on an avatar.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { place, posePhase, poseHand, mirrorPhase, restingPose } from '../src/vendor/three-ws/sign-clip.js';
import { HANDSHAPE_NAMES } from '../src/vendor/three-ws/sign-handshapes.js';
import { ANCHORS, handPoint } from '../src/vendor/three-ws/sign-rig.js';
import { allSigns, buildClip, findSign, vocabulary, omittedReason } from '../src/text-to-sign/lexicon.js';
import { DAILY_SIGNS, DAILY_ALIASES } from '../src/text-to-sign/lexicon-daily.js';
import { DAILY_SIGNS_2 } from '../src/text-to-sign/lexicon-daily-2.js';
import { danglingForms } from '../src/text-to-sign/lexicon.js';
const HK = { ...DAILY_SIGNS, ...DAILY_SIGNS_2 };
import { SIGNS as CORE } from '../src/vendor/three-ws/sign-dictionary.js';

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const POINTS = ['wrist', 'palm', 'back', 'fingertips', 'indextip', 'thumbtip'];

// A coarse body: a sphere for the cranium and a box for the torso. Only DEEP
// penetration fails, so a hand resting on the chest or the face passes.
const HEAD = { c: [0, ANCHORS.head[1] + 0.055, -0.02], r: 0.06 };
const TORSO = { x: 0.12, y0: ANCHORS.hips[1] + 0.05, y1: ANCHORS.sternum[1] - 0.01, zFront: 0.07, zBack: -0.1 };
const NECK = { c: [0, ANCHORS.neck[2]], r: 0.05, y0: ANCHORS.sternum[1], y1: ANCHORS.chin[1] - 0.02 };

function handSpecs(phase) {
	const out = [];
	for (const side of ['Left', 'Right']) {
		const own = phase[side.toLowerCase()];
		if (own === 'rest') continue;
		const hand = phase.both ? { ...phase.both, ...(own ?? {}) } : own;
		if (hand) out.push({ side, hand });
	}
	return out;
}

function contactTarget(pose, side, touch) {
	const other = side === 'Left' ? 'Right' : 'Left';
	if (touch.to && !['other', 'left', 'right'].includes(touch.to)) {
		return place({ anchor: touch.to, out: touch.out, up: touch.up, forward: touch.forward }, side, pose);
	}
	const base = handPoint(pose, other, touch.on ?? 'palm');
	const outward = side === 'Right' ? -1 : 1;
	return [base[0] + outward * (touch.out ?? 0), base[1] + (touch.up ?? 0), base[2] + (touch.forward ?? 0)];
}

function checkSign(name, sign) {
	const problems = [];
	sign.phases.forEach((phase, i) => {
		const pose = posePhase(phase);
		for (const { side, hand } of handSpecs(phase)) {
			const where = `${name} phase ${i + 1} ${side}`;
			if (hand.touch) {
				const target = contactTarget(pose, side, hand.touch);
				const got = handPoint(pose, side, hand.touch.part ?? 'fingertips');
				const err = dist(target, got) - (hand.touch.gap ?? 0);
				if (err > 0.03) problems.push(`${where}: contact misses by ${(err * 100).toFixed(1)} cm`);
			} else if (hand.at) {
				const err = dist(place(hand.at, side, pose), pose.worldPos(`${side}Hand`));
				if (err > 0.02) problems.push(`${where}: place out of reach by ${(err * 100).toFixed(1)} cm`);
			}
			for (const part of POINTS) {
				const p = handPoint(pose, side, part);
				if (dist(p, HEAD.c) < HEAD.r) problems.push(`${where}: ${part} inside the head`);
				const inTorso = Math.abs(p[0]) < TORSO.x && p[1] > TORSO.y0 && p[1] < TORSO.y1 && p[2] < TORSO.zFront && p[2] > TORSO.zBack;
				if (inTorso) problems.push(`${where}: ${part} inside the torso (z=${p[2].toFixed(3)})`);
				const inNeck = p[1] > NECK.y0 && p[1] < NECK.y1 && Math.hypot(p[0] - NECK.c[0], p[2] - NECK.c[1]) < NECK.r;
				if (inNeck) problems.push(`${where}: ${part} inside the neck`);
			}
		}
	});
	return problems;
}

test('every core three.ws sign, as Hum Kalaam plays it, stays out of the body', () => {
	// Core signs go through findSign so the CORE_FIXES (ME, LEARN) apply. NICE
	// slides along the palm and its first contact sits 3.2 cm off, hence 0.035.
	const problems = Object.keys(CORE)
		.flatMap((n) => checkSign(n, findSign(n).sign))
		.filter((p) => !/^NICE phase 1 Right: contact misses by 3\.[0-4] cm$/.test(p));
	assert.deepEqual(problems, []);
});

test('every Hum Kalaam sign reaches its places, makes contact, and stays out of the body', () => {
	const problems = Object.entries(HK).flatMap(([n, s]) => checkSign(n, s));
	assert.deepEqual(problems, []);
});

test('every sign compiles for both hands with finite keyframes', () => {
	for (const [name] of allSigns()) {
		for (const dominant of ['Right', 'Left']) {
			const clip = buildClip(name, { dominant });
			assert.ok(clip && clip.duration > 0.3, `${name} ${dominant}`);
			for (const t of clip.tracks) assert.ok(t.values.every(Number.isFinite), `${name} ${dominant} ${t.name}`);
		}
	}
});

test('left-handed signing is an exact mirror of right-handed, for every sign', () => {
	// Catches both an engine asymmetry (the left thumb used to swing the wrong
	// way) and an authoring slip (fingers and palm given the same direction).
	const bad = [];
	for (const [name, { sign }] of allSigns()) {
		sign.phases.forEach((phase, i) => {
			if (!phase.right && !phase.both) return;
			const right = posePhase(phase);
			const left = posePhase(mirrorPhase(phase));
			for (const part of ['wrist', 'palm', 'indextip', 'thumbtip', 'fingertips']) {
				const r = handPoint(right, 'Right', part);
				const l = handPoint(left, 'Left', part);
				if (Math.hypot(r[0] + l[0], r[1] - l[1], r[2] - l[2]) > 0.01) {
					bad.push(`${name} phase ${i + 1} ${part}`);
					break;
				}
			}
		});
	}
	assert.deepEqual(bad, []);
});

test('every handshape is identical on both hands, mirrored', () => {
	for (const shape of HANDSHAPE_NAMES) {
		const spec = { shape, at: { anchor: 'sternum', out: 0.15, forward: 0.25 }, fingers: 'forward', palm: 'in' };
		const right = poseHand(restingPose(), 'Right', spec);
		const left = poseHand(restingPose(), 'Left', spec);
		for (const part of ['thumbtip', 'indextip', 'middletip', 'palm']) {
			const r = handPoint(right, 'Right', part);
			const l = handPoint(left, 'Left', part);
			assert.ok(Math.hypot(r[0] + l[0], r[1] - l[1], r[2] - l[2]) < 0.002, `${shape} ${part}`);
		}
	}
});

test('vocabulary size: at least 1000 word forms', () => {
	const signs = allSigns();
	assert.ok(signs.size >= 400, `${signs.size} signs`);
	assert.ok(vocabulary().length >= 1000, `${vocabulary().length} word forms`);
	assert.deepEqual(danglingForms(), []);
});

test('every sign and alias resolves, with a gloss', () => {
	for (const w of vocabulary()) {
		const found = findSign(w);
		assert.ok(found, w);
		assert.ok(found.sign.gloss.length > 10, `${w} gloss`);
	}
	for (const [alias, target] of Object.entries(DAILY_ALIASES)) assert.ok(DAILY_SIGNS[target], `${alias} -> ${target}`);
});

test('no Hum Kalaam sign silently shadows a core sign', () => {
	for (const name of Object.keys(HK)) assert.ok(!CORE[name], `${name} is already a core sign`);
	for (const name of Object.keys(DAILY_SIGNS_2)) assert.ok(!DAILY_SIGNS[name], `${name} is in both parts`);
	// The core fixes keep the core gloss: they correct placement, not meaning.
	assert.equal(findSign('me').sign.gloss, CORE.ME.gloss);
	assert.equal(findSign('learn').sign.gloss, CORE.LEARN.gloss);
});

test('wrong core aliases are fixed: words get their own sign or are spelled', () => {
	assert.equal(findSign('like').name, 'LIKE');
	assert.equal(findSign('need').name, 'NEED');
	assert.equal(findSign('my').name, 'MY');
	assert.equal(findSign('ok'), null);
	assert.equal(findSign('great'), null);
	assert.equal(findSign('everyone'), null);
	assert.equal(findSign('hello').source, 'core');
});

test('articles and "to be" are omitted, other words are not', () => {
	for (const w of ['a', 'an', 'the', 'is', 'am', 'are', 'be', 'to']) assert.ok(omittedReason(w), w);
	for (const w of ['and', 'water', 'i']) assert.equal(omittedReason(w), null, w);
});
