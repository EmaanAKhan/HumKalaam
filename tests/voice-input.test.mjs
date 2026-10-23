// VoiceInput with fake browser APIs: a scriptable SpeechRecognition, a fake
// getUserMedia, a fake clock and timers. Covers results, alternatives, restarts,
// errors and the microphone constraints.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VoiceInput, bestAlternative, levelFromSamples } from '../src/voice/voice-input.js';

function fakeWorld({ micError = null } = {}) {
	const world = { instances: [], constraints: null, stopped: 0, time: 0, intervals: new Map(), nextId: 1 };
	class FakeRecognition {
		constructor() {
			world.instances.push(this);
			this.started = false;
		}
		start() {
			this.started = true;
			queueMicrotask(() => this.onstart?.());
		}
		stop() {
			queueMicrotask(() => this.onend?.());
		}
		abort() {
			queueMicrotask(() => {
				this.onerror?.({ error: 'aborted' });
				this.onend?.();
			});
		}
		// test helpers
		say(results, resultIndex = 0) {
			this.onresult?.({ resultIndex, results });
		}
		fail(error) {
			this.onerror?.({ error });
			this.onend?.();
		}
		end() {
			this.onend?.();
		}
	}
	const mediaDevices = {
		async getUserMedia(constraints) {
			world.constraints = constraints;
			if (micError) throw Object.assign(new Error(micError), { name: micError });
			return { getTracks: () => [{ stop: () => world.stopped++ }] };
		},
	};
	const opts = {
		Recognition: FakeRecognition,
		mediaDevices,
		AudioContextCtor: null, // meter off in most tests
		now: () => world.time,
		setInterval: (fn) => {
			const id = world.nextId++;
			world.intervals.set(id, fn);
			return id;
		},
		clearInterval: (id) => world.intervals.delete(id),
	};
	return { world, opts };
}

const result = (isFinal, ...alts) => Object.assign(alts.map(([transcript, confidence]) => ({ transcript, confidence })), { isFinal });
const tick = () => new Promise((r) => setTimeout(r, 0));

test('unsupported browser reports clearly and does not start', async () => {
	const errors = [];
	const v = new VoiceInput({ Recognition: null, onError: (m, c) => errors.push(c) });
	assert.equal(v.supported, false);
	assert.equal(await v.start(), false);
	assert.deepEqual(errors, ['unsupported']);
});

test('opens the mic with noise suppression, echo cancellation and gain control', async () => {
	const { world, opts } = fakeWorld();
	const v = new VoiceInput(opts);
	await v.start();
	assert.deepEqual(world.constraints.audio, { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 });
	const rec = world.instances[0];
	assert.equal(rec.lang, 'en-US');
	assert.equal(rec.continuous, true);
	assert.equal(rec.interimResults, true);
	assert.equal(rec.maxAlternatives, 3);
});

test('interim text streams, final text is emitted once with the best alternative', async () => {
	const { world, opts } = fakeWorld();
	const interim = [];
	const finals = [];
	const v = new VoiceInput({ ...opts, onInterim: (t) => interim.push(t), onFinal: (r) => finals.push(r) });
	await v.start();
	await tick();
	const rec = world.instances[0];
	rec.say([result(false, ['hello my', 0])]);
	rec.say([result(true, ['hello my name is Ali', 0.62], ['hello my name is Alley', 0.81])]);
	rec.say([result(true, ['hello my name is Ali', 0.62]), result(false, ['I need', 0])], 1);
	assert.deepEqual(interim, ['hello my', '', 'I need']);
	assert.deepEqual(finals, [{ text: 'hello my name is Alley', confidence: 0.81 }]);
});

test('bestAlternative keeps the top-ranked one when confidences are unknown (0)', () => {
	assert.equal(bestAlternative(result(true, ['first', 0], ['second', 0])).text, 'first');
	assert.equal(bestAlternative(result(true, ['first', 0.4], ['second', 0.9])).text, 'second');
});

test('a session the browser ends is restarted while the user still listens', async () => {
	const { world, opts } = fakeWorld();
	const v = new VoiceInput(opts);
	await v.start();
	await tick();
	world.instances[0].end();
	assert.equal(world.instances.length, 2);
	assert.equal(v.wanted, true);
});

