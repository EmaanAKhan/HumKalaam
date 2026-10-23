import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SignQueue } from '../src/voice/sign-queue.js';

test('signs immediately when the avatar is free', () => {
	const played = [];
	const q = new SignQueue({ isBusy: () => false, play: (t) => played.push(t) });
	q.push('hello');
	assert.deepEqual(played, ['hello']);
	assert.deepEqual(q.pending, []);
});

test('waits while busy, then signs everything waiting as one utterance, in order', () => {
	let busy = true;
	const played = [];
	const q = new SignQueue({ isBusy: () => busy, play: (t) => played.push(t) });
	q.push('I am hungry');
	q.push('  can we eat now ');
	assert.deepEqual(played, []);
	q.pump();
	assert.deepEqual(played, []);
	busy = false;
	q.pump();
	assert.deepEqual(played, ['I am hungry can we eat now']);
	q.pump();
	assert.equal(played.length, 1, 'nothing signed twice');
});

test('blank sentences are ignored and clear() drops what is waiting', () => {
	const changes = [];
	const q = new SignQueue({ isBusy: () => true, play: () => assert.fail('should not play'), onChange: (p) => changes.push(p.length) });
	q.push('   ');
	q.push('water please');
	q.clear();
	assert.deepEqual(q.pending, []);
	assert.deepEqual(changes, [1, 0]);
});
