// One lookup over every vocabulary: the three.ws core lexicon (vendored, left
// unchanged), Hum Kalaam's everyday signs (lexicon-daily.js, lexicon-daily-2.js)
// and the extra spellings of existing signs (lexicon-forms.js).
//
// Precedence: a Hum Kalaam sign or spelling wins; a core alias that maps a word
// to a DIFFERENT sign (LIKE -> GOOD, NEED -> WANT, ...) is dropped so the word is
// signed correctly or fingerspelled, never substituted; everything else falls
// through to the core lexicon.

import { SignTimeline, mirrorPhase, neutralPose, posePhase, restingPose } from '../vendor/three-ws/sign-clip.js';
import { DEFAULT_SIGN_TIMING, SIGNABLE_WORDS, SIGNS as CORE_SIGNS, lookupSign as coreLookup } from '../vendor/three-ws/sign-dictionary.js';
import { CORE_FIXES, DAILY_ALIASES, DAILY_SIGNS, OMITTED_WORDS, OVERRIDDEN_CORE_ALIASES } from './lexicon-daily.js';
import { DAILY_SIGNS_2 } from './lexicon-daily-2.js';
import { EXTRA_FORMS } from './lexicon-forms.js';

const OVERRIDDEN = new Set(OVERRIDDEN_CORE_ALIASES);

/** Every Hum Kalaam sign by name: part 1 and part 2. */
const HK_SIGNS = Object.freeze({ ...DAILY_SIGNS, ...DAILY_SIGNS_2 });

/** Word -> sign name, for every Hum Kalaam spelling (aliases, forms, extra forms). */
const HK_FORMS = (() => {
	const map = new Map(Object.entries(DAILY_ALIASES));
	for (const [name, sign] of Object.entries(DAILY_SIGNS_2)) for (const w of sign.forms ?? []) if (!map.has(w)) map.set(w, name);
	for (const [name, words] of Object.entries(EXTRA_FORMS)) for (const w of words) if (!map.has(w)) map.set(w, name);
	return map;
})();

const _fixed = new Map();
function fixedCore(name, sign, fix) {
	if (!_fixed.has(name)) _fixed.set(name, fix(sign));
	return _fixed.get(name);
}

/** A sign by its NAME (not a spelling), from whichever vocabulary has it. */
function signByName(name) {
	if (HK_SIGNS[name]) return { name, sign: HK_SIGNS[name], source: 'hum-kalaam' };
	const core = CORE_SIGNS[name];
	if (!core) return null;
	const fix = CORE_FIXES[name];
	return { name, sign: fix ? fixedCore(name, core, fix) : core, source: 'core' };
}

/**
 * @param {string} word
 * @returns {{ name: string, sign: { gloss: string, phases: object[] }, source: 'core'|'hum-kalaam' }|null}
 */
export function findSign(word) {
	const w = String(word ?? '').toUpperCase();
	if (HK_SIGNS[w]) return signByName(w);
	const target = HK_FORMS.get(w);
	if (target) return signByName(target);
	if (OVERRIDDEN.has(w)) return null;
	const core = coreLookup(w);
	return core ? signByName(core.name) : null;
}

/** Why a word is left out of the signing, or null when it is not. */
export function omittedReason(word) {
	return OMITTED_WORDS[String(word ?? '').toUpperCase()] ?? null;
}

/**
 * Compile one sign to a clip document. Same algorithm as the core
 * buildSignClip (sign-dictionary.js), applied to an entry from any lexicon.
 */
export function buildClip(word, opts = {}) {
	const found = findSign(word);
	if (!found) return null;
	const timing = { ...DEFAULT_SIGN_TIMING, ...opts };
	const rate = timing.rate > 0 ? timing.rate : 1;
	const base = opts.base ?? restingPose();
	const lead = opts.lead !== false;
	const tl = new SignTimeline({ base, open: lead ? base : neutralPose(base) });
	const dominant = opts.dominant === 'Left' ? 'Left' : 'Right';
	found.sign.phases.forEach((phase, i) => {
		const seconds = ((phase.t ?? 0.3) + (i === 0 && lead ? timing.leadSeconds : 0)) / rate;
		const shaped = dominant === 'Left' ? mirrorPhase(phase) : phase;
		tl.to(posePhase(shaped, base), seconds, { ease: phase.ease ?? (i === 0 ? 'out' : 'smooth') });
		if (phase.hold) tl.hold(phase.hold / rate);
	});
	if (opts.settle !== false) tl.settle(timing.tailSeconds / rate);
	return tl.build({
		name: opts.name ?? `sign-${found.name.toLowerCase()}`,
		seed: `sign:${found.source}:${found.name}:${rate}:${lead}:${opts.settle !== false}:${dominant}`,
	});
}

/** A `signs` lookup for compileUtterance, cached per word and position. */
export function lexiconLookup(opts = {}) {
	const cache = new Map();
	return (word, position = {}) => {
		const lead = position.first !== false;
		const settle = position.last !== false;
		const key = `${word}|${lead}|${settle}`;
		if (!cache.has(key)) cache.set(key, buildClip(word, { ...opts, lead, settle }));
		return cache.get(key);
	};
}

/** Every distinct sign (not counting other spellings), with its source. */
export function allSigns() {
	const out = new Map();
	for (const name of Object.keys(CORE_SIGNS)) out.set(name, signByName(name));
	for (const name of Object.keys(HK_SIGNS)) out.set(name, signByName(name));
	return out;
}

/** Every word that is signed (sign names plus all other spellings), sorted. */
export function vocabulary() {
	const words = new Set(Object.keys(HK_SIGNS));
	for (const w of HK_FORMS.keys()) words.add(w);
	for (const w of SIGNABLE_WORDS) if (findSign(w)) words.add(w);
	return [...words].sort();
}

/** Spellings that point at a sign name which does not exist (for tests). */
export function danglingForms() {
	return [...HK_FORMS.entries()].filter(([, name]) => !signByName(name)).map(([w, name]) => `${w} -> ${name}`);
}
