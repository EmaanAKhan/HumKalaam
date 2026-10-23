// Hum Kalaam's everyday vocabulary: ASL signs added on top of the three.ws core
// lexicon (src/vendor/three-ws/sign-dictionary.js), in exactly the same
// anatomical notation: a handshape, a place on or in front of the body, the
// directions the fingers and palm face, and phases of movement between them.
// The engine's arm IK turns each phase into joint rotations, so nothing here is
// a hand-tuned joint angle and every sign retargets onto any rig.
//
// Source and status: each entry is written from the standard citation-form
// description of the ASL sign (as given in common ASL dictionaries). Like the
// three.ws core vocabulary, these are AUTHORED, NOT VALIDATED: they have not been
// reviewed by Deaf signers, and some movements (arcs, wiggles, twists) are
// approximated by a few key poses. The gloss of every entry says what the sign
// is meant to look like, so a reviewer who does not read code can check it.
//
// Conventions (measured on the reference rig, metres):
//   - chest contact: anchor 'sternum', forward ~0.13 (the chest surface)
//   - chin / mouth contact: anchor 'chin' / 'mouth', forward ~0.02
//   - temple: anchor 'forehead', out ~0.07, up ~-0.04
//   - neutral signing space: anchor 'sternum', forward ~0.26
//   - 'out' is toward the signing hand's side, 'in' toward the midline.

// ── helpers ────────────────────────────────────────────────────────────────

const at = (anchor, out = 0, up = 0, forward = 0) => ({ anchor, out, up, forward });
/** A point in neutral signing space in front of the chest. */
const sp = (out = 0.12, up = -0.02, forward = 0.26) => at('sternum', out, up, forward);
/** A hand held at a place. */
const H = (shape, where, fingers, palm, extra = {}) => ({ shape, at: where, fingers, palm, ...extra });
/** A hand making contact: `touch` is a body place ({to}) or the other hand ({on}). */
const T = (shape, touch, fingers, palm, extra = {}) => ({ shape, touch, fingers, palm, ...extra });
/** One phase: `t` seconds moving in, optional `hold`, plus hands/head/face. */
const P = (t, spec, hold = 0) => ({ t, ...spec, ...(hold ? { hold } : {}) });

const chest = (out = 0, up = 0, part = 'palm') => ({ to: 'sternum', part, out, up, forward: 0.13 });
const chin = (out = 0, up = 0, part = 'fingertips', forward = 0.02) => ({ to: 'chin', part, out, up, forward });
const mouth = (part = 'fingertips', out = 0, up = 0) => ({ to: 'mouth', part, out, up, forward: 0.03 });
const temple = (part = 'fingertips', up = -0.04) => ({ to: 'forehead', part, out: 0.075, up, forward: 0.0 });
const brow = (part = 'fingertips', out = 0.02) => ({ to: 'forehead', part, out, up: -0.02, forward: 0.085 });
const cheek = (part = 'fingertips', up = 0.03) => ({ to: 'chin', part, out: 0.06, up, forward: 0.0 });

// The non-dominant hand as a flat surface, palm up, in front of the chest.
const BASE_PALM = H('FLAT', sp(0.06, -0.09, 0.24), ['forward', 'in'], 'up');
// The non-dominant hand flat, palm facing the dominant side, fingers up.
const WALL_PALM = H('FLAT', sp(0.0, -0.02, 0.27), ['up', 'forward'], 'in');
// The non-dominant fist, palm down.
const BASE_FIST = H('S', sp(0.04, -0.08, 0.26), ['forward', 'in'], 'down');
// The non-dominant forearm lying across the body, hand flat, palm down.
const ARM_ACROSS = H('FLAT', sp(-0.02, -0.12, 0.27), ['in', 'forward'], 'down');
// The non-dominant index finger pointing up.
const BASE_INDEX = H('1', sp(0.04, -0.04, 0.27), 'up', 'in');

// Two taps: the same contact twice with a small release in between.
const tap2 = (open, contact, t = 0.16, hold = 0.12) => [P(0.3, open), P(t, contact), P(t, open), P(t, contact, hold)];

// ── the vocabulary ─────────────────────────────────────────────────────────

