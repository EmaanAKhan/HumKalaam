// The camera's built-in vocabulary: 20 everyday words it recognises without
// any teaching. Matching a movement against 20 references instead of all 476
// signs is what makes it usable: on simulated signers (scripts/eval-core-words.mjs)
// these 20 are recognised 99% of the time at normal noise and 93% at 1.5x noise,
// against 84% and 62% when the same words are matched against every sign.
//
// The words were chosen for being useful AND for having signs whose movements
// are far apart: THANK, HUNGRY and GOOD all start at the chin and move down, so
// only THANK is in; HOME was confused with EAT, so it is out. The references
// come from the avatar's own sign definitions, not from recordings of people,
// so real-world accuracy is lower than the simulated numbers; teach mode still
// adds any word on top of these.

import { allTemplates } from './templates.js';

export const CORE_WORDS = Object.freeze([
	'HELLO', 'THANK', 'PLEASE', 'SORRY', 'YES', 'NO', 'HELP', 'WATER', 'EAT', 'SAD',
	'MORE', 'NAME', 'FRIEND', 'DOCTOR', 'GO', 'WANT', 'SICK', 'TIRED', 'UNDERSTAND', 'AGAIN',
]);

const CORE = new Set(CORE_WORDS);

/** Reference trajectories for the 20 core words only. */
export function coreTemplates(dominant = 'Right') {
	return allTemplates(dominant).filter((t) => CORE.has(t.name));
}
