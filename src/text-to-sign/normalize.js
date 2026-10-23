// Step 1 of the pipeline: text in, a list of tokens out.
//
// The vendored engine's own normaliser (fingerspelling.js normalizeWord) simply
// deletes every character outside A-Z and 0-9. That is fine for punctuation, but
// it would silently turn "café" into CAF or drop an Urdu word entirely, and a
// wrong or missing word must never pass for a translated one. So this layer
// decides per word, before the engine sees anything:
//
//   - ASCII punctuation is ignorable and removed ("hello!" -> HELLO, "I'm" -> IM)
//   - a word made only of A-Z / 0-9 after that is supported
//   - a word containing any other character (accents, Urdu/Arabic script, emoji)
//     is UNSUPPORTED as a whole and reported back to the user, not spelled in part

const SPLIT = /[\s\-‐-―/_]+/; // spaces, hyphens/dashes, slashes, underscores
const IGNORABLE = /[!"#$%&'()*+,.:;<=>?@[\\\]^`{|}~‘’“”…]/g;
const SPELLABLE = /^[A-Z0-9]+$/;

/**
 * @typedef {{ raw: string, word: string|null, supported: boolean, reason: string|null }} Token
 */

/**
 * @param {string} text
 * @returns {Token[]}
 */
export function tokenize(text) {
	const tokens = [];
	for (const raw of String(text ?? '').split(SPLIT)) {
		if (!raw) continue;
		const stripped = raw.replace(IGNORABLE, '');
		if (!stripped) continue; // pure punctuation ("!", "...") carries no word
		const upper = stripped.toUpperCase();
		if (SPELLABLE.test(upper)) {
			tokens.push({ raw, word: upper, supported: true, reason: null });
		} else {
			const bad = [...new Set(upper.replace(/[A-Z0-9]/g, ''))].join(' ');
			tokens.push({
				raw,
				word: null,
				supported: false,
				reason: `contains characters the signing engine cannot fingerspell (${bad})`,
			});
		}
	}
	return tokens;
}