/** @type {Record<string, { gloss: string, phases: object[] }>} */
export const DAILY_SIGNS = Object.freeze({
	// People and pronouns
	MY: {
		gloss: 'Flat palm placed on the chest.',
		phases: [P(0.3, { right: T('FLAT', chest(0.02, -0.02), ['up', 'in'], 'back') }, 0.24)],
	},
	YOUR: {
		gloss: 'Flat palm pushes toward the person addressed.',
		phases: [P(0.3, { right: H('FLAT', sp(0.08, 0.0, 0.33), 'up', 'forward') }, 0.24)],
	},
	HE: {
		gloss: 'Index finger points to a person off to the side (he, she, it).',
		phases: [P(0.3, { right: H('1', sp(0.2, 0.0, 0.3), ['forward', 'out'], 'down') }, 0.24)],
	},
	THEY: {
		gloss: 'Index finger sweeps across the people being talked about.',
		phases: [
			P(0.28, { right: H('1', sp(0.02, 0.0, 0.33), 'forward', 'down') }),
			P(0.36, { right: H('1', sp(0.24, 0.0, 0.28), ['forward', 'out'], 'down') }, 0.16),
		],
	},
	WE: {
		gloss: 'Index finger touches one side of the chest, then arcs to the other.',
		phases: [
			P(0.3, { right: T('1', chest(0.09, 0.02, 'indextip'), ['back', 'in'], 'in') }),
			P(0.34, { right: T('1', chest(-0.09, 0.02, 'indextip'), ['back', 'out'], 'in') }, 0.16),
		],
	},
	OUR: {
		gloss: 'Cupped hand on one side of the chest arcs around to the other side.',
		phases: [
			P(0.3, { right: T('C', chest(0.1, 0.0, 'fingertips'), ['back', 'up'], 'in') }),
			P(0.34, { right: T('C', chest(-0.08, 0.0, 'fingertips'), ['back', 'up'], 'in') }, 0.16),
		],
	},
	MOTHER: {
		gloss: 'Open hand taps the thumb on the chin twice.',
		phases: tap2(
			{ right: H('5', at('chin', 0.03, -0.01, 0.13), 'up', 'in') },
			{ right: T('5', chin(0.0, 0.0, 'thumbtip'), 'up', 'in') },
		),
	},
	FATHER: {
		gloss: 'Open hand taps the thumb on the forehead twice.',
		phases: tap2(
			{ right: H('5', at('forehead', 0.03, -0.02, 0.14), 'up', 'in') },
			{ right: T('5', brow('thumbtip', 0.0), 'up', 'in') },
		),
	},
	SISTER: {
		gloss: 'L-hand thumb starts at the jaw, then comes down to rest on the other L-hand.',
		phases: [
			P(0.3, { right: T('L', cheek('thumbtip', 0.0), 'forward', 'in') }),
			P(0.32, { left: H('L', sp(0.06, -0.08, 0.27), ['forward', 'in'], 'down'), right: H('L', sp(0.07, -0.04, 0.29), ['forward', 'in'], 'down') }, 0.18),
		],
	},
	BROTHER: {
		gloss: 'L-hand thumb starts at the forehead, then comes down to rest on the other L-hand.',
		phases: [
			P(0.3, { right: T('L', { to: 'forehead', part: 'thumbtip', out: 0.065, up: -0.03, forward: 0.06 }, 'forward', 'in') }),
			P(0.34, { left: H('L', sp(0.06, -0.08, 0.27), ['forward', 'in'], 'down'), right: H('L', sp(0.07, -0.04, 0.29), ['forward', 'in'], 'down') }, 0.18),
		],
	},
	FAMILY: {
		gloss: 'Two F-hands, palms out, circle apart and meet again palms in.',
		phases: [
			P(0.3, { both: H('F', sp(0.05, 0.0, 0.3), 'up', 'forward') }),
			P(0.3, { both: H('F', sp(0.19, -0.02, 0.32), 'up', ['forward', 'in']) }),
			P(0.3, { both: H('F', sp(0.06, -0.04, 0.22), 'up', 'back') }, 0.16),
		],
	},
	BABY: {
		gloss: 'Arms cradle and rock, palms up.',
		phases: [
			P(0.32, { left: H('FLAT', sp(0.02, -0.18, 0.24), ['in', 'forward'], 'up'), right: H('FLAT', sp(-0.02, -0.13, 0.26), ['in', 'forward'], 'up') }),
			P(0.28, { left: H('FLAT', sp(-0.06, -0.16, 0.24), ['in', 'forward'], 'up'), right: H('FLAT', sp(-0.1, -0.11, 0.26), ['in', 'forward'], 'up') }),
			P(0.28, { left: H('FLAT', sp(0.08, -0.16, 0.24), ['in', 'forward'], 'up'), right: H('FLAT', sp(0.04, -0.11, 0.26), ['in', 'forward'], 'up') }, 0.12),
		],
	},
	CHILD: {
		gloss: 'Flat hand, palm down, pats the height of a small child.',
		phases: [
			P(0.32, { right: H('FLAT', at('belly', 0.2, -0.02, 0.26), ['forward', 'out'], 'down') }),
			P(0.16, { right: H('FLAT', at('belly', 0.2, -0.07, 0.26), ['forward', 'out'], 'down') }, 0.14),
		],
	},
	CHILDREN: {
		gloss: 'Flat hand, palm down, pats small heights moving outward.',
		phases: [
			P(0.32, { right: H('FLAT', at('belly', 0.1, -0.02, 0.28), ['forward', 'out'], 'down') }),
			P(0.16, { right: H('FLAT', at('belly', 0.1, -0.07, 0.28), ['forward', 'out'], 'down') }),
			P(0.2, { right: H('FLAT', at('belly', 0.24, -0.02, 0.26), ['forward', 'out'], 'down') }),
			P(0.16, { right: H('FLAT', at('belly', 0.24, -0.07, 0.26), ['forward', 'out'], 'down') }, 0.12),
		],
	},
	BOY: {
		gloss: 'Hand at the forehead closes like gripping a cap brim, twice.',
		phases: [
			P(0.3, { right: H('FLAT', at('forehead', 0.06, -0.01, 0.16), 'forward', 'down') }),
			P(0.16, { right: H('FLAT_O', at('forehead', 0.06, -0.01, 0.14), 'forward', 'down') }),
			P(0.16, { right: H('FLAT', at('forehead', 0.06, -0.01, 0.16), 'forward', 'down') }),
			P(0.16, { right: H('FLAT_O', at('forehead', 0.06, -0.01, 0.14), 'forward', 'down') }, 0.12),
		],
	},
	GIRL: {
		gloss: 'A-hand thumb strokes down along the jaw.',
		phases: [
			P(0.3, { right: T('A', cheek('thumbtip', 0.03), 'up', 'in') }),
			P(0.26, { right: T('A', chin(0.04, -0.02, 'thumbtip'), ['up', 'forward'], 'in') }, 0.16),
		],
	},
	MAN: {
		gloss: 'Open-hand thumb touches the forehead, then the chest.',
		phases: [
			P(0.3, { right: T('5', brow('thumbtip', 0.0), 'up', 'in') }),
			P(0.3, { right: T('5', chest(0.02, 0.02, 'thumbtip'), 'up', 'in') }, 0.16),
		],
	},
	WOMAN: {
		gloss: 'Open-hand thumb touches the chin, then the chest.',
		phases: [
			P(0.3, { right: T('5', chin(0.0, 0.0, 'thumbtip'), 'up', 'in') }),
			P(0.3, { right: T('5', chest(0.02, 0.02, 'thumbtip'), 'up', 'in') }, 0.16),
		],
	},
	PEOPLE: {
		gloss: 'Two P-hands circle forward alternately.',
		phases: [
			P(0.3, { left: H('P', sp(0.12, 0.02, 0.27), 'forward', 'down'), right: H('P', sp(0.12, -0.06, 0.3), 'forward', 'down') }),
			P(0.22, { left: H('P', sp(0.12, -0.06, 0.3), 'forward', 'down'), right: H('P', sp(0.12, 0.02, 0.27), 'forward', 'down') }),
			P(0.22, { left: H('P', sp(0.12, 0.02, 0.27), 'forward', 'down'), right: H('P', sp(0.12, -0.06, 0.3), 'forward', 'down') }, 0.12),
		],
	},
	DOCTOR: {
		gloss: 'Fingertips tap the inside of the other wrist, where the pulse is.',
		phases: tap2(
			{ left: BASE_PALM, right: H('M', sp(0.08, 0.0, 0.26), 'down', 'back') },
			{ left: BASE_PALM, right: T('M', { part: 'fingertips', on: 'wrist', up: 0.01 }, ['down', 'forward'], 'back') },
		),
	},
	TEACHER: {
		gloss: 'Flat-O hands at the temples push forward twice, then flat hands move down the sides (person).',
		phases: [
			P(0.3, { both: H('FLAT_O', at('forehead', 0.12, -0.04, 0.12), 'forward', 'in') }),
			P(0.18, { both: H('FLAT_O', at('forehead', 0.13, -0.05, 0.24), 'forward', 'in') }),
			P(0.18, { both: H('FLAT_O', at('forehead', 0.12, -0.04, 0.12), 'forward', 'in') }),
			P(0.18, { both: H('FLAT_O', at('forehead', 0.13, -0.05, 0.24), 'forward', 'in') }),
			P(0.28, { both: H('FLAT', sp(0.14, -0.02, 0.2), 'forward', 'in') }),
			P(0.28, { both: H('FLAT', sp(0.14, -0.26, 0.2), 'forward', 'in') }, 0.12),
		],
	},
	TEACH: {
		gloss: 'Flat-O hands at the temples push forward twice.',
		phases: [
			P(0.3, { both: H('FLAT_O', at('forehead', 0.12, -0.04, 0.12), 'forward', 'in') }),
			P(0.18, { both: H('FLAT_O', at('forehead', 0.13, -0.05, 0.24), 'forward', 'in') }),
			P(0.18, { both: H('FLAT_O', at('forehead', 0.12, -0.04, 0.12), 'forward', 'in') }),
			P(0.18, { both: H('FLAT_O', at('forehead', 0.13, -0.05, 0.24), 'forward', 'in') }, 0.14),
		],
	},
	STUDENT: {
		gloss: 'LEARN (fingers lift from the palm to the forehead), then flat hands move down the sides (person).',
		phases: [
			P(0.3, { left: BASE_PALM, right: T('CLAW', { part: 'fingertips', on: 'palm' }, 'down', 'back') }),
			P(0.32, { left: BASE_PALM, right: T('FLAT_O', { to: 'forehead', part: 'fingertips', out: 0.04, up: -0.03, forward: 0.08, gap: 0.02 }, ['up', 'back'], 'down') }),
			P(0.28, { both: H('FLAT', sp(0.14, -0.02, 0.2), 'forward', 'in') }),
			P(0.28, { both: H('FLAT', sp(0.14, -0.26, 0.2), 'forward', 'in') }, 0.12),
		],
	},
	POLICE: {
		gloss: 'C-hand taps the opposite side of the chest, like a badge.',
		phases: tap2(
			{ right: H('C', at('sternum', -0.1, 0.03, 0.2), 'up', 'in') },
			{ right: T('C', chest(-0.1, 0.03, 'thumbtip'), 'up', 'in') },
		),
	},

	// Questions
	WHO: {
		gloss: 'Index finger makes small circles in front of the lips, with furrowed brows.',
		phases: [
			P(0.3, { face: 'wh', right: H('1', at('mouth', 0.02, 0.0, 0.1), 'up', 'in') }),
			P(0.14, { face: 'wh', right: H('1', at('mouth', 0.04, 0.02, 0.1), 'up', 'in') }),
			P(0.14, { face: 'wh', right: H('1', at('mouth', 0.02, 0.03, 0.1), 'up', 'in') }),
			P(0.14, { face: 'wh', right: H('1', at('mouth', 0.0, 0.01, 0.1), 'up', 'in') }, 0.14),
		],
	},
	WHERE: {
		gloss: 'Upright index finger shakes side to side, with furrowed brows.',
		phases: [
			P(0.3, { face: 'wh', right: H('1', at('chin', 0.14, -0.08, 0.26), 'up', 'forward') }),
			P(0.14, { face: 'wh', right: H('1', at('chin', 0.19, -0.08, 0.26), ['up', 'out'], 'forward') }),
			P(0.14, { face: 'wh', right: H('1', at('chin', 0.11, -0.08, 0.26), ['up', 'in'], 'forward') }),
			P(0.14, { face: 'wh', right: H('1', at('chin', 0.17, -0.08, 0.26), ['up', 'out'], 'forward') }, 0.12),
		],
	},
	WHEN: {
		gloss: 'Index finger circles above the other index finger and lands on its tip.',
		phases: [
			P(0.3, { face: 'wh', left: BASE_INDEX, right: H('1', sp(0.1, 0.08, 0.28), ['forward', 'in'], 'down') }),
			P(0.2, { face: 'wh', left: BASE_INDEX, right: H('1', sp(0.0, 0.1, 0.32), ['forward', 'in'], 'down') }),
			P(0.24, { face: 'wh', left: BASE_INDEX, right: T('1', { part: 'indextip', on: 'indextip', up: 0.01 }, ['down', 'in'], 'in') }, 0.16),
		],
	},
	WHY: {
		gloss: 'Fingertips touch the forehead, then pull away into a Y-hand, with furrowed brows.',
		phases: [
			P(0.3, { face: 'wh', right: T('FLAT', brow('fingertips', 0.05), ['up', 'in'], 'back') }),
			P(0.3, { face: 'wh', right: H('Y', at('forehead', 0.1, -0.08, 0.24), 'up', 'back') }, 0.16),
		],
	},
	HOW: {
		gloss: 'Two bent hands, backs of the fingers together, roll forward to palms up.',
		phases: [
			P(0.3, { face: 'wh', both: H('BENT_B', sp(0.04, -0.04, 0.24), ['down', 'in'], 'back') }),
			P(0.3, { face: 'wh', both: H('BENT_B', sp(0.06, -0.02, 0.28), ['forward', 'in'], 'up') }, 0.16),
		],
	},
	WHICH: {
		gloss: 'Two A-hands, thumbs up, move up and down alternately.',
		phases: [
			P(0.3, { face: 'wh', left: H('A', sp(0.12, 0.03, 0.27), 'forward', 'in'), right: H('A', sp(0.12, -0.05, 0.27), 'forward', 'in') }),
			P(0.22, { face: 'wh', left: H('A', sp(0.12, -0.05, 0.27), 'forward', 'in'), right: H('A', sp(0.12, 0.03, 0.27), 'forward', 'in') }),
			P(0.22, { face: 'wh', left: H('A', sp(0.12, 0.03, 0.27), 'forward', 'in'), right: H('A', sp(0.12, -0.05, 0.27), 'forward', 'in') }, 0.12),
		],
	},
	QUESTION: {
		gloss: 'Index finger draws a question mark in the air.',
		phases: [
			P(0.3, { face: 'question', right: H('1', at('chin', 0.1, 0.0, 0.26), 'up', 'forward') }),
			P(0.18, { face: 'question', right: H('X', at('chin', 0.18, 0.02, 0.26), ['up', 'in'], 'forward') }),
			P(0.18, { face: 'question', right: H('X', at('chin', 0.17, -0.1, 0.27), ['up', 'in'], 'forward') }),
			P(0.18, { face: 'question', right: H('X', at('chin', 0.17, -0.18, 0.3), 'forward', 'down') }, 0.12),
		],
	},

	// Time
	NOW: {
		gloss: 'Both bent hands, palms up, drop slightly in front of the body.',
		phases: [
			P(0.3, { both: H('BENT_B', sp(0.13, 0.02, 0.27), 'forward', 'up') }),
			P(0.2, { both: H('BENT_B', sp(0.13, -0.06, 0.27), 'forward', 'up') }, 0.18),
		],
	},
	TODAY: {
		gloss: 'NOW (bent hands drop), then DAY (index arm arcs down across the other arm).',
		phases: [
			P(0.3, { both: H('BENT_B', sp(0.13, 0.02, 0.27), 'forward', 'up') }),
			P(0.18, { both: H('BENT_B', sp(0.13, -0.06, 0.27), 'forward', 'up') }),
			P(0.28, { left: ARM_ACROSS, right: H('1', sp(0.18, 0.1, 0.26), 'up', 'in') }),
			P(0.34, { left: ARM_ACROSS, right: H('1', sp(-0.02, -0.04, 0.28), ['in', 'up'], 'back') }, 0.12),
		],
	},
	DAY: {
		gloss: 'Index-finger forearm arcs down across the other forearm, like the sun crossing the sky.',
		phases: [
			P(0.3, { left: ARM_ACROSS, right: H('1', sp(0.18, 0.1, 0.26), 'up', 'in') }),
			P(0.36, { left: ARM_ACROSS, right: H('1', sp(-0.02, -0.04, 0.28), ['in', 'up'], 'back') }, 0.16),
		],
	},
	NIGHT: {
		gloss: 'Bent hand taps over the back of the other wrist, like the sun setting.',
		phases: tap2(
			{ left: ARM_ACROSS, right: H('BENT_B', sp(0.06, -0.02, 0.27), ['down', 'forward'], 'down') },
			{ left: ARM_ACROSS, right: T('BENT_B', { part: 'palm', on: 'back', out: 0.06, up: 0.02 }, ['down', 'forward'], 'down') },
		),
	},
	MORNING: {
		gloss: 'Flat hand, palm in, rises from the crook of the other arm, like the sun coming up.',
		phases: [
			P(0.3, { left: H('FLAT', sp(0.0, -0.14, 0.24), ['in', 'forward'], 'down'), right: H('FLAT', sp(0.12, -0.1, 0.3), ['forward', 'up'], 'back') }),
			P(0.34, { left: H('FLAT', sp(0.0, -0.14, 0.24), ['in', 'forward'], 'down'), right: H('FLAT', sp(0.13, 0.06, 0.28), 'up', 'back') }, 0.16),
		],
	},
	AFTERNOON: {
		gloss: 'Forearm angled forward rests on the other hand and bounces twice.',
		phases: [
			P(0.3, { left: ARM_ACROSS, right: H('FLAT', sp(0.12, 0.0, 0.32), ['forward', 'up'], 'down') }),
			P(0.16, { left: ARM_ACROSS, right: H('FLAT', sp(0.12, -0.03, 0.33), ['forward', 'up'], 'down') }),
			P(0.16, { left: ARM_ACROSS, right: H('FLAT', sp(0.12, 0.0, 0.32), ['forward', 'up'], 'down') }),
			P(0.16, { left: ARM_ACROSS, right: H('FLAT', sp(0.12, -0.03, 0.33), ['forward', 'up'], 'down') }, 0.12),
		],
	},
	TOMORROW: {
		gloss: 'A-hand thumb at the cheek moves forward.',
		phases: [
			P(0.3, { right: T('A', cheek('thumbtip', 0.02), 'up', 'in') }),
			P(0.3, { right: H('A', at('chin', 0.1, 0.0, 0.18), ['up', 'forward'], 'in') }, 0.16),
		],
	},
	YESTERDAY: {
		gloss: 'A-hand thumb at the cheek moves back toward the ear.',
		phases: [
			P(0.3, { right: T('A', cheek('thumbtip', 0.0), 'up', 'in') }),
			P(0.3, { right: T('A', { to: 'chin', part: 'thumbtip', out: 0.07, up: 0.05, forward: -0.03, gap: 0.01 }, ['up', 'back'], 'in') }, 0.16),
		],
	},
	TIME: {
		gloss: 'Index finger taps the back of the other wrist, where a watch is.',
		phases: tap2(
			{ left: BASE_FIST, right: H('X', sp(0.06, 0.02, 0.27), ['forward', 'in'], 'down') },
			{ left: BASE_FIST, right: T('X', { part: 'indextip', on: 'back', out: -0.03 }, ['down', 'in'], 'down') },
		),
	},
	WEEK: {
		gloss: 'Index finger slides across the other flat palm.',
		phases: [
			P(0.3, { left: BASE_PALM, right: T('1', { part: 'palm', on: 'palm', out: -0.06 }, ['forward', 'in'], 'down') }),
			P(0.32, { left: BASE_PALM, right: T('1', { part: 'palm', on: 'palm', out: 0.1 }, ['forward', 'in'], 'down') }, 0.14),
		],
	},
	MONTH: {
		gloss: 'Index finger slides down the back of the other upright index finger.',
		phases: [
			P(0.3, { left: BASE_INDEX, right: T('1', { part: 'indextip', on: 'indextip', out: 0.02 }, 'in', 'back') }),
			P(0.3, { left: BASE_INDEX, right: T('1', { part: 'indextip', on: 'wrist', out: 0.02, up: 0.03 }, 'in', 'back') }, 0.14),
		],
	},
	YEAR: {
		gloss: 'One fist circles around the other and lands on top of it.',
		phases: [
			P(0.3, { left: BASE_FIST, right: H('S', sp(0.08, 0.06, 0.24), ['forward', 'in'], 'down') }),
			P(0.2, { left: BASE_FIST, right: H('S', sp(0.0, -0.02, 0.36), ['forward', 'in'], 'down') }),
			P(0.2, { left: BASE_FIST, right: H('S', sp(0.08, -0.14, 0.26), ['forward', 'in'], 'down') }),
			P(0.22, { left: BASE_FIST, right: T('S', { part: 'palm', on: 'back', up: 0.03 }, ['forward', 'in'], 'down') }, 0.14),
		],
	},
	LATER: {
		gloss: 'L-hand thumb on the other palm, index finger tips forward and down.',
		phases: [
			P(0.3, { left: WALL_PALM, right: T('L', { part: 'thumbtip', on: 'palm' }, 'up', 'forward') }),
			P(0.26, { left: WALL_PALM, right: T('L', { part: 'thumbtip', on: 'palm' }, ['forward', 'down'], 'down') }, 0.16),
		],
	},
	BEFORE: {
		gloss: 'Back of the hand moves from the other palm back toward the body.',
		phases: [
			P(0.3, { left: H('FLAT', sp(0.0, -0.02, 0.34), 'up', 'back'), right: H('FLAT', sp(0.02, -0.02, 0.3), 'up', 'back') }),
			P(0.3, { left: H('FLAT', sp(0.0, -0.02, 0.34), 'up', 'back'), right: H('FLAT', sp(0.04, -0.02, 0.18), 'up', 'back') }, 0.14),
		],
	},
	AFTER: {
		gloss: 'Flat hand moves forward off the back of the other hand.',
		phases: [
			P(0.3, { left: H('FLAT', sp(0.02, -0.06, 0.24), 'in', 'back'), right: T('FLAT', { part: 'palm', on: 'back', out: 0.0 }, ['in', 'forward'], 'back') }),
			P(0.3, { left: H('FLAT', sp(0.02, -0.06, 0.24), 'in', 'back'), right: H('FLAT', sp(0.04, -0.06, 0.38), ['in', 'forward'], 'back') }, 0.14),
		],
	},
	ALWAYS: {
		gloss: 'Index finger, pointing up and forward, circles continuously.',
		phases: [
			P(0.3, { right: H('1', sp(0.14, 0.04, 0.3), ['up', 'forward'], 'up') }),
			P(0.18, { right: H('1', sp(0.19, 0.0, 0.3), ['up', 'forward'], 'up') }),
			P(0.18, { right: H('1', sp(0.14, -0.04, 0.3), ['up', 'forward'], 'up') }),
			P(0.18, { right: H('1', sp(0.09, 0.0, 0.3), ['up', 'forward'], 'up') }),
			P(0.18, { right: H('1', sp(0.14, 0.04, 0.3), ['up', 'forward'], 'up') }, 0.1),
		],
	},
	NEVER: {
		gloss: 'Flat hand, palm out, zigzags down beside the face.',
		phases: [
			P(0.3, { face: 'negate', right: H('FLAT', at('chin', 0.14, 0.02, 0.22), 'up', 'in') }),
			P(0.2, { face: 'negate', right: H('FLAT', at('chin', 0.2, -0.04, 0.22), 'up', 'forward') }),
			P(0.2, { face: 'negate', right: H('FLAT', at('chin', 0.14, -0.1, 0.24), 'up', 'in') }),
			P(0.2, { face: 'negate', right: H('FLAT', at('chin', 0.22, -0.2, 0.26), ['up', 'out'], 'forward') }, 0.12),
		],
	},
	SOON: {
		gloss: 'F-hand fingertips brush down across the chin.',
		phases: [
			P(0.3, { right: T('F', chin(0.02, 0.02, 'thumbtip'), 'up', 'back') }),
			P(0.2, { right: T('F', chin(0.02, -0.02, 'thumbtip', 0.04), 'up', 'back') }, 0.16),
		],
	},
	WAIT: {
		gloss: 'Both open hands, palms up, one behind the other, fingers wiggle.',
		phases: [
			P(0.3, { left: H('5', sp(0.1, -0.04, 0.34), ['forward', 'out'], 'up'), right: H('5', sp(0.18, -0.06, 0.2), ['forward', 'out'], 'up') }),
			P(0.14, { left: H('CLAW', sp(0.1, -0.04, 0.34), ['forward', 'out'], 'up'), right: H('CLAW', sp(0.18, -0.06, 0.2), ['forward', 'out'], 'up') }),
			P(0.14, { left: H('5', sp(0.1, -0.04, 0.34), ['forward', 'out'], 'up'), right: H('5', sp(0.18, -0.06, 0.2), ['forward', 'out'], 'up') }),
			P(0.14, { left: H('CLAW', sp(0.1, -0.04, 0.34), ['forward', 'out'], 'up'), right: H('CLAW', sp(0.18, -0.06, 0.2), ['forward', 'out'], 'up') }, 0.1),
		],
	},
	MINUTE: {
		gloss: 'Index finger against the other flat palm ticks forward like a clock hand.',
		phases: [
			P(0.3, { left: WALL_PALM, right: T('1', { part: 'edge', on: 'palm' }, 'up', 'in') }),
			P(0.22, { left: WALL_PALM, right: T('1', { part: 'edge', on: 'palm' }, ['up', 'forward'], 'in') }, 0.14),
		],
	},
	HOUR: {
		gloss: 'Index finger against the other flat palm turns a full circle.',
		phases: [
			P(0.3, { left: WALL_PALM, right: T('1', { part: 'edge', on: 'palm' }, 'up', 'in') }),
			P(0.18, { left: WALL_PALM, right: T('1', { part: 'edge', on: 'palm' }, 'forward', 'in') }),
			P(0.18, { left: WALL_PALM, right: T('1', { part: 'edge', on: 'palm' }, 'down', 'in') }),
			P(0.18, { left: WALL_PALM, right: T('1', { part: 'edge', on: 'palm' }, 'back', 'in') }),
			P(0.18, { left: WALL_PALM, right: T('1', { part: 'edge', on: 'palm' }, 'up', 'in') }, 0.1),
		],
	},
	LATE: {
		gloss: 'Flat hand, palm back, flaps back and forth at the side.',
		phases: [
			P(0.3, { right: H('FLAT', at('belly', 0.24, -0.02, 0.08), 'down', 'back') }),
			P(0.16, { right: H('FLAT', at('belly', 0.24, -0.02, 0.02), ['down', 'back'], 'back') }),
			P(0.16, { right: H('FLAT', at('belly', 0.24, -0.02, 0.08), 'down', 'back') }),
			P(0.16, { right: H('FLAT', at('belly', 0.24, -0.02, 0.02), ['down', 'back'], 'back') }, 0.12),
		],
	},
	READY: {
		gloss: 'Two R-hands, palms down, move across to the side.',
		phases: [
			P(0.3, { both: H('R', sp(0.06, -0.04, 0.27), 'forward', 'down') }),
			P(0.3, { left: H('R', sp(-0.06, -0.04, 0.27), 'forward', 'down'), right: H('R', sp(0.22, -0.04, 0.27), 'forward', 'down') }, 0.14),
		],
	},
	START: {
		gloss: 'Index finger between the fingers of the other hand twists once.',
		phases: [
			P(0.3, { left: H('V', sp(0.03, -0.06, 0.27), ['forward', 'in'], 'out'), right: T('1', { part: 'indextip', on: 'fingers', out: 0.0 }, ['forward', 'in'], 'down') }),
			P(0.24, { left: H('V', sp(0.03, -0.06, 0.27), ['forward', 'in'], 'out'), right: T('1', { part: 'indextip', on: 'fingers', out: 0.0 }, ['forward', 'in'], 'up') }, 0.14),
		],
	},

	// Food and drink
	EAT: {
		gloss: 'Flat-O fingertips tap the mouth twice (eat, food).',
		phases: tap2(
			{ right: H('FLAT_O', at('mouth', 0.03, -0.01, 0.1), ['back', 'up'], 'back') },
			{ right: T('FLAT_O', mouth('fingertips'), ['back', 'up'], 'back') },
		),
	},
	DRINK: {
		gloss: 'C-hand tips up toward the mouth, like a glass.',
		phases: [
			P(0.3, { right: H('C', at('chin', 0.03, -0.06, 0.12), 'up', 'in') }),
			P(0.28, { right: H('C', at('chin', 0.03, -0.01, 0.13), ['up', 'back'], 'in') }, 0.16),
		],
	},
	WATER: {
		gloss: 'W-hand index finger taps the chin twice.',
		phases: tap2(
			{ right: H('W', at('chin', 0.03, -0.02, 0.17), 'up', 'in') },
			{ right: T('W', chin(0.02, 0.0, 'indextip'), ['up', 'back'], 'in') },
		),
	},
	MILK: {
		gloss: 'C-hand squeezes into a fist twice, like milking.',
		phases: [
			P(0.3, { right: H('C', sp(0.14, -0.04, 0.27), 'up', 'in') }),
			P(0.16, { right: H('S', sp(0.14, -0.06, 0.27), 'up', 'in') }),
			P(0.16, { right: H('C', sp(0.14, -0.04, 0.27), 'up', 'in') }),
			P(0.16, { right: H('S', sp(0.14, -0.06, 0.27), 'up', 'in') }, 0.12),
		],
	},
	TEA: {
		gloss: 'F-hand fingertips stir inside the other O-hand, like a tea bag.',
		phases: [
			P(0.3, { left: H('O', sp(0.04, -0.1, 0.26), ['forward', 'in'], 'in'), right: H('F', sp(0.05, -0.02, 0.27), 'down', 'in') }),
			P(0.16, { left: H('O', sp(0.04, -0.1, 0.26), ['forward', 'in'], 'in'), right: H('F', sp(0.07, -0.03, 0.29), 'down', 'in') }),
			P(0.16, { left: H('O', sp(0.04, -0.1, 0.26), ['forward', 'in'], 'in'), right: H('F', sp(0.03, -0.03, 0.28), 'down', 'in') }),
			P(0.16, { left: H('O', sp(0.04, -0.1, 0.26), ['forward', 'in'], 'in'), right: H('F', sp(0.05, -0.02, 0.27), 'down', 'in') }, 0.1),
		],
	},
	COFFEE: {
		gloss: 'One fist grinds in circles on top of the other fist.',
		phases: [
			P(0.3, { left: H('S', sp(0.04, -0.12, 0.26), ['forward', 'in'], 'in'), right: H('S', sp(0.04, -0.03, 0.26), ['forward', 'in'], 'in') }),
			P(0.18, { left: H('S', sp(0.04, -0.12, 0.26), ['forward', 'in'], 'in'), right: H('S', sp(0.07, -0.03, 0.29), ['forward', 'in'], 'in') }),
			P(0.18, { left: H('S', sp(0.04, -0.12, 0.26), ['forward', 'in'], 'in'), right: H('S', sp(0.02, -0.03, 0.29), ['forward', 'in'], 'in') }),
			P(0.18, { left: H('S', sp(0.04, -0.12, 0.26), ['forward', 'in'], 'in'), right: H('S', sp(0.04, -0.03, 0.26), ['forward', 'in'], 'in') }, 0.1),
		],
	},
	BREAD: {
		gloss: 'Bent fingers slice down the back of the other hand, like cutting a loaf.',
		phases: [
			P(0.3, { left: H('FLAT', sp(0.02, -0.04, 0.24), 'in', 'back'), right: T('BENT_B', { part: 'fingertips', on: 'back', up: 0.04 }, ['down', 'back'], 'back') }),
			P(0.18, { left: H('FLAT', sp(0.02, -0.04, 0.24), 'in', 'back'), right: T('BENT_B', { part: 'fingertips', on: 'back', up: -0.04 }, ['down', 'back'], 'back') }),
			P(0.18, { left: H('FLAT', sp(0.02, -0.04, 0.24), 'in', 'back'), right: T('BENT_B', { part: 'fingertips', on: 'back', up: 0.04, out: 0.03 }, ['down', 'back'], 'back') }),
			P(0.18, { left: H('FLAT', sp(0.02, -0.04, 0.24), 'in', 'back'), right: T('BENT_B', { part: 'fingertips', on: 'back', up: -0.04, out: 0.03 }, ['down', 'back'], 'back') }, 0.1),
		],
	},
	HUNGRY: {
		gloss: 'C-hand moves down the chest toward the stomach.',
		phases: [
			P(0.3, { right: T('C', chest(0.0, 0.03, 'fingertips'), 'in', 'back') }),
			P(0.32, { right: T('C', { to: 'belly', part: 'fingertips', out: 0.0, up: 0.04, forward: 0.13 }, 'in', 'back') }, 0.16),
		],
	},
	THIRSTY: {
		gloss: 'Index finger traces down the throat.',
		phases: [
			P(0.3, { right: T('1', { to: 'chin', part: 'indextip', out: 0.0, up: -0.04, forward: 0.01 }, ['back', 'in'], 'down') }),
			P(0.3, { right: T('1', { to: 'neck', part: 'indextip', out: 0.0, up: -0.04, forward: 0.07 }, ['back', 'in'], 'down') }, 0.16),
		],
	},
	APPLE: {
		gloss: 'X-hand knuckle twists on the cheek.',
		phases: [
			P(0.3, { right: T('X', cheek('knuckles', 0.02), ['up', 'in'], 'back') }),
			P(0.2, { right: T('X', cheek('knuckles', 0.02), ['forward', 'in'], 'down') }),
			P(0.2, { right: T('X', cheek('knuckles', 0.02), ['up', 'in'], 'back') }, 0.12),
		],
	},
	SWEET: {
		gloss: 'Fingertips brush down off the chin twice.',
		phases: [
			P(0.3, { right: T('FLAT', chin(0.0, 0.02), ['up', 'in'], 'back') }),
			P(0.16, { right: H('FLAT', at('chin', 0.02, -0.06, 0.08), ['up', 'in'], 'back') }),
			P(0.16, { right: T('FLAT', chin(0.0, 0.02), ['up', 'in'], 'back') }),
			P(0.16, { right: H('FLAT', at('chin', 0.02, -0.06, 0.08), ['up', 'in'], 'back') }, 0.12),
		],
	},
	COOK: {
		gloss: 'Flat hand on the other palm flips over and back, like turning food in a pan.',
		phases: [
			P(0.3, { left: BASE_PALM, right: T('FLAT', { part: 'palm', on: 'palm' }, ['forward', 'in'], 'down') }),
			P(0.2, { left: BASE_PALM, right: T('FLAT', { part: 'back', on: 'palm' }, ['forward', 'in'], 'up') }),
			P(0.2, { left: BASE_PALM, right: T('FLAT', { part: 'palm', on: 'palm' }, ['forward', 'in'], 'down') }, 0.12),
		],
	},
	// Places and things
	HOME: {
		gloss: 'Flat-O fingertips touch the cheek near the mouth, then near the ear.',
		phases: [
			P(0.3, { right: T('FLAT_O', { to: 'mouth', part: 'fingertips', out: 0.04, up: 0.0, forward: 0.03 }, ['back', 'in'], 'down') }),
			P(0.28, { right: T('FLAT_O', { to: 'chin', part: 'fingertips', out: 0.07, up: 0.05, forward: 0.01 }, ['back', 'in'], 'down') }, 0.16),
		],
	},
	HOUSE: {
		gloss: 'Both flat hands outline a roof, then the walls.',
		phases: [
			P(0.3, { both: H('FLAT', sp(0.04, 0.12, 0.28), ['up', 'in'], ['in', 'down']) }),
			P(0.26, { both: H('FLAT', sp(0.16, 0.0, 0.28), ['up', 'in'], ['in', 'down']) }),
			P(0.26, { both: H('FLAT', sp(0.16, -0.18, 0.28), 'up', 'in') }, 0.14),
		],
	},
	SCHOOL: {
		gloss: 'Flat hand claps down on the other palm twice.',
		phases: tap2(
			{ left: BASE_PALM, right: H('FLAT', sp(0.06, 0.04, 0.24), ['forward', 'in'], 'down') },
			{ left: BASE_PALM, right: T('FLAT', { part: 'palm', on: 'palm' }, ['forward', 'in'], 'down') },
		),
	},
	HOSPITAL: {
		gloss: 'H-fingers draw a cross on the opposite upper arm.',
		phases: [
			P(0.3, { right: T('H', { to: 'sternum', part: 'fingertips', out: -0.2, up: 0.02, forward: 0.06 }, ['back', 'in'], 'down') }),
			P(0.2, { right: T('H', { to: 'sternum', part: 'fingertips', out: -0.2, up: -0.06, forward: 0.06 }, ['back', 'in'], 'down') }),
			P(0.2, { right: T('H', { to: 'sternum', part: 'fingertips', out: -0.24, up: -0.02, forward: 0.06 }, ['back', 'in'], 'down') }),
			P(0.2, { right: T('H', { to: 'sternum', part: 'fingertips', out: -0.16, up: -0.02, forward: 0.06 }, ['back', 'in'], 'down') }, 0.12),
		],
	},
	STORE: {
		gloss: 'Both flat-O hands, fingers down, flick forward twice.',
		phases: [
			P(0.3, { both: H('FLAT_O', sp(0.12, -0.04, 0.26), 'down', 'back') }),
			P(0.16, { both: H('FLAT_O', sp(0.12, -0.04, 0.3), ['down', 'forward'], 'back') }),
			P(0.16, { both: H('FLAT_O', sp(0.12, -0.04, 0.26), 'down', 'back') }),
			P(0.16, { both: H('FLAT_O', sp(0.12, -0.04, 0.3), ['down', 'forward'], 'back') }, 0.12),
		],
	},
	BATHROOM: {
		gloss: 'T-hand shakes side to side.',
		phases: [
			P(0.3, { right: H('T', sp(0.16, 0.0, 0.28), 'up', 'forward') }),
			P(0.14, { right: H('T', sp(0.19, 0.0, 0.28), ['up', 'out'], 'forward') }),
			P(0.14, { right: H('T', sp(0.13, 0.0, 0.28), ['up', 'in'], 'forward') }),
			P(0.14, { right: H('T', sp(0.17, 0.0, 0.28), 'up', 'forward') }, 0.12),
		],
	},
	ROOM: {
		gloss: 'Flat hands facing each other, then turned to face front and back: the four walls.',
		phases: [
			P(0.3, { both: H('FLAT', sp(0.14, -0.04, 0.27), 'forward', 'in') }),
			P(0.3, { left: H('FLAT', sp(0.0, -0.04, 0.36), ['in', 'forward'], 'back'), right: H('FLAT', sp(0.0, -0.04, 0.2), ['in', 'forward'], 'forward') }, 0.14),
		],
	},
	CAR: {
		gloss: 'Both fists hold and turn a steering wheel.',
		phases: [
			P(0.3, { left: H('S', sp(0.12, 0.0, 0.3), ['forward', 'up'], 'in'), right: H('S', sp(0.12, 0.0, 0.3), ['forward', 'up'], 'in') }),
			P(0.24, { left: H('S', sp(0.12, -0.05, 0.3), ['forward', 'up'], 'in'), right: H('S', sp(0.12, 0.05, 0.3), ['forward', 'up'], 'in') }),
			P(0.24, { left: H('S', sp(0.12, 0.05, 0.3), ['forward', 'up'], 'in'), right: H('S', sp(0.12, -0.05, 0.3), ['forward', 'up'], 'in') }, 0.12),
		],
	},
	HERE: {
		gloss: 'Both flat hands, palms up, circle in front of the body.',
		phases: [
			P(0.3, { both: H('FLAT', sp(0.12, -0.08, 0.28), ['forward', 'out'], 'up') }),
			P(0.2, { both: H('FLAT', sp(0.18, -0.08, 0.3), ['forward', 'out'], 'up') }),
			P(0.2, { both: H('FLAT', sp(0.1, -0.08, 0.32), ['forward', 'out'], 'up') }, 0.14),
		],
	},
	THERE: {
		gloss: 'Index finger points to a place out in front.',
		phases: [P(0.3, { right: H('1', sp(0.18, 0.04, 0.36), ['forward', 'out', 'up'], 'down') }, 0.24)],
	},
	MONEY: {
		gloss: 'Flat-O hand taps the other palm twice.',
		phases: tap2(
			{ left: BASE_PALM, right: H('FLAT_O', sp(0.06, 0.02, 0.24), 'down', 'back') },
			{ left: BASE_PALM, right: T('FLAT_O', { part: 'fingertips', on: 'palm' }, 'down', 'back') },
		),
	},
	PHONE: {
		gloss: 'Y-hand held at the side of the face like a telephone.',
		phases: [P(0.32, { right: T('Y', { to: 'chin', part: 'wrist', out: 0.11, up: 0.02, forward: -0.03, gap: 0.03 }, ['up', 'back'], 'in') }, 0.3)],
	},
	BOOK: {
		gloss: 'Flat hands, palms together, open like a book.',
		phases: [
			P(0.3, { both: H('FLAT', sp(0.04, -0.04, 0.28), 'forward', 'in') }),
			P(0.3, { both: H('FLAT', sp(0.1, -0.06, 0.28), ['forward', 'out'], 'up') }, 0.16),
		],
	},
	DOOR: {
		gloss: 'Two flat hands side by side; one swings open like a door, twice.',
		phases: [
			P(0.3, { both: H('FLAT', sp(0.05, 0.0, 0.3), 'up', 'forward') }),
			P(0.18, { left: H('FLAT', sp(0.05, 0.0, 0.3), 'up', 'forward'), right: H('FLAT', sp(0.08, 0.0, 0.24), ['up', 'back'], 'in') }),
			P(0.18, { both: H('FLAT', sp(0.05, 0.0, 0.3), 'up', 'forward') }),
			P(0.18, { left: H('FLAT', sp(0.05, 0.0, 0.3), 'up', 'forward'), right: H('FLAT', sp(0.08, 0.0, 0.24), ['up', 'back'], 'in') }, 0.12),
		],
	},
	MEDICINE: {
		gloss: 'Middle finger rubs a small circle in the other palm, like grinding a pill.',
		phases: [
			P(0.3, { left: BASE_PALM, right: T('OPEN_8', { part: 'middletip', on: 'palm', out: 0.01 }, ['down', 'forward'], 'down') }),
			P(0.16, { left: BASE_PALM, right: T('OPEN_8', { part: 'middletip', on: 'palm', out: 0.03, forward: 0.02 }, ['down', 'forward'], 'down') }),
			P(0.16, { left: BASE_PALM, right: T('OPEN_8', { part: 'middletip', on: 'palm', out: 0.0, forward: 0.03 }, ['down', 'forward'], 'down') }),
			P(0.16, { left: BASE_PALM, right: T('OPEN_8', { part: 'middletip', on: 'palm', out: 0.01 }, ['down', 'forward'], 'down') }, 0.1),
		],
	},
	CLOTHES: {
		gloss: 'Open hands brush down the chest twice.',
		phases: [
			P(0.3, { both: T('5', { to: 'sternum', part: 'fingertips', out: 0.1, up: 0.04, forward: 0.13 }, ['in', 'down'], 'back') }),
			P(0.18, { both: T('5', { to: 'sternum', part: 'fingertips', out: 0.1, up: -0.08, forward: 0.14 }, ['in', 'down'], 'back') }),
			P(0.18, { both: T('5', { to: 'sternum', part: 'fingertips', out: 0.1, up: 0.04, forward: 0.13 }, ['in', 'down'], 'back') }),
			P(0.18, { both: T('5', { to: 'sternum', part: 'fingertips', out: 0.1, up: -0.08, forward: 0.14 }, ['in', 'down'], 'back') }, 0.1),
		],
	},
	BED: {
		gloss: 'Flat hand against the cheek, head tilted onto it, like a pillow.',
		phases: [P(0.34, { right: T('FLAT', { to: 'chin', part: 'palm', out: 0.08, up: 0.04, forward: -0.01, gap: 0.01 }, ['up', 'back'], 'in'), head: { tilt: 10 } }, 0.3)],
	},

	// Actions
	GO: {
		gloss: 'Both index fingers arc forward, away from the body.',
		phases: [
			P(0.3, { both: H('1', sp(0.12, 0.02, 0.22), 'up', 'forward') }),
			P(0.3, { both: H('1', sp(0.14, -0.02, 0.4), ['forward', 'up'], 'down') }, 0.14),
		],
	},
	COME: {
		gloss: 'Both index fingers beckon in toward the body.',
		phases: [
			P(0.3, { both: H('1', sp(0.12, -0.02, 0.38), ['forward', 'up'], 'up') }),
			P(0.3, { both: H('1', sp(0.1, 0.02, 0.2), ['up', 'back'], 'back') }, 0.14),
		],
	},
	SIT: {
		gloss: 'Two bent fingers sit down on the other two fingers.',
		phases: [
			P(0.3, { left: H('H', sp(0.04, -0.08, 0.27), ['forward', 'in'], 'down'), right: H('H', sp(0.05, 0.0, 0.27), ['forward', 'in'], 'down') }),
			P(0.22, { left: H('H', sp(0.04, -0.08, 0.27), ['forward', 'in'], 'down'), right: T('H', { part: 'fingers', on: 'back', up: 0.0 }, ['forward', 'in', 'down'], 'down') }, 0.18),
		],
	},
	STAND: {
		gloss: 'Two fingers (legs) stand on the other flat palm.',
		phases: [
			P(0.3, { left: BASE_PALM, right: H('V', sp(0.06, 0.06, 0.24), 'down', 'back') }),
			P(0.24, { left: BASE_PALM, right: T('V', { part: 'fingertips', on: 'palm' }, 'down', 'back') }, 0.22),
		],
	},
	SLEEP: {
		gloss: 'Open hand in front of the face draws down and closes, eyes shutting.',
		phases: [
			P(0.3, { right: H('5', at('nose', 0.02, 0.04, 0.14), 'up', 'back'), head: { tilt: 3 } }),
			P(0.34, { right: H('FLAT_O', at('chin', 0.02, -0.02, 0.12), ['up', 'in'], 'back'), head: { tilt: 8, nod: 6 } }, 0.2),
		],
	},
	WAKE: {
		gloss: 'Pinched fingers at the corners of the eyes spring open.',
		phases: [
			P(0.3, { both: H('FLAT_O', at('nose', 0.06, 0.02, 0.08), ['in', 'up'], 'forward') }),
			P(0.2, { both: H('L', at('nose', 0.07, 0.03, 0.09), ['in', 'up'], 'forward') }, 0.18),
		],
	},
	SHOWER: {
		gloss: 'O-hand above the head opens downward twice, like water spraying.',
		phases: [
			P(0.3, { right: H('O', at('forehead', 0.08, 0.14, 0.06), 'down', 'back') }),
			P(0.14, { right: H('5', at('forehead', 0.08, 0.13, 0.06), 'down', 'back') }),
			P(0.14, { right: H('O', at('forehead', 0.08, 0.14, 0.06), 'down', 'back') }),
			P(0.14, { right: H('5', at('forehead', 0.08, 0.13, 0.06), 'down', 'back') }, 0.12),
		],
	},
	BATH: {
		gloss: 'Both fists scrub up and down the chest.',
		phases: [
			P(0.3, { both: T('A', { to: 'sternum', part: 'knuckles', out: 0.08, up: 0.02, forward: 0.14 }, 'up', 'back') }),
			P(0.18, { both: T('A', { to: 'sternum', part: 'knuckles', out: 0.08, up: -0.06, forward: 0.14 }, 'up', 'back') }),
			P(0.18, { both: T('A', { to: 'sternum', part: 'knuckles', out: 0.08, up: 0.02, forward: 0.14 }, 'up', 'back') }, 0.1),
		],
	},
	PLAY: {
		gloss: 'Both Y-hands shake by twisting at the wrists.',
		phases: [
			P(0.3, { both: H('Y', sp(0.16, -0.02, 0.28), 'up', 'back') }),
			P(0.14, { both: H('Y', sp(0.16, -0.02, 0.28), ['up', 'in'], 'back') }),
			P(0.14, { both: H('Y', sp(0.16, -0.02, 0.28), ['up', 'out'], 'back') }),
			P(0.14, { both: H('Y', sp(0.16, -0.02, 0.28), ['up', 'in'], 'back') }, 0.1),
		],
	},
	READ: {
		gloss: 'V-hand (the eyes) scans down the other flat palm.',
		phases: [
			P(0.3, { left: WALL_PALM, right: H('V', sp(0.1, 0.06, 0.3), ['down', 'in'], 'in') }),
			P(0.36, { left: WALL_PALM, right: H('V', sp(0.1, -0.08, 0.3), ['down', 'in'], 'in') }, 0.12),
		],
	},
	WRITE: {
		gloss: 'Pinched fingers draw a line across the other palm, like holding a pen.',
		phases: [
			P(0.3, { left: BASE_PALM, right: T('F', { part: 'thumbtip', on: 'palm', out: -0.04 }, ['down', 'forward'], 'in') }),
			P(0.32, { left: BASE_PALM, right: T('F', { part: 'thumbtip', on: 'palm', out: 0.08 }, ['down', 'forward'], 'in') }, 0.12),
		],
	},
	GIVE: {
		gloss: 'Both flat-O hands arc forward from the body, handing something over.',
		phases: [
			P(0.3, { both: H('FLAT_O', sp(0.1, 0.0, 0.2), 'up', 'back') }),
			P(0.3, { both: H('FLAT_O', sp(0.12, -0.04, 0.38), 'forward', 'up') }, 0.14),
		],
	},
	TAKE: {
		gloss: 'Open hand reaches out and closes, pulling toward the body.',
		phases: [
			P(0.3, { right: H('5', sp(0.14, 0.0, 0.38), ['forward', 'up'], 'down') }),
			P(0.28, { right: H('S', sp(0.12, 0.0, 0.2), ['up', 'forward'], 'down') }, 0.14),
		],
	},
	BUY: {
		gloss: 'Flat-O hand lifts off the other palm and moves forward, paying.',
		phases: [
			P(0.3, { left: BASE_PALM, right: T('FLAT_O', { part: 'fingertips', on: 'palm' }, 'down', 'back') }),
			P(0.3, { left: BASE_PALM, right: H('FLAT_O', sp(0.08, -0.02, 0.4), ['forward', 'down'], 'down') }, 0.14),
		],
	},
	PAY: {
		gloss: 'Index finger flicks forward off the other palm.',
		phases: [
			P(0.3, { left: BASE_PALM, right: T('1', { part: 'indextip', on: 'palm' }, ['forward', 'down'], 'down') }),
			P(0.24, { left: BASE_PALM, right: H('1', sp(0.08, -0.04, 0.4), 'forward', 'down') }, 0.14),
		],
	},
	OPEN: {
		gloss: 'Two flat hands side by side, palms forward, swing apart like doors opening.',
		phases: [
			P(0.3, { both: H('FLAT', sp(0.04, 0.0, 0.3), 'up', 'forward') }),
			P(0.3, { both: H('FLAT', sp(0.14, 0.0, 0.26), ['up', 'out'], ['forward', 'in']) }, 0.14),
		],
	},
	CLOSE: {
		gloss: 'Two flat hands swing together side by side, like doors closing.',
		phases: [
			P(0.3, { both: H('FLAT', sp(0.14, 0.0, 0.26), ['up', 'out'], ['forward', 'in']) }),
			P(0.26, { both: H('FLAT', sp(0.04, 0.0, 0.3), 'up', 'forward') }, 0.16),
		],
	},
	CLEAN: {
		gloss: 'Flat hand wipes across the other palm.',
		phases: [
			P(0.3, { left: BASE_PALM, right: T('FLAT', { part: 'palm', on: 'palm', out: -0.06 }, ['forward', 'in'], 'down') }),
			P(0.3, { left: BASE_PALM, right: T('FLAT', { part: 'palm', on: 'palm', out: 0.12 }, ['forward', 'in'], 'down') }, 0.12),
		],
	},
	WALK: {
		gloss: 'Both flat hands, palms down, step forward alternately like feet.',
		phases: [
			P(0.3, { left: H('FLAT', sp(0.1, -0.08, 0.24), 'forward', 'down'), right: H('FLAT', sp(0.1, -0.08, 0.32), ['forward', 'down'], 'down') }),
			P(0.22, { left: H('FLAT', sp(0.1, -0.08, 0.32), ['forward', 'down'], 'down'), right: H('FLAT', sp(0.1, -0.08, 0.24), 'forward', 'down') }),
			P(0.22, { left: H('FLAT', sp(0.1, -0.08, 0.24), 'forward', 'down'), right: H('FLAT', sp(0.1, -0.08, 0.32), ['forward', 'down'], 'down') }, 0.1),
		],
	},
	RUN: {
		gloss: 'Two L-hands, one hooked on the other, move forward quickly.',
		phases: [
			P(0.26, { left: H('L', sp(0.02, -0.04, 0.24), 'forward', 'in'), right: H('L', sp(0.06, -0.04, 0.22), 'forward', 'in') }),
			P(0.26, { left: H('L', sp(0.02, -0.04, 0.38), 'forward', 'in'), right: H('X', sp(0.06, -0.04, 0.36), 'forward', 'in') }, 0.1),
		],
	},
	UNDERSTAND: {
		gloss: 'Fist beside the temple flicks the index finger up: the idea clicks.',
		phases: [
			P(0.3, { right: H('S', at('forehead', 0.11, -0.04, 0.1), ['up', 'in'], 'back') }),
			P(0.18, { right: H('1', at('forehead', 0.11, -0.03, 0.1), 'up', 'back') }, 0.2),
		],
	},
	REMEMBER: {
		gloss: 'A-hand thumb moves from the forehead down onto the other thumb.',
		phases: [
			P(0.3, { right: T('A', brow('thumbtip', 0.05), ['up', 'in'], 'in') }),
			P(0.32, { left: H('A', sp(0.04, -0.1, 0.27), 'forward', 'in'), right: H('A', sp(0.04, -0.03, 0.27), 'forward', 'in') }, 0.16),
		],
	},
	FORGET: {
		gloss: 'Flat hand wipes across the forehead and closes into a fist.',
		phases: [
			P(0.3, { right: T('FLAT', brow('palm', -0.03), 'in', 'back') }),
			P(0.3, { right: H('A', at('forehead', 0.16, -0.04, 0.14), ['in', 'up'], 'back') }, 0.16),
		],
	},
	TELL: {
		gloss: 'Index finger at the chin moves forward to the listener.',
		phases: [
			P(0.3, { right: T('1', chin(0.0, 0.0, 'indextip'), ['up', 'back', 'in'], 'in') }),
			P(0.28, { right: H('1', at('chin', 0.04, -0.06, 0.28), ['forward', 'up'], 'up') }, 0.14),
		],
	},
	SAY: {
		gloss: 'Index finger circles forward from the mouth.',
		phases: [
			P(0.3, { right: H('1', at('mouth', 0.02, 0.0, 0.08), ['in', 'up'], 'back') }),
			P(0.16, { right: H('1', at('mouth', 0.04, 0.02, 0.13), ['in', 'up'], 'back') }),
			P(0.16, { right: H('1', at('mouth', 0.02, -0.02, 0.15), ['in', 'up'], 'back') }, 0.12),
		],
	},
	ASK: {
		gloss: 'Upright index finger bends into a hook as it moves toward the listener.',
		phases: [
			P(0.3, { face: 'question', right: H('1', at('chin', 0.06, -0.06, 0.16), 'up', 'forward') }),
			P(0.26, { face: 'question', right: H('X', at('chin', 0.06, -0.08, 0.3), ['up', 'forward'], 'forward') }, 0.16),
		],
	},
	ANSWER: {
		gloss: 'Both index fingers move from near the mouth forward and down.',
		phases: [
			P(0.3, { left: H('1', at('chin', 0.04, -0.06, 0.14), 'up', 'in'), right: H('1', at('mouth', 0.02, 0.0, 0.1), 'up', 'in') }),
			P(0.3, { left: H('1', at('chin', 0.04, -0.14, 0.32), 'forward', 'in'), right: H('1', at('chin', 0.04, -0.08, 0.3), 'forward', 'in') }, 0.14),
		],
	},
	FEEL: {
		gloss: 'Middle finger brushes up the chest.',
		phases: [
			P(0.3, { right: T('OPEN_8', chest(0.02, -0.06, 'middletip'), ['up', 'in'], 'back') }),
			P(0.26, { right: T('OPEN_8', chest(0.02, 0.04, 'middletip'), ['up', 'in'], 'back') }, 0.16),
		],
	},
	HAVE: {
		gloss: 'Bent hands bring the fingertips to the chest.',
		phases: [
			P(0.3, { both: H('BENT_B', at('sternum', 0.1, -0.02, 0.26), ['back', 'in'], 'in') }),
			P(0.26, { both: T('BENT_B', chest(0.09, -0.02, 'fingertips'), ['back', 'in'], 'in') }, 0.18),
		],
	},
	CAN: {
		gloss: 'Both fists move down firmly together.',
		phases: [
			P(0.3, { both: H('S', sp(0.12, 0.02, 0.27), ['forward', 'in'], 'down') }),
			P(0.2, { both: H('S', sp(0.12, -0.08, 0.27), ['forward', 'in'], 'down') }, 0.18),
		],
	},
	CANT: {
		gloss: 'Index finger strikes down past the other index finger.',
		phases: [
			P(0.3, { face: 'negate', left: H('1', sp(0.04, -0.06, 0.27), ['forward', 'in'], 'down'), right: H('1', sp(0.08, 0.04, 0.27), ['forward', 'in'], 'down') }),
			P(0.2, { face: 'negate', left: H('1', sp(0.04, -0.06, 0.27), ['forward', 'in'], 'down'), right: H('1', sp(0.06, -0.14, 0.28), ['forward', 'in', 'down'], 'down') }, 0.16),
		],
	},
	WILL: {
		gloss: 'Flat hand beside the cheek moves forward: the future.',
		phases: [
			P(0.3, { right: H('FLAT', at('chin', 0.13, 0.04, 0.0), 'up', 'in') }),
			P(0.3, { right: H('FLAT', at('chin', 0.15, 0.02, 0.2), ['up', 'forward'], 'in') }, 0.14),
		],
	},
	MAKE: {
		gloss: 'One fist on top of the other twists back and forth.',
		phases: [
			P(0.3, { left: H('S', sp(0.04, -0.12, 0.26), ['forward', 'in'], 'in'), right: T('S', { part: 'edge', on: 'knuckles', up: 0.03 }, ['forward', 'in'], 'in') }),
			P(0.18, { left: H('S', sp(0.04, -0.12, 0.26), ['forward', 'in'], 'in'), right: T('S', { part: 'edge', on: 'knuckles', up: 0.03 }, 'forward', ['in', 'back']) }),
			P(0.18, { left: H('S', sp(0.04, -0.12, 0.26), ['forward', 'in'], 'in'), right: T('S', { part: 'edge', on: 'knuckles', up: 0.03 }, ['forward', 'in'], 'in') }, 0.12),
		],
	},
	SHOW: {
		gloss: 'Index finger pointing into the other palm; both move forward together.',
		phases: [
			P(0.3, { left: WALL_PALM, right: T('1', { part: 'indextip', on: 'palm' }, 'in', 'down') }),
			P(0.3, { left: H('FLAT', sp(0.0, -0.02, 0.38), ['up', 'forward'], 'in'), right: T('1', { part: 'indextip', on: 'palm' }, 'in', 'down') }, 0.14),
		],
	},
	TRY: {
		gloss: 'Both T-hands push forward and down in an arc.',
		phases: [
			P(0.3, { both: H('T', sp(0.12, 0.02, 0.22), 'up', 'forward') }),
			P(0.3, { both: H('T', sp(0.14, -0.08, 0.36), ['forward', 'up'], 'down') }, 0.14),
		],
	},
	LIVE: {
		gloss: 'Both L-hands move up the chest.',
		phases: [
			P(0.3, { both: T('L', { to: 'belly', part: 'thumbtip', out: 0.08, up: 0.0, forward: 0.13 }, 'up', 'back') }),
			P(0.32, { both: T('L', chest(0.08, 0.02, 'thumbtip'), 'up', 'back') }, 0.16),
		],
	},
	BRING: {
		gloss: 'Both open palms carry something in toward the body.',
		phases: [
			P(0.3, { both: H('FLAT', sp(0.14, -0.06, 0.38), 'forward', 'up') }),
			P(0.3, { both: H('FLAT', sp(0.1, -0.06, 0.22), 'forward', 'up') }, 0.14),
		],
	},
	GET: {
		gloss: 'Open hands close into fists and pull toward the body.',
		phases: [
			P(0.3, { left: H('5', sp(0.08, -0.08, 0.34), ['forward', 'in'], 'in'), right: H('5', sp(0.08, 0.0, 0.34), ['forward', 'in'], 'in') }),
			P(0.28, { left: H('S', sp(0.08, -0.08, 0.22), ['forward', 'in'], 'in'), right: H('S', sp(0.08, -0.02, 0.22), ['forward', 'in'], 'in') }, 0.14),
		],
	},
	USE: {
		gloss: 'U-hand circles on the back of the other fist.',
		phases: [
			P(0.3, { left: BASE_FIST, right: T('U', { part: 'edge', on: 'back', up: 0.03 }, 'up', 'forward') }),
			P(0.18, { left: BASE_FIST, right: T('U', { part: 'edge', on: 'back', up: 0.03, out: 0.03 }, 'up', 'forward') }),
			P(0.18, { left: BASE_FIST, right: T('U', { part: 'edge', on: 'back', up: 0.03 }, 'up', 'forward') }, 0.1),
		],
	},
	BUSY: {
		gloss: 'B-hand edge rubs back and forth on the back of the other fist.',
		phases: [
			P(0.3, { left: BASE_FIST, right: T('FLAT', { part: 'edge', on: 'back', out: -0.02, up: 0.02 }, 'forward', 'in') }),
			P(0.16, { left: BASE_FIST, right: T('FLAT', { part: 'edge', on: 'back', out: 0.04, up: 0.02 }, 'forward', 'in') }),
			P(0.16, { left: BASE_FIST, right: T('FLAT', { part: 'edge', on: 'back', out: -0.02, up: 0.02 }, 'forward', 'in') }),
			P(0.16, { left: BASE_FIST, right: T('FLAT', { part: 'edge', on: 'back', out: 0.04, up: 0.02 }, 'forward', 'in') }, 0.1),
		],
	},
	SIGN: {
		gloss: 'Both index fingers circle back toward the body alternately: sign language.',
		phases: [
			P(0.3, { left: H('1', sp(0.1, 0.02, 0.24), ['up', 'in'], 'forward'), right: H('1', sp(0.1, -0.06, 0.3), ['up', 'in'], 'forward') }),
			P(0.2, { left: H('1', sp(0.1, -0.06, 0.3), ['up', 'in'], 'forward'), right: H('1', sp(0.1, 0.02, 0.24), ['up', 'in'], 'forward') }),
			P(0.2, { left: H('1', sp(0.1, 0.02, 0.24), ['up', 'in'], 'forward'), right: H('1', sp(0.1, -0.06, 0.3), ['up', 'in'], 'forward') }, 0.1),
		],
	},
	LANGUAGE: {
		gloss: 'Two L-hands, thumbs nearly touching, pull apart.',
		phases: [
			P(0.3, { both: H('L', sp(0.04, -0.02, 0.28), ['forward', 'in'], 'down') }),
			P(0.3, { both: H('L', sp(0.2, -0.02, 0.28), ['forward', 'in'], 'down') }, 0.14),
		],
	},
	TALK: {
		gloss: 'Index finger moves forward from the mouth twice.',
		phases: [
			P(0.3, { right: H('1', at('mouth', 0.02, 0.0, 0.07), 'up', 'in') }),
			P(0.16, { right: H('1', at('mouth', 0.03, -0.01, 0.17), ['up', 'forward'], 'in') }),
			P(0.16, { right: H('1', at('mouth', 0.02, 0.0, 0.07), 'up', 'in') }),
			P(0.16, { right: H('1', at('mouth', 0.03, -0.01, 0.17), ['up', 'forward'], 'in') }, 0.1),
		],
	},
	HEAR: {
		gloss: 'Index finger points to the ear.',
		phases: [P(0.3, { right: T('1', { to: 'chin', part: 'indextip', out: 0.1, up: 0.06, forward: -0.03, gap: 0.015 }, ['in', 'up'], 'back') }, 0.26)],
	},
	LISTEN: {
		gloss: 'Cupped hand held behind the ear.',
		phases: [P(0.3, { right: T('C', { to: 'chin', part: 'fingertips', out: 0.11, up: 0.06, forward: -0.03, gap: 0.015 }, ['in', 'up'], 'forward') }, 0.28)],
	},
	DEAF: {
		gloss: 'Index finger touches near the ear, then near the mouth.',
		phases: [
			P(0.3, { right: T('1', { to: 'chin', part: 'indextip', out: 0.1, up: 0.06, forward: -0.02, gap: 0.01 }, ['in', 'up'], 'back') }),
			P(0.26, { right: T('1', { to: 'mouth', part: 'indextip', out: 0.05, up: -0.01, forward: 0.01 }, ['in', 'up'], 'back') }, 0.16),
		],
	},
	HEARING: {
		gloss: 'Index finger circles forward in front of the mouth: a hearing person.',
		phases: [
			P(0.3, { right: H('1', at('mouth', 0.02, 0.0, 0.08), 'in', 'down') }),
			P(0.16, { right: H('1', at('mouth', 0.02, 0.02, 0.13), 'in', 'down') }),
			P(0.16, { right: H('1', at('mouth', 0.02, -0.02, 0.14), 'in', 'down') }),
			P(0.16, { right: H('1', at('mouth', 0.02, 0.0, 0.08), 'in', 'down') }, 0.1),
		],
	},
	PRAY: {
		gloss: 'Flat palms pressed together move in toward the body.',
		phases: [
			P(0.3, { both: H('FLAT', sp(0.03, 0.0, 0.3), ['up', 'forward'], 'in') }),
			P(0.3, { both: H('FLAT', sp(0.03, 0.02, 0.2), 'up', 'in'), head: { nod: 6 } }, 0.2),
		],
	},
	LIKE: {
		gloss: 'Thumb and middle finger pull away from the chest and close.',
		phases: [
			P(0.3, { right: T('OPEN_8', chest(0.02, 0.0, 'middletip'), ['back', 'in'], 'back') }),
			P(0.28, { right: H('F', at('sternum', 0.04, -0.02, 0.28), ['forward', 'up'], 'back'), face: 'pleasant' }, 0.14),
		],
	},
	NEED: {
		gloss: 'X-hand bends down at the wrist twice (need, must, should).',
		phases: [
			P(0.3, { face: 'intense', right: H('X', sp(0.14, 0.0, 0.28), 'forward', 'down') }),
			P(0.16, { face: 'intense', right: H('X', sp(0.14, -0.05, 0.28), ['forward', 'down'], 'down') }),
			P(0.16, { face: 'intense', right: H('X', sp(0.14, 0.0, 0.28), 'forward', 'down') }),
			P(0.16, { face: 'intense', right: H('X', sp(0.14, -0.05, 0.28), ['forward', 'down'], 'down') }, 0.12),
		],
	},
	NOT: {
		gloss: 'A-hand thumb flicks forward from under the chin, with a headshake.',
		phases: [
			P(0.3, { face: 'negate', right: T('A', { to: 'chin', part: 'thumbtip', out: 0.0, up: -0.03, forward: 0.03 }, 'up', 'in'), head: { turn: 4 } }),
			P(0.22, { face: 'negate', right: H('A', at('chin', 0.04, -0.06, 0.2), ['up', 'forward'], 'in'), head: { turn: -4 } }, 0.16),
		],
	},
	GOODBYE: {
		gloss: 'Open hand waves, fingers folding down and up.',
		phases: [
			P(0.3, { face: 'pleasant', right: H('FLAT', at('chin', 0.2, 0.0, 0.22), 'up', 'forward') }),
			P(0.16, { face: 'pleasant', right: H('BENT_B', at('chin', 0.2, 0.0, 0.22), ['up', 'forward'], 'forward') }),
			P(0.16, { face: 'pleasant', right: H('FLAT', at('chin', 0.2, 0.0, 0.22), 'up', 'forward') }),
			P(0.16, { face: 'pleasant', right: H('BENT_B', at('chin', 0.2, 0.0, 0.22), ['up', 'forward'], 'forward') }, 0.1),
		],
	},
	EXCUSE: {
		gloss: 'Fingertips brush forward across the other palm twice (excuse me).',
		phases: [
			P(0.3, { left: BASE_PALM, right: T('BENT_B', { part: 'fingertips', on: 'palm', forward: -0.04 }, ['down', 'forward'], 'down') }),
			P(0.16, { left: BASE_PALM, right: T('BENT_B', { part: 'fingertips', on: 'palm', forward: 0.05 }, ['down', 'forward'], 'down') }),
			P(0.16, { left: BASE_PALM, right: T('BENT_B', { part: 'fingertips', on: 'palm', forward: -0.04 }, ['down', 'forward'], 'down') }),
			P(0.16, { left: BASE_PALM, right: T('BENT_B', { part: 'fingertips', on: 'palm', forward: 0.05 }, ['down', 'forward'], 'down') }, 0.1),
		],
	},

	// Feelings and states
	FINE: {
		gloss: 'Open-hand thumb taps the chest twice.',
		phases: tap2(
			{ right: H('5', at('sternum', 0.04, 0.0, 0.2), 'up', 'in') },
			{ right: T('5', chest(0.02, 0.0, 'thumbtip'), 'up', 'in') },
		),
	},
	SAD: {
		gloss: 'Both open hands, palms facing the face, draw down slowly.',
		phases: [
			P(0.3, { face: 'concern', both: H('5', at('nose', 0.06, 0.04, 0.12), 'up', 'back'), head: { nod: 4 } }),
			P(0.4, { face: 'concern', both: H('5', at('chin', 0.07, -0.08, 0.14), 'up', 'back'), head: { nod: 8 } }, 0.18),
		],
	},
	ANGRY: {
		gloss: 'Claw hand in front of the face pulls forward tensely.',
		phases: [
			P(0.3, { face: 'intense', right: H('CLAW', at('nose', 0.02, 0.0, 0.1), 'up', 'back') }),
			P(0.24, { face: 'intense', right: H('CLAW', at('nose', 0.04, -0.02, 0.2), 'up', 'back') }, 0.18),
		],
	},
	TIRED: {
		gloss: 'Bent hands on the upper chest droop down, shoulders sagging.',
		phases: [
			P(0.3, { both: T('BENT_B', chest(0.1, 0.04, 'fingertips'), ['back', 'in'], 'back') }),
			P(0.32, { both: T('BENT_B', chest(0.1, 0.0, 'fingertips'), ['down', 'in'], 'in'), head: { nod: 8 }, torso: { lean: 4 } }, 0.2),
		],
	},
	SICK: {
		gloss: 'Middle finger touches the forehead while the other touches the stomach.',
		phases: [
			P(0.34, { face: 'concern', right: T('OPEN_8', brow('middletip', 0.03), ['back', 'up'], 'back'), left: T('OPEN_8', { to: 'belly', part: 'middletip', out: 0.02, up: 0.02, forward: 0.13 }, ['back', 'up'], 'back'), head: { tilt: 4 } }, 0.3),
		],
	},
	HURT: {
		gloss: 'Both index fingers jab toward each other and twist (pain).',
		phases: [
			P(0.3, { face: 'concern', both: H('1', sp(0.12, -0.02, 0.27), 'in', 'down') }),
			P(0.2, { face: 'concern', both: H('1', sp(0.05, -0.02, 0.27), 'in', 'back') }),
			P(0.18, { face: 'concern', both: H('1', sp(0.05, -0.02, 0.27), 'in', 'down') }, 0.14),
		],
	},
	SCARED: {
		gloss: 'Both fists burst open into spread hands in front of the chest.',
		phases: [
			P(0.28, { face: 'intense', both: H('S', sp(0.14, 0.0, 0.24), ['up', 'in'], 'back') }),
			P(0.18, { face: 'intense', both: H('5', sp(0.06, -0.02, 0.24), ['up', 'in'], 'back'), torso: { lean: -3 } }, 0.2),
		],
	},
	EXCITED: {
		gloss: 'Both middle fingers brush up the chest alternately.',
		phases: [
			P(0.3, { face: 'pleasant', left: T('OPEN_8', chest(0.08, 0.02, 'middletip'), ['up', 'in'], 'back'), right: T('OPEN_8', chest(0.08, -0.06, 'middletip'), ['up', 'in'], 'back') }),
			P(0.2, { face: 'pleasant', left: T('OPEN_8', chest(0.08, -0.06, 'middletip'), ['up', 'in'], 'back'), right: T('OPEN_8', chest(0.08, 0.02, 'middletip'), ['up', 'in'], 'back') }),
			P(0.2, { face: 'pleasant', left: T('OPEN_8', chest(0.08, 0.02, 'middletip'), ['up', 'in'], 'back'), right: T('OPEN_8', chest(0.08, -0.06, 'middletip'), ['up', 'in'], 'back') }, 0.1),
		],
	},
	HOT: {
		gloss: 'Claw hand at the mouth twists away and down, like spitting out something hot.',
		phases: [
			P(0.3, { right: H('CLAW', at('mouth', 0.02, 0.0, 0.08), 'up', 'back') }),
			P(0.24, { right: H('CLAW', at('chin', 0.12, -0.1, 0.2), ['up', 'out'], 'forward') }, 0.16),
		],
	},
	COLD: {
		gloss: 'Both fists shake in front of the chest, shivering.',
		phases: [
			P(0.3, { face: 'concern', both: H('S', sp(0.1, 0.0, 0.2), 'up', 'back') }),
			P(0.12, { face: 'concern', both: H('S', sp(0.13, 0.0, 0.2), 'up', 'back') }),
			P(0.12, { face: 'concern', both: H('S', sp(0.08, 0.0, 0.2), 'up', 'back') }),
			P(0.12, { face: 'concern', both: H('S', sp(0.13, 0.0, 0.2), 'up', 'back') }, 0.1),
		],
	},
	BEAUTIFUL: {
		gloss: 'Open hand circles the face and closes to a flat O.',
		phases: [
			P(0.3, { face: 'pleasant', right: H('5', at('forehead', 0.04, 0.0, 0.14), 'up', 'back') }),
			P(0.22, { face: 'pleasant', right: H('5', at('chin', 0.12, 0.04, 0.14), 'up', 'back') }),
			P(0.22, { face: 'pleasant', right: H('FLAT_O', at('chin', 0.02, -0.04, 0.14), 'up', 'back') }, 0.14),
		],
	},
	BIG: {
		gloss: 'Two bent-L hands move apart.',
		phases: [
			P(0.3, { both: H('L', sp(0.08, 0.0, 0.28), 'forward', 'in') }),
			P(0.32, { both: H('L', sp(0.26, 0.0, 0.28), 'forward', 'in') }, 0.16),
		],
	},
	SMALL: {
		gloss: 'Flat hands, palms facing, move closer together.',
		phases: [
			P(0.3, { both: H('FLAT', sp(0.12, -0.02, 0.28), 'forward', 'in') }),
			P(0.26, { both: H('FLAT', sp(0.04, -0.02, 0.28), 'forward', 'in') }, 0.16),
		],
	},
	NEW: {
		gloss: 'Back of the curved hand scoops up across the other palm.',
		phases: [
			P(0.3, { left: BASE_PALM, right: T('BENT_B', { part: 'back', on: 'palm', out: 0.06 }, ['forward', 'in'], 'up') }),
			P(0.28, { left: BASE_PALM, right: H('BENT_B', sp(-0.04, -0.02, 0.28), ['forward', 'in', 'up'], 'up') }, 0.14),
		],
	},
	OLD: {
		gloss: 'Hand at the chin closes and pulls down, like a long beard.',
		phases: [
			P(0.3, { right: T('C', chin(0.0, -0.01, 'fingertips', 0.03), 'in', 'back') }),
			P(0.3, { right: H('S', at('chin', 0.02, -0.14, 0.17), 'in', 'back') }, 0.16),
		],
	},
	SAME: {
		gloss: 'Y-hand moves side to side between the two things that match.',
		phases: [
			P(0.3, { right: H('Y', sp(0.04, -0.04, 0.3), 'forward', 'down') }),
			P(0.2, { right: H('Y', sp(0.2, -0.04, 0.3), 'forward', 'down') }),
			P(0.2, { right: H('Y', sp(0.04, -0.04, 0.3), 'forward', 'down') }, 0.12),
		],
	},
	DIFFERENT: {
		gloss: 'Crossed index fingers pull apart.',
		phases: [
			P(0.3, { left: H('1', sp(-0.02, -0.02, 0.28), ['up', 'out'], 'forward'), right: H('1', sp(-0.02, -0.02, 0.3), ['up', 'out'], 'forward') }),
			P(0.3, { both: H('1', sp(0.2, -0.04, 0.28), ['up', 'out'], 'forward') }, 0.14),
		],
	},
	RIGHT: {
		gloss: 'Index finger taps down onto the other index finger (correct).',
		phases: [
			P(0.3, { left: H('1', sp(0.04, -0.08, 0.27), ['forward', 'in'], 'in'), right: H('1', sp(0.05, 0.04, 0.27), ['forward', 'in'], 'in') }),
			P(0.2, { left: H('1', sp(0.04, -0.08, 0.27), ['forward', 'in'], 'in'), right: T('1', { part: 'edge', on: 'back', up: 0.0 }, ['forward', 'in'], 'in') }, 0.16),
		],
	},
	WRONG: {
		gloss: 'Y-hand knuckles tap the chin.',
		phases: [
			P(0.3, { face: 'negate', right: H('Y', at('chin', 0.02, -0.02, 0.08), 'up', 'back') }),
			P(0.18, { face: 'negate', right: T('Y', chin(0.0, -0.01, 'knuckles', 0.02), 'up', 'back') }, 0.16),
		],
	},
	EASY: {
		gloss: 'Fingertips brush up the back of the other curved fingers twice.',
		phases: [
			P(0.3, { left: H('BENT_B', sp(0.04, -0.08, 0.27), ['forward', 'in'], 'up'), right: T('BENT_B', { part: 'fingertips', on: 'back', up: -0.02 }, ['forward', 'in'], 'up') }),
			P(0.16, { left: H('BENT_B', sp(0.04, -0.08, 0.27), ['forward', 'in'], 'up'), right: H('BENT_B', sp(0.06, 0.0, 0.3), ['forward', 'in', 'up'], 'up') }),
			P(0.16, { left: H('BENT_B', sp(0.04, -0.08, 0.27), ['forward', 'in'], 'up'), right: T('BENT_B', { part: 'fingertips', on: 'back', up: -0.02 }, ['forward', 'in'], 'up') }),
			P(0.16, { left: H('BENT_B', sp(0.04, -0.08, 0.27), ['forward', 'in'], 'up'), right: H('BENT_B', sp(0.06, 0.0, 0.3), ['forward', 'in', 'up'], 'up') }, 0.1),
		],
	},
	HARD: {
		gloss: 'Bent-V knuckles strike down on the other bent-V (difficult).',
		phases: [
			P(0.3, { face: 'intense', left: H('V', sp(0.04, -0.08, 0.27), ['forward', 'in'], 'in'), right: H('V', sp(0.06, 0.04, 0.27), ['forward', 'in'], 'in') }),
			P(0.18, { face: 'intense', left: H('V', sp(0.04, -0.08, 0.27), ['forward', 'in'], 'in'), right: H('V', sp(0.05, -0.04, 0.28), ['forward', 'in', 'down'], 'in') }, 0.16),
		],
	},
	SLOW: {
		gloss: 'Flat hand slides slowly up the back of the other hand.',
		phases: [
			P(0.3, { left: H('FLAT', sp(0.04, -0.08, 0.27), ['forward', 'in'], 'down'), right: T('FLAT', { part: 'palm', on: 'back', forward: -0.02 }, ['forward', 'in'], 'down') }),
			P(0.6, { left: H('FLAT', sp(0.04, -0.08, 0.27), ['forward', 'in'], 'down'), right: T('FLAT', { part: 'palm', on: 'back', forward: -0.1, up: 0.01 }, ['forward', 'in'], 'down') }, 0.12),
		],
	},
	FAST: {
		gloss: 'Both L-hands snap the index fingers closed quickly.',
		phases: [
			P(0.28, { both: H('L', sp(0.12, -0.02, 0.28), 'forward', 'in') }),
			P(0.12, { both: H('X', sp(0.12, -0.02, 0.24), 'forward', 'in') }, 0.18),
		],
	},
	ALL: {
		gloss: 'Flat hand circles around the other and lands in its palm.',
		phases: [
			P(0.3, { left: H('FLAT', sp(0.04, -0.04, 0.27), 'up', 'back'), right: H('FLAT', sp(0.0, 0.06, 0.34), 'up', 'forward') }),
			P(0.24, { left: H('FLAT', sp(0.04, -0.04, 0.27), 'up', 'back'), right: H('FLAT', sp(0.2, 0.0, 0.32), 'up', 'forward') }),
			P(0.24, { left: H('FLAT', sp(0.04, -0.04, 0.27), 'up', 'back'), right: T('FLAT', { part: 'back', on: 'palm', up: -0.04 }, ['in', 'up'], 'up') }, 0.14),
		],
	},
	MANY: {
		gloss: 'Both fists flick open into spread hands twice.',
		phases: [
			P(0.3, { both: H('S', sp(0.14, -0.04, 0.28), 'forward', 'up') }),
			P(0.14, { both: H('5', sp(0.15, -0.03, 0.3), 'forward', 'up') }),
			P(0.14, { both: H('S', sp(0.14, -0.04, 0.28), 'forward', 'up') }),
			P(0.14, { both: H('5', sp(0.15, -0.03, 0.3), 'forward', 'up') }, 0.12),
		],
	},
	WITH: {
		gloss: 'Two A-hands come together.',
		phases: [
			P(0.3, { both: H('A', sp(0.14, -0.04, 0.27), 'up', 'in') }),
			P(0.24, { both: H('A', sp(0.04, -0.04, 0.27), 'up', 'in') }, 0.16),
		],
	},
	FOR: {
		gloss: 'Index finger at the temple twists out to point forward.',
		phases: [
			P(0.3, { right: T('1', temple('indextip'), ['in', 'up'], 'back') }),
			P(0.24, { right: H('1', at('forehead', 0.12, -0.06, 0.2), 'forward', 'down') }, 0.14),
		],
	},
	RAIN: {
		gloss: 'Both claw hands drop down twice, like falling rain.',
		phases: [
			P(0.3, { both: H('CLAW', at('chin', 0.14, 0.06, 0.26), 'forward', 'down') }),
			P(0.18, { both: H('CLAW', at('chin', 0.14, -0.08, 0.26), 'forward', 'down') }),
			P(0.18, { both: H('CLAW', at('chin', 0.14, 0.06, 0.26), 'forward', 'down') }),
			P(0.18, { both: H('CLAW', at('chin', 0.14, -0.08, 0.26), 'forward', 'down') }, 0.1),
		],
	},
	AND: {
		gloss: 'Open hand moves across in front of the body and closes to a flat O.',
		phases: [
			P(0.3, { right: H('5', sp(0.0, -0.04, 0.28), ['forward', 'in'], 'back') }),
			P(0.3, { right: H('FLAT_O', sp(0.2, -0.04, 0.28), ['forward', 'in'], 'back') }, 0.12),
		],
	},
	ALSO: {
		gloss: 'Two index fingers, side by side, tap together twice.',
		phases: tap2(
			{ both: H('1', sp(0.08, -0.04, 0.28), 'forward', 'down') },
			{ both: H('1', sp(0.03, -0.04, 0.28), 'forward', 'down') },
		),
	},
	TOGETHER: {
		gloss: 'Two A-hands held together circle in front of the body.',
		phases: [
			P(0.3, { both: H('A', sp(0.03, -0.04, 0.27), 'up', 'in') }),
			P(0.22, { left: H('A', sp(-0.04, -0.04, 0.32), 'up', 'in'), right: H('A', sp(0.1, -0.04, 0.32), 'up', 'in') }),
			P(0.22, { both: H('A', sp(0.03, -0.04, 0.27), 'up', 'in') }, 0.12),
		],
	},
	WASH: {
		gloss: 'One fist rubs in circles on the other fist.',
		phases: [
			P(0.3, { left: H('A', sp(0.04, -0.1, 0.26), 'forward', 'up'), right: T('A', { part: 'knuckles', on: 'knuckles', up: 0.01 }, 'forward', 'down') }),
			P(0.18, { left: H('A', sp(0.04, -0.1, 0.26), 'forward', 'up'), right: T('A', { part: 'knuckles', on: 'knuckles', up: 0.01, out: 0.03 }, 'forward', 'down') }),
			P(0.18, { left: H('A', sp(0.04, -0.1, 0.26), 'forward', 'up'), right: T('A', { part: 'knuckles', on: 'knuckles', up: 0.01, out: -0.02 }, 'forward', 'down') }),
			P(0.18, { left: H('A', sp(0.04, -0.1, 0.26), 'forward', 'up'), right: T('A', { part: 'knuckles', on: 'knuckles', up: 0.01 }, 'forward', 'down') }, 0.1),
		],
	},
	CHAIR: {
		gloss: 'Two bent fingers tap down on the other two fingers twice (a seat).',
		phases: tap2(
			{ left: H('H', sp(0.04, -0.08, 0.27), ['forward', 'in'], 'down'), right: H('H', sp(0.05, 0.0, 0.27), ['forward', 'in'], 'down') },
			{ left: H('H', sp(0.04, -0.08, 0.27), ['forward', 'in'], 'down'), right: T('H', { part: 'fingers', on: 'back' }, ['forward', 'in', 'down'], 'down') },
		),
	},
	STUDY: {
		gloss: 'Open fingers wiggle toward the other palm, like poring over a page.',
		phases: [
			P(0.3, { left: BASE_PALM, right: H('5', sp(0.06, 0.04, 0.26), ['down', 'forward'], 'down') }),
			P(0.14, { left: BASE_PALM, right: H('CLAW', sp(0.06, 0.02, 0.26), ['down', 'forward'], 'down') }),
			P(0.14, { left: BASE_PALM, right: H('5', sp(0.06, 0.04, 0.26), ['down', 'forward'], 'down') }),
			P(0.14, { left: BASE_PALM, right: H('CLAW', sp(0.06, 0.02, 0.26), ['down', 'forward'], 'down') }, 0.1),
		],
	},
});

