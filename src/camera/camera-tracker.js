// Webcam -> hand and body landmarks, every frame, in the browser.
//
// MediaPipe Tasks (vision) runs on this device. The library is bundled from npm, and its WASM runtime
// (public/mediapipe/wasm) and the two models (public/models, about 25 MB with the runtime) are served
// by this app itself, so the first load does not depend on slow third-party CDNs. They start loading
// as soon as the camera tab is opened (preload), and are cached by the browser after that. Video and
// landmarks never leave the device.
//
//   HandLandmarker  21 points per hand, up to 2 hands, plus 3D "world" points
//   PoseLandmarker  33 body points; only the shoulders are used, as the frame
//                   the hand positions are measured in

import { FilesetResolver, HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';
import { HAND_CONNECTIONS } from '../vendor/three-ws/sign-hand-model.js';

const BASE = import.meta.env?.BASE_URL ?? '/';
const WASM = `${BASE}mediapipe/wasm`;
const HAND_MODEL = `${BASE}models/hand_landmarker.task`;
const POSE_MODEL = `${BASE}models/pose_landmarker_lite.task`;

async function create(Task, vision, modelAssetPath, extra) {
	const base = { runningMode: 'VIDEO', ...extra };
	try {
		return await Task.createFromOptions(vision, { baseOptions: { modelAssetPath, delegate: 'GPU' }, ...base });
	} catch {
		// No usable WebGL: the CPU path is slower but works everywhere.
		return Task.createFromOptions(vision, { baseOptions: { modelAssetPath, delegate: 'CPU' }, ...base });
	}
}

export class CameraTracker {
	/**
	 * @param {{ video: HTMLVideoElement, overlay?: HTMLCanvasElement,
	 *           onFrame: (obs: object, t: number, size: {width:number,height:number}) => void,
	 *           onState?: (state: string, message?: string) => void }} opts
	 */
	constructor({ video, overlay = null, onFrame, onState = () => {} }) {
		this.video = video;
		this.overlay = overlay;
		this.onFrame = onFrame;
		this.onState = onState;
		this.hands = null;
		this.pose = null;
		this.stream = null;
		this.running = false;
		this._raf = 0;
		this._lastVideoTime = -1;
	}

	static get supported() {
		return Boolean(globalThis.navigator?.mediaDevices?.getUserMedia);
	}

	/** Start loading the trackers without opening the camera (called when the camera tab opens). */
	preload() {
		if (!this._loading) {
			this._loading = (async () => {
				const vision = await FilesetResolver.forVisionTasks(WASM);
				[this.hands, this.pose] = await Promise.all([
					create(HandLandmarker, vision, HAND_MODEL, { numHands: 2, minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5 }),
					create(PoseLandmarker, vision, POSE_MODEL, { numPoses: 1, minPoseDetectionConfidence: 0.5, minTrackingConfidence: 0.5 }),
				]);
			})();
			this._loading.catch(() => (this._loading = null)); // a failed load can be retried
		}
		return this._loading;
	}

	get ready() {
		return Boolean(this.hands && this.pose);
	}

	async _loadModels() {
		if (this.ready) return;
		this.onState('loading', 'Loading the hand and body trackers (first time only)…');
		await this.preload();
	}

	async start() {
		if (this.running) return true;
		if (!CameraTracker.supported) {
			this.onState('error', 'This browser cannot open a camera.');
			return false;
		}
		try {
			this.onState('starting', 'Starting the camera… allow access if the browser asks.');
			this.stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
				audio: false,
			});
		} catch (err) {
			const denied = err?.name === 'NotAllowedError' || err?.name === 'SecurityError';
			this.onState('error', denied ? 'Camera permission was denied. Allow the camera for this site, then try again.' : 'No camera was found, or it is being used by another app.');
			return false;
		}
		this.video.srcObject = this.stream;
		this.video.muted = true;
		this.video.playsInline = true;
		await this.video.play();
		try {
			await this._loadModels();
		} catch (err) {
			console.error(err);
			this.stop();
			this.onState('error', 'The hand tracker could not be loaded.');
			return false;
		}
		this.running = true;
		this.onState('running', 'Camera on. Sign in front of the camera, with your shoulders in view.');
		this._loop();
		return true;
	}

	stop() {
		this.running = false;
		cancelAnimationFrame(this._raf);
		for (const track of this.stream?.getTracks?.() ?? []) track.stop();
		this.stream = null;
		this.video.srcObject = null;
		this.overlay?.getContext('2d')?.clearRect(0, 0, this.overlay.width, this.overlay.height);
		this.onState('stopped', 'Camera off.');
	}

	_loop() {
		if (!this.running) return;
		this._raf = requestAnimationFrame(() => this._loop());
		const v = this.video;
		if (v.readyState < 2 || v.currentTime === this._lastVideoTime) return;
		this._lastVideoTime = v.currentTime;
		const now = performance.now();
		const obs = this.detect(v, now);
		const size = { width: v.videoWidth, height: v.videoHeight };
		this._draw(obs, size);
		this.onFrame(obs, now, size);
	}

	/**
	 * Landmarks for one image (video, canvas or image element), unmirrored.
	 * Exposed so the avatar's own rendering can be fed through the same path in tests.
	 */
	detect(source, now) {
		// MediaPipe's VIDEO mode rejects a timestamp that is not strictly later
		// than the previous one (two frames in the same millisecond would throw).
		const ts = Math.max(Math.floor(now), (this._lastTs ?? -1) + 1);
		this._lastTs = ts;
		const h = this.hands.detectForVideo(source, ts);
		const p = this.pose.detectForVideo(source, ts);
		const hands = (h.landmarks ?? []).map((image, i) => {
			// On an unmirrored frame (what the camera delivers here), MediaPipe's
			// label is the person's own hand: measured on rendered frames, the hand
			// on the same side as pose landmark 11 (the left shoulder) is "Left".
			const side = h.handedness?.[i]?.[0]?.categoryName === 'Left' ? 'Left' : 'Right';
			const world = (h.worldLandmarks?.[i] ?? image).map((q) => [q.x, q.y, q.z ?? 0]);
			return { side, image, world, score: h.handedness?.[i]?.[0]?.score ?? 0 };
		});
		return { hands, pose: p.landmarks?.[0] ?? null };
	}

	_draw(obs, { width, height }) {
		const c = this.overlay;
		if (!c) return;
		if (c.width !== width || c.height !== height) {
			c.width = width;
			c.height = height;
		}
		const g = c.getContext('2d');
		g.clearRect(0, 0, width, height);
		g.lineWidth = Math.max(2, width / 320);
		for (const hand of obs.hands) {
			g.strokeStyle = hand.side === 'Right' ? '#2f6fed' : '#1f9d5a';
			g.beginPath();
			for (const [a, b] of HAND_CONNECTIONS) {
				g.moveTo(hand.image[a].x * width, hand.image[a].y * height);
				g.lineTo(hand.image[b].x * width, hand.image[b].y * height);
			}
			g.stroke();
		}
		if (obs.pose) {
			g.fillStyle = '#e3b341';
			for (const i of [11, 12]) {
				const q = obs.pose[i];
				if (q) g.fillRect(q.x * width - 5, q.y * height - 5, 10, 10);
			}
		}
	}
}
