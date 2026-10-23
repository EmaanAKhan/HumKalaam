// Teach mode: the camera learns signs from the person using it.
//
// Matching a real signer against the avatar's own sign paths is unreliable
// (bodies, cameras and signing styles differ), so the most accurate recogniser
// available without training data is one built from the user's own examples:
// sign a word a few times, and later signing is compared with those
// recordings (nearest neighbour by dynamic time warping).
//
// Samples are kept in this browser (IndexedDB), and can be exported to a JSON
// file and imported again, to back them up or move them to another device.

import { dtw } from './recognizer.js';
import { isActive } from './features.js';

// ── recording one sample ────────────────────────────────────────────────────

/**
 * Records one sign: starts when a hand comes up into signing space, ends when
 * the hands go back down (or after `maxMs`). Feed it camera feature frames.
 */
export class SampleRecorder {
	constructor({ maxMs = 5000, dropMs = 350, minFrames = 6 } = {}) {
		this.maxMs = maxMs;
		this.dropMs = dropMs;
		this.minFrames = minFrames;
		this.reset();
	}

	reset() {
		this.frames = [];
		this.sawDown = false; // hands must be down once first, so a sign is captured from its start
		this.startT = null;
		this.downSince = null;
		this.done = false;
	}

	/** @returns {'lower'|'waiting'|'recording'|'done'} */
	push(f, t) {
		if (this.done) return 'done';
		const active = Boolean(f && (isActive(f.dom) || isActive(f.other)));
		if (!this.sawDown) {
			if (active || !f) return 'lower';
			this.sawDown = true;
		}
		if (this.startT == null) {
			if (!active) return 'waiting';
			this.startT = t;
		}
		if (active) {
			this.downSince = null;
			this.frames.push(compact(f));
		} else if (this.downSince == null) {
			this.downSince = t;
		}
		const ended = (this.downSince != null && t - this.downSince >= this.dropMs) || t - this.startT >= this.maxMs;
		if (ended) this.done = true;
		return this.done ? 'done' : 'recording';
	}

	/** The recorded frames, or null when too short to be a sign. */
	result() {
		return this.frames.length >= this.minFrames ? this.frames : null;
	}
}

/** Keep only what matching needs (positions and shapes), rounded, to store compactly. */
export function compact(f) {
	const r = (v) => Math.round(v * 1000) / 1000;
	const hand = (h) => (h ? { pos: h.pos.map(r), shape: h.shape ? h.shape.map(r) : null } : null);
	return { dom: hand(f?.dom), other: hand(f?.other) };
}

// ── matching against the user's samples ──────────────────────────────────────

const thin = (frames, max = 40) => {
	if (frames.length <= max) return frames;
	return Array.from({ length: max }, (_, i) => frames[Math.round((i * (frames.length - 1)) / (max - 1))]);
};

/**
 * How far apart two recordings of the SAME word usually are, per word: the
 * median distance between that word's samples. Used to judge whether a new
 * movement is close enough to count as that word.
 */
export function spreadByWord(samples) {
	const byWord = groupByWord(samples);
	const out = new Map();
	for (const [word, list] of byWord) {
		const d = [];
		for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) d.push(dtw(thin(list[i].frames), thin(list[j].frames)));
		d.sort((a, b) => a - b);
		out.set(word, d.length ? d[Math.floor(d.length / 2)] : null);
	}
	return out;
}

function groupByWord(samples) {
	const m = new Map();
	for (const s of samples) {
		if (!m.has(s.word)) m.set(s.word, []);
		m.get(s.word).push(s);
	}
	return m;
}

export const TEACH_DEFAULTS = Object.freeze({
	// A word with one sample, or before spreads are known, must be at least this close.
	fallbackDistance: 0.9,
	// Otherwise: within this multiple of the word's own sample-to-sample spread.
	spreadFactor: 2.6,
	// And clearly closer than the next word.
	ratio: 1.08,
});

/**
 * Classify a movement against the user's samples.
 * @returns {{ word: string|null, distance: number, candidates: {word: string, distance: number}[] }}
 */
export function classifyTaught(frames, samples, spreads = spreadByWord(samples), opts = TEACH_DEFAULTS) {
	const obs = thin(frames.map(compact));
	const best = new Map();
	for (const s of samples) {
		const d = dtw(obs, thin(s.frames));
		if (!best.has(s.word) || d < best.get(s.word)) best.set(s.word, d);
	}
	const ranked = [...best].map(([word, distance]) => ({ word, distance })).sort((a, b) => a.distance - b.distance);
	const [top, second] = ranked;
	if (!top) return { word: null, distance: Infinity, candidates: [] };
	const spread = spreads.get(top.word);
	const limit = spread ? Math.max(spread * opts.spreadFactor, 0.25) : opts.fallbackDistance;
	const ok = top.distance <= limit && (!second || second.distance >= top.distance * opts.ratio);
	return { word: ok ? top.word : null, distance: top.distance, candidates: ranked.slice(0, 5) };
}

// ── storage ──────────────────────────────────────────────────────────────────

const DB = 'hum-kalaam';
const STORE = 'samples';

function openDb() {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB, 1);
		req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

async function tx(mode, fn) {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const t = db.transaction(STORE, mode);
		const out = fn(t.objectStore(STORE));
		t.oncomplete = () => resolve(out?.result ?? out);
		t.onerror = () => reject(t.error);
	});
}

/** The user's samples, kept in this browser. Falls back to memory if storage is blocked. */
export class SampleStore {
	constructor() {
		this.memory = null; // used when IndexedDB is unavailable
	}

	async all() {
		if (this.memory) return [...this.memory];
		try {
			return await tx('readonly', (s) => s.getAll());
		} catch {
			this.memory = [];
			return [];
		}
	}

	async add(word, frames, dominant) {
		const sample = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, word: word.toUpperCase(), frames, dominant, created: new Date().toISOString() };
		if (this.memory) this.memory.push(sample);
		else {
			try {
				await tx('readwrite', (s) => s.put(sample));
			} catch {
				this.memory = [sample];
			}
		}
		return sample;
	}

	async removeWord(word) {
		const all = await this.all();
		const ids = all.filter((s) => s.word === word).map((s) => s.id);
		if (this.memory) this.memory = this.memory.filter((s) => s.word !== word);
		else await tx('readwrite', (s) => ids.forEach((id) => s.delete(id)));
	}

	async removeLast(word) {
		const all = (await this.all()).filter((s) => s.word === word).sort((a, b) => a.created.localeCompare(b.created));
		const last = all.at(-1);
		if (!last) return;
		if (this.memory) this.memory = this.memory.filter((s) => s.id !== last.id);
		else await tx('readwrite', (s) => s.delete(last.id));
	}

	/** JSON text of every sample, for a backup file. */
	async exportJson() {
		return JSON.stringify({ app: 'hum-kalaam', kind: 'sign-samples', version: 1, samples: await this.all() });
	}

	/** Add samples from an exported file. Returns how many were added. */
	async importJson(text) {
		const data = JSON.parse(text);
		if (data?.kind !== 'sign-samples' || !Array.isArray(data.samples)) throw new Error('This is not a Hum Kalaam samples file.');
		let n = 0;
		for (const s of data.samples) {
			if (typeof s?.word !== 'string' || !Array.isArray(s.frames)) continue;
			await this.add(s.word, s.frames, s.dominant ?? 'Right');
			n++;
		}
		return n;
	}
}