/** Everyday spellings and inflections of a sign above (same meaning, same sign). */
export const DAILY_ALIASES = Object.freeze({
	MINE: 'MY',
	YOURS: 'YOUR',
	SHE: 'HE',
	HIM: 'HE',
	HER: 'HE',
	IT: 'HE',
	HIS: 'HE',
	THEM: 'THEY',
	US: 'WE',
	MOM: 'MOTHER',
	MUM: 'MOTHER',
	MOMMY: 'MOTHER',
	AMMI: 'MOTHER',
	DAD: 'FATHER',
	DADDY: 'FATHER',
	ABBU: 'FATHER',
	SISTERS: 'SISTER',
	BROTHERS: 'BROTHER',
	BABIES: 'BABY',
	KID: 'CHILD',
	KIDS: 'CHILDREN',
	BOYS: 'BOY',
	GIRLS: 'GIRL',
	MEN: 'MAN',
	WOMEN: 'WOMAN',
	DOCTORS: 'DOCTOR',
	TEACHERS: 'TEACHER',
	TEACHING: 'TEACH',
	STUDENTS: 'STUDENT',
	DAYS: 'DAY',
	NIGHTS: 'NIGHT',
	TONIGHT: 'NIGHT',
	WEEKS: 'WEEK',
	MONTHS: 'MONTH',
	YEARS: 'YEAR',
	MINUTES: 'MINUTE',
	HOURS: 'HOUR',
	WAITING: 'WAIT',
	EATING: 'EAT',
	ATE: 'EAT',
	DRINKING: 'DRINK',
	DRANK: 'DRINK',
	SUGAR: 'SWEET',
	FOOD: 'EAT',
	COOKING: 'COOK',
	HOUSES: 'HOUSE',
	SHOP: 'STORE',
	TOILET: 'BATHROOM',
	WASHROOM: 'BATHROOM',
	RESTROOM: 'BATHROOM',
	DRIVE: 'CAR',
	DRIVING: 'CAR',
	TELEPHONE: 'PHONE',
	CALL: 'PHONE',
	BOOKS: 'BOOK',
	GOING: 'GO',
	WENT: 'GO',
	COMING: 'COME',
	CAME: 'COME',
	SLEEPING: 'SLEEP',
	SLEPT: 'SLEEP',
	PLAYING: 'PLAY',
	READING: 'READ',
	WRITING: 'WRITE',
	GAVE: 'GIVE',
	BOUGHT: 'BUY',
	PAID: 'PAY',
	WALKING: 'WALK',
	RUNNING: 'RUN',
	UNDERSTOOD: 'UNDERSTAND',
	FORGOT: 'FORGET',
	TOLD: 'TELL',
	SAID: 'SAY',
	ASKED: 'ASK',
	FEELING: 'FEEL',
	FELT: 'FEEL',
	HAS: 'HAVE',
	HAD: 'HAVE',
	CANNOT: 'CANT',
	MADE: 'MAKE',
	TRYING: 'TRY',
	LIVING: 'LIVE',
	LIFE: 'LIVE',
	SIGNING: 'SIGN',
	TALKING: 'TALK',
	SPEAK: 'TALK',
	PRAYING: 'PRAY',
	LIKES: 'LIKE',
	NEEDS: 'NEED',
	MUST: 'NEED',
	SHOULD: 'NEED',
	DONT: 'NOT',
	DOESNT: 'NOT',
	DIDNT: 'NOT',
	BYE: 'GOODBYE',
	MAD: 'ANGRY',
	SICKNESS: 'SICK',
	ILL: 'SICK',
	PAIN: 'HURT',
	AFRAID: 'SCARED',
	PRETTY: 'BEAUTIFUL',
	LARGE: 'BIG',
	LITTLE: 'SMALL',
	CORRECT: 'RIGHT',
	DIFFICULT: 'HARD',
	QUICK: 'FAST',
	LOTS: 'MANY',
	STARTED: 'START',
	BEGIN: 'START',
	OPENED: 'OPEN',
	CLOSED: 'CLOSE',
	CLEANING: 'CLEAN',
	STUDYING: 'STUDY',
	SHOWED: 'SHOW',
	GETTING: 'GET',
	GOT: 'GET',
	USED: 'USE',
	WASHING: 'WASH',
	CHAIRS: 'CHAIR',
});

