// Plays real signing clips on the real avatar skeletons, in Node.
//
// The GLB's bone hierarchy and rest transforms are read straight from the file
// (no textures or meshes needed), wrapped in a SkinnedMesh, and driven through
// the same AnimationManager the browser uses. The checks are geometric: during
// HELLO the right hand must rise to head height, and during fingerspelling it
// must sit in front of the chest. A broken retarget (wrong axes, arms through
// the body, avatar lying down) fails these.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Bone, BufferGeometry, Group, MeshBasicMaterial, Skeleton, SkinnedMesh, Vector3 } from 'three';
import { AnimationManager } from '../src/vendor/three-ws/animation-manager.js';
import { canonicalizeBoneName } from '../src/vendor/three-ws/glb-canonicalize.js';
import { planUtterance } from '../src/text-to-sign/plan.js';

const RIGS = {
	'Hum Kalaam avatar': new URL('../public/avatar.glb', import.meta.url),
};

function readGltfJson(url) {
	const buf = readFileSync(url);
	assert.equal(buf.toString('ascii', 0, 4), 'glTF');
	const len = buf.readUInt32LE(12);
	return JSON.parse(buf.subarray(20, 20 + len).toString('utf8'));
}

/** Rebuild the skin's skeleton as three.js bones in their authored rest pose. */
function loadSkeleton(url) {
	const gltf = readGltfJson(url);
	const skin = gltf.skins[0];
	const jointSet = new Set(skin.joints);
	const objects = gltf.nodes.map((n) => {
		const o = jointSet.has(gltf.nodes.indexOf(n)) ? new Bone() : new Group();
		o.name = n.name ?? '';
		if (n.translation) o.position.fromArray(n.translation);
		if (n.rotation) o.quaternion.fromArray(n.rotation);
		if (n.scale) o.scale.fromArray(n.scale);
		return o;
	});
	gltf.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => objects[i].add(objects[c])));
	const root = new Group();
	const scene = gltf.scenes[gltf.scene ?? 0];
	for (const i of scene.nodes) root.add(objects[i]);
	const bones = skin.joints.map((i) => objects[i]);
	const mesh = new SkinnedMesh(new BufferGeometry(), new MeshBasicMaterial());
	root.add(mesh);
	root.updateMatrixWorld(true);
	mesh.bind(new Skeleton(bones));
	return root;
}

function boneByCanonical(root, canonical) {
	let found = null;
	root.traverse((o) => {
		if (!found && o.isBone && canonicalizeBoneName(o.name) === canonical) found = o;
	});
	assert.ok(found, `no bone maps to ${canonical}`);
	return found;
}

const world = (o) => o.getWorldPosition(new Vector3());

for (const [label, url] of Object.entries(RIGS)) {
	test(`${label}: signing clips bind and move the hand to the right places`, () => {
		const root = loadSkeleton(url);
		const head = boneByCanonical(root, 'Head');
		const hips = boneByCanonical(root, 'Hips');
		const rHand = boneByCanonical(root, 'RightHand');
		const rShoulder = boneByCanonical(root, 'RightArm');
		const rIndex = boneByCanonical(root, 'RightHandIndex1');

		const anim = new AnimationManager();
		anim.attach(root);
		assert.equal(anim.supportsCanonicalClips(), true);

		// Body scale and facing, from the rest pose.
		const headY = world(head).y;
		const hipsY = world(hips).y;
		const torso = headY - hipsY;
		assert.ok(torso > 0, 'head is above hips at rest');
		const restIndex = rIndex.quaternion.clone();

		// HELLO: "flat hand salutes out from the temple" -> the hand reaches head height.
		const hello = planUtterance('hello');
		anim.injectClip('hello', hello.clip, { loop: false });
		const action = anim.actions.get('hello');
		assert.ok(action, 'clip bound to this rig');
		action.play();
		let peak = -Infinity;
		for (let t = 0; t <= hello.duration; t += 0.05) {
			anim.mixer.setTime(t);
			root.updateMatrixWorld(true);
			peak = Math.max(peak, world(rHand).y);
			// The avatar never tips over: head stays well above hips throughout.
			assert.ok(world(head).y - world(hips).y > torso * 0.8, `body tipped at t=${t.toFixed(2)}`);
		}
		assert.ok(peak > world(rShoulder).y, `hand peak ${peak.toFixed(3)} not above shoulder`);
		assert.ok(peak > headY - torso * 0.3, `hand peak ${peak.toFixed(3)} not near head (${headY.toFixed(3)})`);
		action.stop();

		// Fingerspelling "A": hand held in front of the chest, fingers curled.
		const spell = planUtterance('ab'); // a lone "a" is the article, which is omitted
		anim.injectClip('spell-a', spell.clip, { loop: false });
		const a = anim.actions.get('spell-a');
		a.play();
		const letter = spell.items[0].letters[0];
		anim.mixer.setTime((letter.start + letter.end) / 2);
		root.updateMatrixWorld(true);
		const handY = world(rHand).y;
		assert.ok(handY > hipsY && handY < headY, `hand at ${handY.toFixed(3)} is not between hips and head`);
		const curl = rIndex.quaternion.angleTo(restIndex);
		assert.ok(curl > 0.5, `index finger barely moved for A (${curl.toFixed(2)} rad)`);
	});
}
