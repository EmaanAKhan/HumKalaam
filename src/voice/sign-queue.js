// Sentences heard by the microphone, waiting to be signed.
//
// Speech is usually faster than signing, so sentences can arrive while the
// avatar is still busy. They wait here in order. When the avatar becomes free,
// everything waiting is signed as ONE utterance, so the avatar catches up
// instead of falling further and further behind the speaker.

export class SignQueue {
	/**
	 * @param {{ isBusy: () => boolean, play: (text: string) => unknown, onChange?: (pending: string[]) => void }} opts
	 */
	constructor({ isBusy, play, onChange = () => {} }) {
		this.isBusy = isBusy;
		this.play = play;
		this.onChange = onChange;
		this.pending = [];
	}

	/** Add a heard sentence; it is signed now if the avatar is free. */
	push(text) {
		const clean = String(text ?? '').trim();
		if (!clean) return;
		this.pending.push(clean);
		this.onChange([...this.pending]);
		this.pump();
	}

	/** Call when the avatar finishes; signs whatever has been waiting. */
	pump() {
		if (!this.pending.length || this.isBusy()) return;
		const text = this.pending.join(' ');
		this.pending = [];
		this.onChange([]);
		this.play(text);
	}

	clear() {
		this.pending = [];
		this.onChange([]);
	}
}