/**
 * Words of the core three.ws vocabulary whose alias points at a DIFFERENT sign.
 * ASL has its own signs for these (several are added above), so the old mapping
 * would sign the wrong word. Removing them here means they are either signed
 * correctly by DAILY_SIGNS (MY, LIKE, NEED) or fingerspelled (OK, GREAT,
 * EVERYONE, EVERYBODY) rather than substituted.
 */
export const OVERRIDDEN_CORE_ALIASES = Object.freeze(['MY', 'MINE', 'LIKE', 'NEED', 'OK', 'GREAT', 'EVERYONE', 'EVERYBODY', 'SORRYY']);

/**
 * Two core three.ws signs put part of the hand inside the body on the reference
 * rig (found by tests/lexicon.test.mjs): ME's index finger points back through
 * the chest, and LEARN's last phase lands the hand inside the forehead. LEARN's
 * first phase also gives fingers and palm the same direction ('down'), which
 * leaves the hand's twist undefined and breaks left-handed mirroring. These
 * replace just the faulty phase values; everything else is the core sign.
 * @type {Record<string, (sign: {gloss: string, phases: object[]}) => {gloss: string, phases: object[]}>}
 */
export const CORE_FIXES = Object.freeze({
	ME: (sign) => ({
		...sign,
		phases: [P(0.28, { right: H('1', at('sternum', 0.05, -0.02, 0.22), ['back', 'in'], 'down') }, 0.22)],
	}),
	LEARN: (sign) => ({
		...sign,
		phases: [
			// fingers and palm both 'down' leave the hand's twist undefined
			{ ...sign.phases[0], right: { ...sign.phases[0].right, palm: 'back' } },
			sign.phases[1],
			{ ...sign.phases[2], right: T('FLAT_O', { to: 'forehead', part: 'fingertips', out: 0.04, up: -0.04, forward: 0.08, gap: 0.02 }, ['up', 'back'], 'down') },
		],
	}),
});

/**
 * English function words that ASL does not sign: articles, forms of "to be",
 * and "to" (infinitive or direction).
 * They are shown to the user as "omitted" instead of being fingerspelled, which
 * would make every sentence twice as long without adding meaning.
 */
export const OMITTED_WORDS = Object.freeze({
	A: 'ASL has no articles',
	AN: 'ASL has no articles',
	THE: 'ASL has no articles',
	AM: 'ASL does not sign the verb "to be"',
	IS: 'ASL does not sign the verb "to be"',
	ARE: 'ASL does not sign the verb "to be"',
	BE: 'ASL does not sign the verb "to be"',
	TO: 'ASL usually leaves out "to" (WANT EAT, GO SCHOOL)',
});
