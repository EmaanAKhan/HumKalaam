# AGENTS.md: Hum Kalaam

Everything about the project in one place: what it does, how it works, how to run it, where
each part came from, and how we used AI to build it.

---

## 1. What Hum Kalaam is

A two-way communication app between hearing and Deaf people, in American Sign Language
(ASL), that runs in the browser on a phone or a laptop.

- **Text or voice to sign.** Type or speak English, and a 3D avatar signs it.
  476 signs, 1,445 word forms (including tenses, plurals and 135 romanised Urdu words such as
  *chai*, *ghar*, *shukriya*), plus A–Z and 0–9 fingerspelling.
- **Sign to text.** Sign in front of the camera, and the app writes it out and reads it
  aloud. It knows 20 everyday words without any setup, and you can teach it more.

Everything runs on the device: no backend, no accounts, and no video leaves the phone.

## 2. Run it

```bash
npm install
npm run dev       # local dev server
npm test          # automated tests (node --test)
npm run build     # production build in dist/
npm run preview   # serve the production build
```

Stack: plain JavaScript (ES modules), three.js, Vite, MediaPipe Tasks Vision. No framework.

## 3. How text becomes signing

**text → normalise → look up each word → one animation clip → retarget onto the avatar → play**

| Step | File | What happens |
| --- | --- | --- |
| Normalise | `src/text-to-sign/normalize.js` | Splits words and ignores punctuation and case. A word with characters other than A–Z/0–9 (accents, Urdu script, emoji) is reported as not supported. |
| Look up | `src/text-to-sign/lexicon.js`, `plan.js` | A known word is **signed**; any other word is **fingerspelled**; *a, an, the, am, is, are, be, to* are **left out**, as in ASL. A word is never replaced by a "similar" sign. |
| Clip | `src/vendor/three-ws/sign-speech.js` | All words become one continuous clip, with the timing of each word and letter. |
| Play | `src/avatar/stage.js` | The clip is retargeted onto the avatar's skeleton and played; the avatar rests in a relaxed pose between messages. |

Messages longer than 60 seconds of signing are cut, and the cut words are listed.

## 4. The vocabulary

| Source | Signs |
| --- | --- |
| three.ws core (greetings, pronouns, a few verbs) | 32 |
| Hum Kalaam everyday signs, part 1 (`lexicon-daily.js`) | 171 |
| Hum Kalaam everyday signs, part 2 (`lexicon-daily-2.js`) | 273 |
| Extra spellings of existing signs (`lexicon-forms.js`) | tenses, plurals, synonyms, romanised Urdu |

Areas covered include family and people, questions, time and days, food and drink, places
and transport, health and the body, feelings, numbers, colours, animals, weather, school and
work, and many everyday verbs.

Every sign is written in the engine's notation (handshape, place on the body, palm and
finger direction, movement phases). The automated tests check every phase of every sign:
the arm can reach it, contacts land within 3 cm, no part of the hand passes through the body,
and the left-handed version is an exact mirror of the right-handed one.

## 5. Voice

| Part | File | What happens |
| --- | --- | --- |
| Speech to text | `src/voice/voice-input.js` | Browser speech recognition, with US, UK, Indian and Pakistani English accents, live words while speaking, automatic restart if the browser stops listening, and clear error messages. |
| Signing as you speak | `src/voice/sign-queue.js` | Each finished sentence is signed; sentences that arrive while the avatar is busy wait their turn. |
| Read aloud | `src/voice/speak.js` | Used by the camera mode to read out recognised sentences. |

Speech recognition works in Chrome, Edge and Safari (not Firefox), and needs `https://` or
`localhost`.

## 6. Sign to text (camera)

| Part | File | What happens |
| --- | --- | --- |
| Tracking | `src/camera/camera-tracker.js` | MediaPipe hand (21 points per hand) and body tracking in the browser. The runtime and models are inside the app (`public/mediapipe/`, `public/models/`) and start loading as soon as the camera tab opens, in about 4 seconds instead of over a minute from outside CDNs. |
| Features | `src/camera/features.js` | Turns landmarks into hand positions relative to the shoulders, plus handshapes. |
| Recogniser | `src/camera/recognizer.js` | Compares each movement with the reference movements by dynamic time warping, and recognises held fingerspelled letters. When unsure it does not guess; it offers the closest matches. |
| 20 built-in words | `src/camera/core-words.js` | hello, thank, please, sorry, yes, no, help, water, eat, sad, more, name, friend, doctor, go, want, sick, tired, understand, again. |
| Teach mode | `src/camera/teach.js` | Record your own signs (3 to 5 times per word); they are saved in the browser and can be exported to a file. |

