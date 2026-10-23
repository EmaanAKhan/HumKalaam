// Steps 4-5 of the pipeline: animation mapping and avatar playback.
//
// The scene is plain three.js. Retargeting is NOT reimplemented here: the
// vendored three.ws AnimationManager maps the canonical clip tracks (Hips,
// RightArm, RightHandIndex1, ...) onto whatever bone names the loaded rig uses
// (Unreal `upperarm_r`, Mixamo `mixamorig:RightArm`, ...) and corrects for the
// rig's own rest pose.

import {
	ACESFilmicToneMapping,
	Box3,
	DirectionalLight,
	HemisphereLight,
	PerspectiveCamera,
	PMREMGenerator,
	Scene,
	SRGBColorSpace,
	Timer,
	Vector3,
	WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { AnimationManager } from '../vendor/three-ws/animation-manager.js';
import { SignTimeline } from '../vendor/three-ws/sign-clip.js';

const REST = 'rest';
const UTTERANCE = 'utterance';

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

export class AvatarStage {
	/** @param {HTMLElement} host */
	constructor(host) {
		this.host = host;
		this.anim = new AnimationManager();
		this.model = null;
		this.utterance = null; // the AnimationAction of the current utterance
		this.duration = 0;
		this.onFinished = null;
		this._timer = new Timer();

		// Transparent canvas: the page's light gradient is the backdrop.
		const renderer = new WebGLRenderer({ antialias: true, alpha: true });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
		renderer.outputColorSpace = SRGBColorSpace;
		renderer.toneMapping = ACESFilmicToneMapping;
		renderer.domElement.setAttribute('role', 'img');
		renderer.domElement.setAttribute('aria-label', '3D avatar performing the signs');
		host.appendChild(renderer.domElement);
		this.renderer = renderer;

		this.scene = new Scene();
		// Soft studio light for the PBR materials (generated locally, no download),
		// plus a warm key from the front-right so the hands read with depth.
		const pmrem = new PMREMGenerator(renderer);
		this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
		pmrem.dispose();
		this.scene.environmentIntensity = 0.9;
		this.scene.add(new HemisphereLight(0xffffff, 0x8a93a6, 0.6));
		const key = new DirectionalLight(0xfff4e8, 1.6);
		key.position.set(1.2, 2.6, 2.4);
		this.scene.add(key);

		this.camera = new PerspectiveCamera(30, 1, 0.01, 100);
		this.controls = new OrbitControls(this.camera, renderer.domElement);
		this.controls.enableDamping = true;

		new ResizeObserver(() => this._resize()).observe(host);
		this._resize();
		renderer.setAnimationLoop(() => this._tick());
	}

	/**
	 * Load a GLB and bind the animation system to it.
	 * @returns {Promise<{ supported: boolean, bones: number }>}
	 */
	async load(url) {
		this.stop();
		if (this.model) {
			this.anim.detach();
			this.scene.remove(this.model);
			this.model = null;
		}
		this.anim.clips.clear(); // clips are re-injected per rig
		const gltf = await loader.loadAsync(url);
		const model = gltf.scene;
		model.traverse((n) => {
			if (n.isMesh) n.frustumCulled = false;
		});
		this.scene.add(model);
		this.model = model;
		this._frame();

		this.anim.attach(model);
		const supported = this.anim.supportsCanonicalClips();
		const bones = this.anim._canonicalToNode?.size ?? 0;
		if (supported) {
			// A quiet, breathing resting pose so the avatar never stands in T-pose.
			const rest = new SignTimeline().hold(4).build({ name: REST });
			this.anim.injectClip(REST, rest, { loop: true });
			await this.anim.crossfadeTo(REST, 0);
		}
		return { supported, bones };
	}

	/** Frame the signing space: head to waist, both hands in view. */
	_frame() {
		const box = new Box3().setFromObject(this.model);
		const size = box.getSize(new Vector3());
		this.model.position.y -= box.min.y; // feet on the floor
		const h = size.y || 1.7;
		const target = new Vector3(0, h * 0.72, 0);
		this.camera.position.set(0, h * 0.75, h * 1.45);
		this.camera.near = h / 100;
		this.camera.far = h * 50;
		this.camera.updateProjectionMatrix();
		this.controls.target.copy(target);
		this.controls.update();
		this._home = { position: this.camera.position.clone(), target };
	}

	resetView() {
		if (!this._home) return;
		this.camera.position.copy(this._home.position);
		this.controls.target.copy(this._home.target);
		this.controls.update();
	}

	/** Replace the current utterance with `clip` (canonical clip JSON) and play it. */
	async play(clip) {
		this._dropUtterance();
		this.anim.injectClip(UTTERANCE, clip, { loop: false });
		const action = this.anim.actions.get(UTTERANCE);
		if (!action) throw new Error('This avatar could not be bound to the signing clip.');
		this.utterance = action;
		this.duration = clip.duration;
		this._userPaused = false;
		this._finishedFired = false;
		await this.anim.playOnce(UTTERANCE, { settleTo: REST, fadeIn: 0.15, fade: 0.3 });
	}

	/** Play the current utterance again from the start. */
	async replay() {
		if (!this.utterance) return;
		this.utterance.paused = false;
		this._userPaused = false;
		this._finishedFired = false;
		this.anim.currentName = null; // let playOnce restart the same clip
		await this.anim.playOnce(UTTERANCE, { settleTo: REST, fadeIn: 0.15, fade: 0.3 });
	}

	/** Pause or resume. Returns the new paused state. */
	togglePause() {
		if (!this.utterance || !this.isPlaying()) return false;
		// three.js also sets `paused` itself when a clamped one-shot finishes, so
		// the user's pause is tracked separately.
		this._userPaused = !this._userPaused;
		this.utterance.paused = this._userPaused;
		return this._userPaused;
	}

	/** Stop signing and return to the resting pose. */
	stop() {
		if (!this.utterance) return;
		this.utterance.paused = false;
		this._userPaused = false;
		this.utterance.stop();
		this.anim.currentAction = null;
		this.anim.currentName = null;
		this.anim.crossfadeTo(REST, 0.25);
		this._finishedFired = true;
	}

	isPlaying() {
		return Boolean(this.utterance && (this.utterance.isRunning() || this._userPaused));
	}

	/** Seconds into the current utterance (0 when idle). */
	currentTime() {
		return this.isPlaying() ? this.utterance.time : 0;
	}

	_dropUtterance() {
		const a = this.anim.actions.get(UTTERANCE);
		if (a) {
			a.stop();
			const clip = a.getClip();
			this.anim.mixer.uncacheAction(clip);
			this.anim.mixer.uncacheClip(clip);
		}
		this.anim.actions.delete(UTTERANCE);
		this.anim.clips.delete(UTTERANCE);
		if (this.anim.currentName === UTTERANCE) {
			this.anim.currentAction = null;
			this.anim.currentName = null;
		}
		this.utterance = null;
	}

	_tick() {
		this._timer.update();
		this.anim.update(this._timer.getDelta());
		if (this.utterance && !this._finishedFired && !this.isPlaying()) {
			this._finishedFired = true;
			this.onFinished?.();
		}
		this.controls.update();
		this.renderer.render(this.scene, this.camera);
	}

	_resize() {
		const w = this.host.clientWidth || 1;
		const h = this.host.clientHeight || 1;
		this.renderer.setSize(w, h, false);
		this.camera.aspect = w / h;
		this.camera.updateProjectionMatrix();
	}
}
