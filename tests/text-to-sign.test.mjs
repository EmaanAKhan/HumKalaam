import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../src/text-to-sign/normalize.js';
import { planUtterance, vocabulary, glossFor, MAX_SECONDS } from '../src/text-to-sign/plan.js';

test('normalize: case, punctuation and whitespace', () => {
	const t = tokenize('  Hello,   WORLD!!  ');
	assert.deepEqual(t.map((x) => x.word), ['HELLO', 'WORLD']);
	assert.ok(t.every((x) => x.supported));
});

test('normalize: apostrophes, hyphens and slashes', () => {
	assert.deepEqual(tokenize("I'm well-known/ok").map((x) => x.word), ['IM', 'WELL', 'KNOWN', 'OK']);
});

test('normalize: pure punctuation is not a word', () => {
	assert.deepEqual(tokenize('... !!! ?'), []);
});

test('normalize: accents and other scripts are unsupported, never partly spelled', () => {
	const t = tokenize('café سلام naïve 5');
	assert.deepEqual(t.map((x) => x.supported), [false, false, false, true]);
	assert.equal(t[0].word, null);
	assert.match(t[0].reason, /É/);
});

test('plan: empty input gives a clear message and no clip', () => {
	const p = planUtterance('   ');
	assert.equal(p.ok, false);
	assert.equal(p.clip, null);
	assert.match(p.message, /Type a word/);
});

test('plan: only unsupported words gives a clear message and no clip', () => {
	const p = planUtterance('سلام دنیا');
	assert.equal(p.ok, false);
	assert.equal(p.clip, null);
	assert.equal(p.items.length, 2);
	assert.ok(p.items.every((i) => i.kind === 'unsupported'));
});

test('plan: vocabulary words are signed, others fingerspelled, order kept', () => {
	const p = planUtterance('Hello my name is Ali');
	assert.equal(p.ok, true);
	assert.deepEqual(
		p.items.map((i) => [i.word, i.kind]),
		[['HELLO', 'signed'], ['MY', 'signed'], ['NAME', 'signed'], ['IS', 'omitted'], ['ALI', 'spelled']],
	);
	// "is" is not performed and has no time span; the rest run strictly in order.
	assert.equal(p.items[3].start, null);
	assert.match(p.items[3].reason, /to be/);
	const performed = p.items.filter((i) => i.start != null);
	for (let i = 1; i < performed.length; i++) assert.ok(performed[i].start >= performed[i - 1].end);
	assert.ok(Math.abs(performed.at(-1).end - p.duration) < 1e-9);
	// A spelled word lists its letters in order.
	assert.deepEqual(p.items[4].letters.map((l) => l.letter), ['A', 'L', 'I']);
	// A signed word carries its plain-English description.
	assert.equal(p.items[0].gloss, glossFor('hello'));
	assert.ok(p.items[0].gloss.length > 10);
});

test('plan: unsupported words are reported and skipped, the rest still performed', () => {
	const p = planUtterance('thank you سلام');
	assert.equal(p.ok, true);
	assert.deepEqual(p.items.map((i) => i.kind), ['signed', 'signed', 'unsupported']);
	assert.equal(p.items[2].start, null);
});

test('plan: the clip targets canonical arm, hand and finger bones', () => {
	const { clip } = planUtterance('hello');
	const names = new Set(clip.tracks.map((t) => t.name));
	for (const bone of ['RightArm', 'RightForeArm', 'RightHand', 'RightHandIndex1', 'RightHandThumb1', 'LeftHand']) {
		assert.ok(names.has(`${bone}.quaternion`), `missing ${bone}`);
	}
	for (const t of clip.tracks) {
		assert.equal(t.values.length, t.times.length * (t.type === 'quaternion' ? 4 : 3));
		for (let i = 1; i < t.times.length; i++) assert.ok(t.times[i] >= t.times[i - 1], `${t.name} times go backwards`);
	}
});

test('plan: slower speed makes a longer clip', () => {
	const fast = planUtterance('nice to meet you', { rate: 1 }).duration;
	const slow = planUtterance('nice to meet you', { rate: 0.5 }).duration;
	assert.ok(slow > fast * 1.5, `${slow} vs ${fast}`);
});

test('plan: left-handed signing moves the left hand more than the right', () => {
	const motion = (clip, bone) => {
		const t = clip.tracks.find((x) => x.name === `${bone}.quaternion`);
		let sum = 0;
		for (let i = 4; i < t.values.length; i++) sum += Math.abs(t.values[i] - t.values[i - 4]);
		return sum;
	};
	const right = planUtterance('abc', { dominant: 'Right' }).clip;
	const left = planUtterance('abc', { dominant: 'Left' }).clip;
	assert.ok(motion(right, 'RightForeArm') > motion(right, 'LeftForeArm'));
	assert.ok(motion(left, 'LeftForeArm') > motion(left, 'RightForeArm'));
});

test('plan: very long text is cut and the cut words are reported', () => {
	const p = planUtterance(Array(80).fill('xylophone').join(' '));
	assert.equal(p.ok, true);
	assert.ok(p.duration <= MAX_SECONDS);
	const cut = p.items.filter((i) => i.kind === 'cut');
	assert.ok(cut.length > 0);
	assert.ok(cut.every((i) => /longer than/.test(i.reason)));
});

test('plan: a message of only articles, "to be" and "to" is not signed', () => {
	const p = planUtterance('the is a');
	assert.equal(p.ok, false);
	assert.match(p.message, /not signed in ASL/);
	assert.ok(p.items.every((i) => i.kind === 'omitted'));
});

test('plan: everyday sentence uses the new vocabulary', () => {
	const p = planUtterance('My mother is sick, I need a doctor and water today');
	const kinds = Object.fromEntries(p.items.map((i) => [i.word, i.kind]));
	for (const w of ['MY', 'MOTHER', 'SICK', 'I', 'NEED', 'DOCTOR', 'AND', 'WATER', 'TODAY']) assert.equal(kinds[w], 'signed', w);
	assert.equal(kinds.IS, 'omitted');
	assert.equal(kinds.A, 'omitted');
});

test('plan: rejects an unknown speed', () => {
	assert.throws(() => planUtterance('hi', { rate: 3 }));
});

test('vocabulary: deduplicated and every word has a gloss', () => {
	const v = vocabulary();
	assert.equal(new Set(v).size, v.length);
	assert.ok(v.length >= 300);
	for (const w of v) assert.ok(glossFor(w), `${w} has no gloss`);
});