Why 20 words by default: matched against all 476 signs, recognition was unreliable. These 20
were chosen for having clearly different movements. On simulated signers (the avatar's own
signing plus camera noise) they are recognised **99%** of the time, against **84%** when the
same words are matched against every sign (`node scripts/eval-core-words.mjs`).

## 7. The app

`index.html`, `main.js`, `src/app-shell.js`, `src/styles.css`

- Mobile-first, phone-style app with a bottom tab bar: **Text or voice to sign** and **Sign to text**.
- Large avatar stage with the current word shown on top and playback controls.
- Chat-style message box with a Speak button and a Sign it button.
- Each word in the result list is marked signed, fingerspelled, left out or not supported.
- Searchable vocabulary, speed (0.5×, 0.75×, 1×) and left- or right-handed signing.
- Light and dark mode follow the phone's setting; works down to 320 px wide.

## 8. Where the parts came from

| Part | Source | Licence |
| --- | --- | --- |
| Signing engine: sign notation, arm IK, clip builder, fingerspelling, retargeting, GLB canonicalisation | [three.ws](https://github.com/nirholas/three.ws), vendored unchanged in `src/vendor/three-ws/` | Apache-2.0 |
| Hand and body tracking | [MediaPipe Tasks Vision](https://www.npmjs.com/package/@mediapipe/tasks-vision) 0.10.35 and Google's landmarker models | Apache-2.0 |
| 3D rendering | [three.js](https://threejs.org) | MIT |
| Avatar | `public/avatar.glb` | <!-- add source and licence --> |

## 9. How we used AI to build it

We built Hum Kalaam with AI throughout, and made the decisions ourselves.

**The IDE.** We used the Dev Marketplace IDE with its AI agent (Kimi and Haiku 1.5x) during
the project, to prototype the app, set up the repository and work on deployment.

**AI coding assistants.** On top of the three.ws engine, the code in this folder was written
with AI coding assistants, from our instructions, in short rounds: we described a feature,
the assistant wrote it, we ran it in the browser and asked for fixes until it worked. That
covers the 444 added signs, the text and voice pipeline, the camera recogniser, the 20-word
set, teach mode, the interface and the tests.

**What we decided.** The problem and who it is for; using three.ws instead of building an
engine; the scope (ASL vocabulary in English word order, not full ASL grammar or Pakistani
Sign Language); the rules (never substitute a sign, never let the camera guess, keep video on
the device); which 20 words the camera knows; removing a 47 MB avatar that made the app lag;
and testing every version before it shipped.

**What AI did not do.** No training data was generated. The camera matches against the
avatar's sign definitions and against signs the user records.

## 10. Rules for anyone changing the code

1. Do not edit `src/vendor/three-ws/`; fix engine behaviour in `lexicon.js` (`CORE_FIXES`).
2. Never substitute a sign for a word that has none; fingerspell it.
3. The camera must not guess below its confidence threshold.
4. Keep everything on the device.
5. Check UI changes at 360 px and on desktop, in light and dark mode.
6. Run `npm test` and `npm run build` before committing. Two tests are known to fail
   ("plan: the clip targets canonical arm, hand and finger bones" and "level meter maps
   silence to 0…"); do not add more.
7. Keep avatars small; large GLB files make the app lag.

## 11. Honest limits

- No sign has been reviewed by Deaf signers yet; signs follow standard ASL dictionary
  descriptions, and some movements are simplified.
- This is ASL vocabulary in English word order, not ASL grammar, and not Pakistani Sign
  Language.
- Camera accuracy figures come from simulated signers, not real people; real accuracy will
  be lower until it is tested with signers.
- Use it alongside text, not instead of a human interpreter.
