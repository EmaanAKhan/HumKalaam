// Camera frames in, recognised letters and signs out.
//
// Two recognisers share one stream of frames:
//
//   LETTERS  A held, still handshape is graded against the manual alphabet
//            (three.ws sign-grader, the same handshapes the avatar spells with).
//            A letter is accepted after it has been held clearly for a moment.
//            J and Z are traced letters and are not recognised from a hold.
//
//   SIGNS    A movement of the hands, from leaving rest (or a pause) to the next
//            pause or to lowering the hands, is compared with every sign's
//            reference trajectory (templates.js) by dynamic time warping. The
//            closest sign is accepted only when it is close enough and clearly
//            closer than the next best; otherwise the movement is reported as
//            not recognised rather than guessed.
//
// Letters held in a row form a fingerspelled word, which ends when the hands
// drop or pause. A sentence ends when the hands have been down for a while.
//
// The clock is passed in with every frame (ms), so the logic is testable with
// synthetic frames and needs no browser.

import { rankHandshapes } from '../vendor/three-ws/sign-grader.js';
import { SPELLING_MIN_Y, isActive } from './features.js';
import { allTemplates } from './templates.js';
import { classifyTaught, spreadByWord } from './teach.js';

export const STATIC_LETTERS = Object.freeze('ABCDEFGHIKLMNOPQRSTUVWXY'.split(''));
// Pairs that are the same handshape, told apart by the hand pointing down.
const POINTING_DOWN = { K: 'P', G: 'Q' };

export const DEFAULTS = Object.freeze({
	letterScore: 72, // smoothed grader score (0-100) a letter must reach
	letterMargin: 6, // and its lead over the next letter
	letterHoldMs: 550,
	stillSpeed: 0.35, // shoulder widths per second below which the hand is "still"
	pauseMs: 560, // a still hold this long ends a sign
	dropMs: 300, // hands down this long ends a sign or word
	sentenceMs: 1600, // hands down this long ends a sentence
	minPath: 0.25, // a movement shorter than this (shoulder widths) is not a sign
	acceptDistance: 0.65, // DTW distance a sign must beat (tuned on simulated signers: scripts/tune-recognizer.mjs)
	acceptRatio: 1.06, // and the runner-up must be this much further away
	maxFrames: 60,
});

const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const shapeDist = (a, b) => {
	let s = 0;
	for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
	return s / a.length;
};

// Cost of a hand that one frame has and the other does not (a tracker can lose
// a hand for a few frames, and real cameras often see only one).
const MISSING_HAND = 1.0;

/** Distance between an observed frame and a template frame. */
export function frameDistance(o, t) {
	let d;
	// A hand seen only by the body tracker has a position but no shape.
	if (o.dom && t.dom) d = dist2(o.dom.pos, t.dom.pos) + (o.dom.shape && t.dom.shape ? 1.5 * shapeDist(o.dom.shape, t.dom.shape) : 0);
	else d = o.dom || t.dom ? MISSING_HAND : 0;
	const oa = isActive(o.other);
	const ta = isActive(t.other);
	if (oa && ta) d += 0.6 * dist2(o.other.pos, t.other.pos);
	else if (oa !== ta) d += 0.45;
	return d;
}

/** Length-normalised dynamic time warping distance. */
export function dtw(obs, tpl) {
	const n = obs.length;
	const m = tpl.length;
	let prev = new Float64Array(m + 1).fill(Infinity);
	let cur = new Float64Array(m + 1);
	prev[0] = 0;
	for (let i = 1; i <= n; i++) {
		cur.fill(Infinity);
		for (let j = 1; j <= m; j++) {
			const c = frameDistance(obs[i - 1], tpl[j - 1]);
			cur[j] = c + Math.min(prev[j], cur[j - 1], prev[j - 1]);
		}
		[prev, cur] = [cur, prev];
	}
	return prev[m] / (n + m);
}

/** Resample a frame list to at most `max` frames, evenly. */
function thin(frames, max) {
	if (frames.length <= max) return frames;
	const out = [];
	for (let i = 0; i < max; i++) out.push(frames[Math.round((i * (frames.length - 1)) / (max - 1))]);
	return out;
}

/**
 * Classify one movement.
 * @returns {{ word: string|null, distance: number, runnerUp: {word: string, distance: number}|null, candidates: {word: string, distance: number}[] }}
 */
