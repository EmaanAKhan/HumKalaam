#!/usr/bin/env node
// Convert a GLB's KHR_materials_pbrSpecularGlossiness materials to the core
// metallic-roughness model, in place.
//
// three.js dropped support for the spec-gloss extension, so a GLB that keeps its
// colour textures there renders untextured grey. For these materials (all with
// specularFactor 0) the conversion is lossless in practice:
//   diffuseTexture -> baseColorTexture, diffuseFactor -> baseColorFactor,
//   metallic 0, roughness = 1 - glossiness.
//
//   node scripts/fix-avatar-materials.mjs public/avatar.glb

import { readFileSync, writeFileSync } from 'node:fs';

const EXT = 'KHR_materials_pbrSpecularGlossiness';
const file = process.argv[2];
if (!file) throw new Error('usage: fix-avatar-materials.mjs <file.glb>');

const buf = readFileSync(file);
if (buf.toString('ascii', 0, 4) !== 'glTF') throw new Error('not a GLB');
const jsonLen = buf.readUInt32LE(12);
if (buf.readUInt32LE(16) !== 0x4e4f534a) throw new Error('first chunk is not JSON');
const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
const rest = buf.subarray(20 + jsonLen); // BIN chunk(s), unchanged

let converted = 0;
for (const m of gltf.materials ?? []) {
	const sg = m.extensions?.[EXT];
	if (!sg) continue;
	const pbr = { metallicFactor: 0, roughnessFactor: 1 - (sg.glossinessFactor ?? 1) };
	if (sg.diffuseFactor) pbr.baseColorFactor = sg.diffuseFactor;
	if (sg.diffuseTexture) pbr.baseColorTexture = sg.diffuseTexture;
	m.pbrMetallicRoughness = pbr;
	delete m.extensions[EXT];
	if (!Object.keys(m.extensions).length) delete m.extensions;
	converted++;
}
for (const key of ['extensionsUsed', 'extensionsRequired']) {
	if (!gltf[key]) continue;
	gltf[key] = gltf[key].filter((e) => e !== EXT);
	if (!gltf[key].length) delete gltf[key];
}

let json = Buffer.from(JSON.stringify(gltf), 'utf8');
const pad = (4 - (json.length % 4)) % 4;
json = Buffer.concat([json, Buffer.alloc(pad, 0x20)]);
const header = Buffer.alloc(20);
header.write('glTF', 0, 'ascii');
header.writeUInt32LE(2, 4);
header.writeUInt32LE(20 + json.length + rest.length, 8);
header.writeUInt32LE(json.length, 12);
header.writeUInt32LE(0x4e4f534a, 16);
writeFileSync(file, Buffer.concat([header, json, rest]));
console.log(`${file}: converted ${converted} material(s) to metallic-roughness`);
