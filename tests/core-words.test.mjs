import test from 'node:test';
import assert from 'node:assert/strict';
import { CORE_WORDS, coreTemplates } from '../src/camera/core-words.js';
import { findSign } from '../src/text-to-sign/lexicon.js';

test('core words: 20 distinct words, each with a sign the avatar can perform', () => {
	assert.equal(CORE_WORDS.length, 20);
	assert.equal(new Set(CORE_WORDS).size, 20);
	for (const w of CORE_WORDS) assert.ok(findSign(w), `${w} has no sign`);
});

test('core words: a camera reference exists for every word, for either hand', () => {
	for (const hand of ['Right', 'Left']) {
		const names = coreTemplates(hand).map((t) => t.name).sort();
		assert.deepEqual(names, [...CORE_WORDS].sort());
	}
});