export function classifyMovement(frames, { dominant = 'Right', templates = allTemplates(dominant), opts = DEFAULTS } = {}) {
	const obs = thin(frames, opts.maxFrames);
	const scored = templates.map((t) => ({ word: t.name, distance: dtw(obs, thin(t.frames, opts.maxFrames)) })).sort((a, b) => a.distance - b.distance);
	const [best, second] = scored;
	const accepted = best && best.distance <= opts.acceptDistance && (!second || second.distance >= best.distance * opts.acceptRatio);
	return { word: accepted ? best.name ?? best.word : null, distance: best?.distance ?? Infinity, runnerUp: second ?? null, candidates: scored.slice(0, 5) };
}

/** Best static letter for one hand, with the K/P and G/Q direction rule. */
export function classifyLetter(hand) {
	const ranked = rankHandshapes(hand.world, STATIC_LETTERS);
	let [best, second] = ranked;
	const fix = (r) => {
		if (!r) return r;
		const down = POINTING_DOWN[r.name];
		const up = Object.keys(POINTING_DOWN).find((k) => POINTING_DOWN[k] === r.name);
		if (hand.pointsDown && down) return { ...r, name: down };
		if (!hand.pointsDown && up) return { ...r, name: up };
		return r;
	};
	best = fix(best);
	second = fix(second);
	// After the direction rule K and P (G and Q) collapse to one letter; the
	// runner-up is then the next DIFFERENT letter.
	if (second && second.name === best.name) second = fix(ranked[2]);
	return { letter: best.name, score: best.score, margin: best.score - (second?.score ?? 0) };
}

export class SignRecognizer {
	/**
	 * @param {{
	 *   dominant?: 'Left'|'Right',
	 *   onEvent?: (e: { type: 'letter'|'word'|'spelled'|'unknown'|'sentence'|'status', text?: string, detail?: object }) => void,
	 *   opts?: Partial<typeof DEFAULTS>,
	 *   templates?: object[],
	 * }} [cfg]
	 */
	constructor(cfg = {}) {
		this.dominant = cfg.dominant ?? 'Right';
		this.onEvent = cfg.onEvent ?? (() => {});
		this.opts = { ...DEFAULTS, ...(cfg.opts ?? {}) };
		this.templates = cfg.templates ?? null;
		this.setTaught(cfg.taught ?? []);
		this.reset();
	}

	/**
	 * Use the signer's own recorded samples (teach mode). With any samples, a
	 * movement is matched against them instead of the avatar's references, and a
	 * sign ends when the hands go down or after a longer pause, as when recording.
	 */
	setTaught(samples) {
		this.taught = samples ?? [];
		this.spreads = this.taught.length ? spreadByWord(this.taught) : new Map();
		this.pauseMs = this.taught.length ? Math.max(this.opts.pauseMs, 1500) : this.opts.pauseMs;
	}

	/** A snapshot for the live debug view. */
	debugState() {
		return {
			moving: this.moving.length > 0,
			still: this.stillSince != null,
			frames: this.moving.length,
			path: this.path,
			spelling: this.spelling,
			last: this.lastResult,
			mode: this.taught.length ? `your ${new Set(this.taught.map((s) => s.word)).size} taught words` : 'avatar references',
		};
	}

	reset() {
		this.lastResult = null;
		this.moving = []; // frames of the current movement
		this.path = 0;
		this.stillSince = null;
		this.downSince = null;
		this.lastPos = null;
		this.lastT = null;
		this.letterSmooth = new Map();
		this.letterCandidate = null;
		this.letterSince = null;
		this.lastLetter = null;
		this.letterReleased = true;
		this.spelling = '';
		this.sentence = [];
		this.inSentence = false;
	}

	_templates() {
		if (!this.templates) this.templates = allTemplates(this.dominant);
		return this.templates;
	}

