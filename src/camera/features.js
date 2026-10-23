// One description of "where the hands are and what shape they make", shared by
// the camera and by the avatar's own sign definitions, so the two can be
// compared directly.
//
// Coordinates are body-relative and 2D, because a single webcam sees depth
// badly:
//   x: shoulder widths toward the SIGNER's left (the camera's right)
//   y: shoulder widths up from the line between the shoulders
// The handshape is the angle/ratio description from the three.ws grader
// (finger curls, thumb curl and spread, thumb-to-index pinch), which does not
// depend on where the hand is or how it is turned.

import { handMetrics } from '../vendor/three-ws/sign-grader.js';
import { ANCHORS, FINGERS, boneLength, fingerTip } from '../vendor/three-ws/sign-rig.js';

// Below this height a hand counts as resting, not signing (about the navel).
// Arms hanging at rest put the wrists near -1.4 on a real body.
export const ACTIVE_Y = -1.05;
// Fingerspelling happens at shoulder height on the dominant side; a held
// handshape lower down (YES is a nodding S-hand at the chest) is not a letter.
export const SPELLING_MIN_Y = -0.15;

const POSE = { NOSE: 0, LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12, LEFT_ELBOW: 13, RIGHT_ELBOW: 14, LEFT_WRIST: 15, RIGHT_WRIST: 16 };

/** Handshape description: 7 numbers, each roughly 0..1. */
export function shapeVector(landmarks) {
	const m = handMetrics(landmarks);
	return [
		m.curl.Index / 180,
		m.curl.Middle / 180,
		m.curl.Ring / 180,
		m.curl.Pinky / 180,
		m.thumbCurl / 180,
		m.thumbSpread / 90,
		Math.min(2, m.pinch.Index) / 2,
	];
}

/**
 * The body frame from MediaPipe pose landmarks (normalised image coords).
 *
 * Units, so that the same sign measures the same on different bodies:
 *   - below the shoulders and sideways: the ARM's length (shoulder to elbow to
 *     wrist), expressed in the reference body's shoulder widths. Hand positions
 *     are arm length times joint angles, so this cancels long or short arms
 *     and narrow or broad shoulders. The longest arm seen so far is used
 *     (`state` keeps it), since an arm pointing at the camera looks short.
 *   - above the shoulders: the height of the nose, since signs there are
 *     placed against the face, and neck and head size vary between people.
 * Both fall back to the shoulder width when the landmarks are missing.
 *
 * @param {{x:number,y:number,visibility?:number}[]} pose  33 pose landmarks
 * @param {number} width  video width in pixels
 * @param {number} height video height in pixels
 * @param {{ reach?: number }} [state]  carried between frames of one camera session
 */
export function bodyFrame(pose, width, height, state = null) {
	const l = pose?.[POSE.LEFT_SHOULDER];
	const r = pose?.[POSE.RIGHT_SHOULDER];
	if (!l || !r) return null;
	const P = (q) => [q.x * width, q.y * height];
	const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
	const [lx, ly] = P(l);
	const [rx, ry] = P(r);
	const span = Math.hypot(lx - rx, ly - ry);
	if (span < 10) return null;
	const cx = (lx + rx) / 2;
	const cy = (ly + ry) / 2;

	const visible = (q) => q && (q.visibility ?? 1) >= 0.5;
	let reach = 0;
	for (const [s, e, w] of [[POSE.LEFT_SHOULDER, POSE.LEFT_ELBOW, POSE.LEFT_WRIST], [POSE.RIGHT_SHOULDER, POSE.RIGHT_ELBOW, POSE.RIGHT_WRIST]]) {
		if (visible(pose[e]) && visible(pose[w])) reach = Math.max(reach, d(P(pose[s]), P(pose[e])) + d(P(pose[e]), P(pose[w])));
	}
	if (state) {
		// Remember the longest arm, forgetting slowly so a new person can take over.
		state.reach = Math.max(reach, (state.reach ?? 0) * 0.998);
		reach = state.reach;
	}
	const xUnit = reach > span * 0.8 ? reach / ARM_SPANS : span;

	const nose = pose[POSE.NOSE];
	const rise = visible(nose) ? cy - nose.y * height : 0;
	const upUnit = rise > span * 0.2 ? rise / NOSE_UP : span;
	return { cx, cy, span, xUnit, upUnit, downUnit: xUnit, width, height };
}

/** A point in normalised image coords, in body units. Works on an UNMIRRORED frame. */
export function toBody(frame, p) {
	const dy = -(p.y * frame.height - frame.cy);
	return [(p.x * frame.width - frame.cx) / (frame.xUnit ?? frame.span), dy / ((dy > 0 ? frame.upUnit : frame.downUnit) ?? frame.span)];
}

