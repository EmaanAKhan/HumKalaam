// Steps 2-3 of the pipeline: tokens -> sign lookup -> one animation clip.
//
// Each supported word is looked up in the combined lexicon (lexicon.js: the
// three.ws core signs plus Hum Kalaam's everyday signs). A word with a lexical
// sign is SIGNED; any other A-Z/0-9 word is FINGERSPELLED letter by letter with
// the manual alphabet, which is how ASL itself handles a word without a known
// sign. Nothing is ever substituted with a "similar" sign. Articles, forms of
// "to be" and "to", which ASL does not sign, are OMITTED and shown as such. Words the
// engine cannot represent at all are returned as UNSUPPORTED.
//
// The output clip targets the engine's canonical skeleton (Hips, RightHand,
// RightHandIndex1, ...); the avatar stage retargets it onto the loaded rig.

import { compileUtterance, scaledTiming } from '../vendor/three-ws/sign-speech.js';
import { findSign, lexiconLookup, omittedReason, vocabulary as allWords } from './lexicon.js';
import { tokenize } from './normalize.js';

export const SPEEDS = Object.freeze([0.5, 0.75, 1]);
export const MAX_SECONDS = 60;

/** Deduplicated, sorted list of every word form that has a lexical sign. */
export function vocabulary() {
	return allWords();
}

/** Plain-English description of a word's sign, or null when it has none. */
export function glossFor(word) {
	return findSign(word)?.sign.gloss ?? null;
}

/**
 * @param {string} text
 * @param {{ dominant?: 'Right'|'Left', rate?: number }} [opts]
 * @returns {{
 *   ok: boolean,
 *   message: string|null,
 *   items: Array<{
 *     raw: string, word: string|null,
 *     kind: 'signed'|'spelled'|'omitted'|'unsupported'|'cut',
 *     gloss: string|null, reason: string|null,
 *     start: number|null, end: number|null,
 *     letters: Array<{letter:string,start:number,end:number}>|null,
 *   }>,
 *   clip: object|null,
 *   duration: number,
 * }}
 */
export function planUtterance(text, { dominant = 'Right', rate = 1 } = {}) {
	if (!SPEEDS.includes(rate)) throw new Error(`unsupported rate ${rate}`);
	const side = dominant === 'Left' ? 'Left' : 'Right';
	const tokens = tokenize(text);

	const items = tokens.map((t) => {
		const omitted = t.supported ? omittedReason(t.word) : null;
		return {
			raw: t.raw,
			word: t.word,
			kind: !t.supported ? 'unsupported' : omitted ? 'omitted' : 'pending',
			gloss: null,
			reason: omitted ? `${omitted}, so this word is left out` : t.reason,
			start: null,
			end: null,
			letters: null,
		};
	});
	const performable = items.filter((i) => i.kind === 'pending');

	if (!tokens.length) {
		return { ok: false, message: 'Type a word or sentence first.', items, clip: null, duration: 0 };
	}
	if (!performable.length && items.some((i) => i.kind === 'omitted') && items.every((i) => i.kind !== 'unsupported')) {
		return { ok: false, message: 'These words are not signed in ASL (a, the, is, to…). Add a word with meaning.', items, clip: null, duration: 0 };
	}
	if (!performable.length) {
		return {
			ok: false,
			message: 'None of these words can be signed or fingerspelled. Only English letters A-Z and digits 0-9 are supported.',
			items,
			clip: null,
			duration: 0,
		};
	}

	const result = compileUtterance(performable.map((i) => i.word).join(' '), {
		signs: lexiconLookup({ dominant: side, rate }),
		timing: rate === 1 ? undefined : scaledTiming(rate),
		dominant: side,
		maxSeconds: MAX_SECONDS,
		name: 'hum-kalaam-utterance',
	});

	// compileUtterance performs words in order and stops early (truncated) when
	// the clip would pass MAX_SECONDS, so segments line up 1:1 with a prefix of
	// `performable`. Anything after that prefix was not performed.
	performable.forEach((item, i) => {
		const seg = result.segments[i];
		if (!seg) {
			item.kind = 'cut';
			item.reason = `not performed: the message is longer than ${MAX_SECONDS} seconds of signing`;
			return;
		}
		if (seg.word !== item.word) throw new Error(`segment mismatch: ${seg.word} vs ${item.word}`);
		item.kind = seg.signed ? 'signed' : 'spelled';
		item.gloss = seg.signed ? glossFor(seg.word) : null;
		item.start = seg.start;
		item.end = seg.end;
		item.letters = seg.letters;
	});

	return { ok: true, message: null, items, clip: result.clip, duration: result.clip.duration };
}