	/**
	 * Feed one frame of features (from features.js), or null when no body is seen.
	 * @param {{ dom: object|null, other: object|null }|null} f
	 * @param {number} t  timestamp, ms
	 */
	push(f, t) {
		const active = Boolean(f && (isActive(f.dom) || isActive(f.other)));
		if (!active) {
			this._handsDown(t);
			this.lastT = t;
			return;
		}
		this.downSince = null;
		this.inSentence = true;

		// Movement of BOTH hands: in many signs (WALK, SIGN, PLAY) the hands
		// alternate, and one hand alone looks still half the time.
		const hands = [f.dom, f.other].map((h) => (isActive(h) ? h.pos : null));
		const dt = this.lastT == null ? 0 : (t - this.lastT) / 1000;
		let step = 0;
		if (this.lastPos) {
			for (let i = 0; i < 2; i++) if (hands[i] && this.lastPos[i]) step = Math.max(step, dist2(hands[i], this.lastPos[i]));
		}
		const speed = dt > 0 ? step / dt : 0;
		this.lastPos = hands;
		this.lastT = t;

		if (speed < this.opts.stillSpeed) {
			if (this.stillSince == null) this.stillSince = t;
		} else {
			this.stillSince = null;
			this.letterReleased = true; // moving between letters releases the last one
		}

		this.moving.push(f);
		this.path += step;

		// Letters: a still dominant hand holding a clear handshape.
		if (this.stillSince != null && isActive(f.dom) && f.dom.world && f.dom.pos[1] >= SPELLING_MIN_Y) this._letterFrame(f.dom, t);
		else this.letterCandidate = null;

		// A pause after real movement ends a sign.
		if (this.stillSince != null && t - this.stillSince >= this.pauseMs && this.path >= this.opts.minPath) {
			this._endMovement();
		} else if (this.moving.length > 120) {
			this._endMovement();
		}
	}

	_letterFrame(hand, t) {
		const { letter, score, margin } = classifyLetter(hand);
		const prev = this.letterSmooth.get(letter) ?? score;
		const smooth = prev + (score - prev) * 0.35;
		this.letterSmooth.set(letter, smooth);
		const clear = smooth >= this.opts.letterScore && margin >= this.opts.letterMargin;
		if (!clear) {
			this.letterCandidate = null;
			return;
		}
		if (this.letterCandidate !== letter) {
			this.letterCandidate = letter;
			this.letterSince = t;
			return;
		}
		if (t - this.letterSince < this.opts.letterHoldMs) return;
		// The same letter twice needs a release (a small bounce or a movement) in between.
		if (letter === this.lastLetter && !this.letterReleased) return;
		this.spelling += letter;
		this.lastLetter = letter;
		this.letterReleased = false;
		this.letterCandidate = null;
		// A held letter is not a sign: start the next movement fresh.
		this.moving = [];
		this.path = 0;
		this.onEvent({ type: 'letter', text: letter, detail: { score: Math.round(smooth), margin: Math.round(margin) } });
	}

	_endMovement() {
		const frames = this.moving;
		const path = this.path;
		this.moving = [];
		this.path = 0;
		this.stillSince = null;
		if (this.spelling) return; // inside a fingerspelled word: movement is transitions
		if (frames.length < 3 || path < this.opts.minPath) return;
		const res = this.taught.length
			? classifyTaught(frames, this.taught, this.spreads)
			: classifyMovement(frames, { dominant: this.dominant, templates: this._templates(), opts: this.opts });
		this.lastResult = { word: res.word, distance: res.distance, candidates: res.candidates.slice(0, 3), frames: frames.length };
		if (res.word) {
			this.sentence.push(res.word);
			this.onEvent({ type: 'word', text: res.word, detail: { ...res, frames } });
		} else {
			// The movement goes along, so a correction can be learned from it.
			this.onEvent({ type: 'unknown', detail: { ...res, frames } });
		}
	}

	_finishSpelling() {
		if (!this.spelling) return;
		const word = this.spelling;
		this.spelling = '';
		this.lastLetter = null;
		this.sentence.push(word);
		this.onEvent({ type: 'spelled', text: word });
	}

	_handsDown(t) {
		if (this.downSince == null) this.downSince = t;
		const down = t - this.downSince;
		if (down >= this.opts.dropMs) {
			if (this.moving.length) this._endMovement();
			this._finishSpelling();
			this.lastPos = null;
			this.stillSince = null;
			this.letterCandidate = null;
		}
		if (down >= this.opts.sentenceMs && this.inSentence) {
			this.inSentence = false;
			if (this.sentence.length) {
				const text = this.sentence.join(' ');
				this.sentence = [];
				this.onEvent({ type: 'sentence', text });
			}
		}
	}
}