/**
 * Features for one camera frame.
 *
 * Which hand is which is decided by the BODY, not by the hand tracker's own
 * left/right label: that label is unreliable when the palm is hidden (a hand
 * hanging at rest was measured labelled as the wrong hand). Each detected hand
 * is given to the nearer of the pose's two wrists (landmarks 15 = left,
 * 16 = right). When the hand tracker loses a hand (it often does near the
 * face), the pose wrist still gives its position, with no shape.
 *
 * @param {{ hands: {side:'Left'|'Right', image:{x,y}[], world:number[][]}[], pose: {x,y,visibility?:number}[] }} obs
 * @param {{ width:number, height:number, dominant?: 'Left'|'Right', state?: object }} opts  `state` carries the arm length between frames
 * @returns {{ dom: Hand|null, other: Hand|null }|null}  null when no body is visible
 * @typedef {{ pos: number[], shape: number[]|null, image?: {x:number,y:number}[], world: number[][]|null, pointsDown: boolean, fromPose?: boolean }} Hand
 */
export function cameraFeatures(obs, { width, height, dominant = 'Right', state = null }) {
	const frame = bodyFrame(obs.pose, width, height, state);
	if (!frame) return null;
	const wrists = { Left: obs.pose?.[POSE.LEFT_WRIST], Right: obs.pose?.[POSE.RIGHT_WRIST] };
	const px = (p) => [p.x * width, p.y * height];
	const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

	// Assign detected hands to body sides.
	const bySide = { Left: null, Right: null };
	const hands = [...obs.hands];
	if (wrists.Left && wrists.Right && hands.length) {
		const cost = (h, side) => d(px(h.image[0]), px(wrists[side]));
		if (hands.length >= 2) {
			const [a, b] = hands;
			const straight = cost(a, 'Left') + cost(b, 'Right');
			const crossed = cost(a, 'Right') + cost(b, 'Left');
			bySide.Left = straight <= crossed ? a : b;
			bySide.Right = straight <= crossed ? b : a;
		} else {
			const h = hands[0];
			bySide[cost(h, 'Left') <= cost(h, 'Right') ? 'Left' : 'Right'] = h;
		}
	} else {
		for (const h of hands) if (!bySide[h.side]) bySide[h.side] = h;
	}

	const describe = (side) => {
		const h = bySide[side];
		if (h) {
			const dx = (h.image[5].x - h.image[0].x) * width;
			const dy = (h.image[5].y - h.image[0].y) * height; // image y grows downward
			return { pos: toBody(frame, h.image[0]), shape: shapeVector(h.world), image: h.image, world: h.world, pointsDown: dy > 0.5 * Math.hypot(dx, dy) };
		}
		const w = wrists[side];
		if (w && (w.visibility ?? 1) >= 0.5) return { pos: toBody(frame, w), shape: null, world: null, pointsDown: false, fromPose: true };
		return null;
	};
	const other = dominant === 'Right' ? 'Left' : 'Right';
	return { dom: describe(dominant), other: describe(other) };
}

// ── the avatar side ────────────────────────────────────────────────────────

const SHOULDER_Y = ANCHORS.shoulder.Right[1];
const SPAN = ANCHORS.shoulderSpan;
/** Height of the nose above the shoulder line on the reference body, in shoulder widths (about 0.38). */
const NOSE_UP = (ANCHORS.nose[1] - SHOULDER_Y) / SPAN;
/** Shoulder-to-wrist length of the reference arm, in shoulder widths (about 1.28). */
const ARM_SPANS = (boneLength('RightArm') + boneLength('RightForeArm')) / SPAN;

/** The 21 hand landmarks of a posed canonical rig (MediaPipe order). */
export function poseHandLandmarks(pose, side) {
	const pts = [pose.worldPos(`${side}Hand`)];
	for (const finger of ['Thumb', ...FINGERS.filter((f) => f !== 'Thumb')]) {
		pts.push(
			pose.worldPos(`${side}Hand${finger}1`),
			pose.worldPos(`${side}Hand${finger}2`),
			pose.worldPos(`${side}Hand${finger}3`),
			fingerTip(pose, side, finger),
		);
	}
	return pts;
}

/** The engine's model-space wrist position in body units (same frame as the camera). */
export function engineToBody(p) {
	return [p[0] / SPAN, (p[1] - SHOULDER_Y) / SPAN];
}

/** Features of a posed canonical rig, for templates and for synthetic tests. */
export function poseFeatures(pose, dominant = 'Right') {
	const other = dominant === 'Right' ? 'Left' : 'Right';
	const hand = (side) => {
		const lm = poseHandLandmarks(pose, side);
		const dx = lm[5][0] - lm[0][0];
		const dy = lm[5][1] - lm[0][1]; // model y grows upward
		const pointsDown = -dy > 0.5 * Math.hypot(dx, dy, lm[5][2] - lm[0][2]);
		return { pos: engineToBody(lm[0]), shape: shapeVector(lm), world: lm, pointsDown };
	};
	return { dom: hand(dominant), other: hand(other) };
}

/** Whether a hand is up in signing space. */
export const isActive = (hand) => Boolean(hand && hand.pos[1] > ACTIVE_Y);