test('repeated immediate endings stop with a message instead of looping', async () => {
	const { world, opts } = fakeWorld();
	const errors = [];
	const v = new VoiceInput({ ...opts, onError: (m, c) => errors.push(c) });
	await v.start();
	for (let i = 0; i < 10 && v.wanted; i++) world.instances.at(-1).end();
	assert.deepEqual(errors, ['restart-loop']);
	assert.equal(v.state, 'idle');
	assert.equal(world.stopped, 1, 'microphone released');
});

test('restarts spread over time are allowed indefinitely', async () => {
	const { world, opts } = fakeWorld();
	const v = new VoiceInput(opts);
	await v.start();
	for (let i = 0; i < 20; i++) {
		world.time += 5000;
		world.instances.at(-1).end();
	}
	assert.equal(v.wanted, true);
	assert.equal(world.instances.length, 21);
});

test('"no speech" is a hint and listening continues', async () => {
	const { world, opts } = fakeWorld();
	const hints = [];
	const errors = [];
	const v = new VoiceInput({ ...opts, onState: (s, h) => h && hints.push(h), onError: (m, c) => errors.push(c) });
	await v.start();
	await tick();
	world.instances[0].fail('no-speech');
	assert.equal(errors.length, 0);
	assert.match(hints[0], /can’t hear/);
	assert.equal(v.wanted, true);
	assert.equal(world.instances.length, 2);
});

for (const code of ['not-allowed', 'audio-capture', 'network', 'language-not-supported']) {
	test(`"${code}" stops listening with a clear message`, async () => {
		const { world, opts } = fakeWorld();
		const errors = [];
		const v = new VoiceInput({ ...opts, onError: (m, c) => errors.push([c, m]) });
		await v.start();
		await tick();
		world.instances[0].fail(code);
		assert.equal(errors.length, 1);
		assert.equal(errors[0][0], code);
		assert.ok(errors[0][1].length > 20);
		assert.equal(v.state, 'idle');
		assert.equal(world.instances.length, 1, 'no restart after a fatal error');
	});
}

test('denied microphone permission fails before recognition starts', async () => {
	const { world, opts } = fakeWorld({ micError: 'NotAllowedError' });
	const errors = [];
	const v = new VoiceInput({ ...opts, onError: (m, c) => errors.push(c) });
	assert.equal(await v.start(), false);
	assert.deepEqual(errors, ['not-allowed']);
	assert.equal(world.instances.length, 0);
});

test('stop delivers pending results, does not restart, and releases the microphone', async () => {
	const { world, opts } = fakeWorld();
	const states = [];
	const v = new VoiceInput({ ...opts, onState: (s) => states.push(s) });
	await v.start();
	await tick();
	v.stop();
	await tick();
	assert.equal(world.instances.length, 1);
	assert.equal(v.state, 'idle');
	assert.equal(world.stopped, 1);
	assert.deepEqual(states, ['starting', 'listening', 'stopping', 'idle']);
});

test('changing language restarts recognition on the new language', async () => {
	const { world, opts } = fakeWorld();
	const v = new VoiceInput(opts);
	await v.start();
	await tick();
	v.setLanguage('en-PK');
	await tick();
	assert.equal(world.instances.length, 2);
	assert.equal(world.instances[1].lang, 'en-PK');
});

test('level meter maps silence to 0 and a loud signal near 1', () => {
	assert.equal(levelFromSamples(new Uint8Array(512).fill(128)), 0);
	const loud = Uint8Array.from({ length: 512 }, (_, i) => (i % 2 ? 250 : 6));
	assert.ok(levelFromSamples(loud) > 0.95);
	const soft = Uint8Array.from({ length: 512 }, (_, i) => (i % 2 ? 130 : 126));
	assert.ok(levelFromSamples(soft) < 0.3);
});

test('a long quiet stretch while listening gives a "speak closer" hint', async () => {
	const { world, opts } = fakeWorld();
	const hints = [];
	let sample = 128;
	const AudioContextCtor = class {
		createMediaStreamSource() {
			return { connect() {} };
		}
		createAnalyser() {
			return { fftSize: 0, getByteTimeDomainData: (b) => b.fill(sample) };
		}
		close() {}
	};
	const v = new VoiceInput({ ...opts, AudioContextCtor, onState: (s, h) => h && hints.push(h) });
	await v.start();
	await tick();
	const meter = [...world.intervals.values()][0];
	for (let i = 0; i < 10; i++) {
		world.time += 1000;
		meter();
	}
	assert.equal(hints.length, 1);
	assert.match(hints[0], /very quiet/);
	sample = 200; // the user speaks up
	world.time += 1000;
	meter();
	assert.equal(v._quietSince, null);
});
