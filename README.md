# Hum Kalaam
https://hum-kalaam-green.vercel.app/
Two-way communication between hearing and Deaf people, in American Sign Language
(ASL):

- **Text or speech to sign:** type or speak English, and a 3D avatar signs it.
  The vocabulary has **476 signs and 1,445 word forms** (1,310 English, plus 135
  common romanised Urdu words such as *chai* and *ghar*), plus A–Z and 0–9
  fingerspelling.
- **Sign to text and speech (experimental):** sign in front of the camera; the
  app writes it out and reads it aloud.

```
npm install
npm run dev        # http://localhost:5173
npm test           # 60 tests: text pipeline, every sign's geometry, retargeting, voice, camera recogniser
npm run build      # production build in dist/
```

## What it does

Pipeline: **text → normalize → sign lookup → animation clip → retarget → avatar playback**

| Step | File | What happens |
| --- | --- | --- |
| Normalize | `src/text-to-sign/normalize.js` | Splits words, ignores punctuation and case. A word with characters other than A–Z or 0–9 (accents, Urdu, emoji) is marked **not supported** as a whole. |
| Lookup | `src/text-to-sign/lexicon.js`, `plan.js` | A word in the vocabulary is **signed**. Any other A–Z/0–9 word is **fingerspelled** letter by letter. Nothing is replaced with a "similar" sign. The words *a, an, the, am, is, are, be, to* are **omitted**, because ASL leaves them out. |
| Clip | `src/vendor/three-ws/sign-speech.js` | All performed words become one continuous clip, in input order, with the time span of each word and letter. |
| Retarget + play | `src/avatar/stage.js` | The three.ws AnimationManager maps the clip's canonical bones onto the loaded rig and plays it. The avatar rests in a relaxed pose between utterances. |
| UI | `index.html`, `main.js`, `src/styles.css` | Light theme. Sign, Replay, Pause/Resume, Stop, speed (0.5×, 0.75×, 1×), signing hand, an avatar toggle, a live caption of the current word and letter, a per-word result list with each sign's description, and a searchable vocabulary. |

Messages longer than 60 seconds of signing are cut, and the cut words are listed
as **not performed**.

## Voice input

Press **Speak** and talk in English, and the avatar signs what you say. Press it
again, or press Esc, to stop.

| Part | File | What happens |
| --- | --- | --- |
| Recognition | `src/voice/voice-input.js` | Uses the browser's Web Speech API, with English accents US, UK, India and Pakistan. Shows words live as you speak, and keeps the most confident of up to 3 guesses for each sentence. |
| Sound handling | same | Opens the microphone with echo cancellation, noise suppression and automatic gain. A level meter shows whether you are heard. You get a hint after 6 s of quiet or when no speech is detected. If the browser ends the session on its own (silence, time limit), it restarts automatically, but at most 5 times in 10 s, so a broken microphone cannot loop forever. |
| Errors | same | Clear messages for: microphone permission denied, no microphone, network failure, accent not supported, browser not supported. |
| Signing | `src/voice/sign-queue.js`, `main.js` | Each finished sentence goes through the same text-to-sign pipeline. Sentences that arrive while the avatar is still signing wait, and are then signed together, so the avatar keeps up with the speaker. If a sentence was heard with low confidence (below 60%), you are asked to check it. Untick "Sign each sentence as soon as I finish it" to collect the words in the message box and press Sign it yourself. |

Limits:

- **Browser support.** Chrome, Edge and Safari support speech recognition;
  Firefox does not, and the button is disabled there with an explanation.
- **Privacy.** Chrome and Edge send the audio to Google's or Microsoft's speech
  service to transcribe it, so recognition needs an internet connection. Safari
  can recognise on the device.
- **Secure page needed.** The microphone only works on `https://` or `localhost`.
- **Not yet tested with a real microphone.** It has only been tested with
  simulated recognition and microphone input (`tests/voice-input.test.mjs`,
  `tests/sign-queue.test.mjs`) and with simulated sentences in the browser.

## Vocabulary

| Source | Signs | File |
| --- | --- | --- |
| three.ws core | 32 (greetings, pronouns, a few verbs) | `src/vendor/three-ws/sign-dictionary.js` |
| Hum Kalaam everyday, part 1 | 171 | `src/text-to-sign/lexicon-daily.js` |
| Hum Kalaam everyday, part 2 | 273 | `src/text-to-sign/lexicon-daily-2.js` |
| Extra spellings of existing signs (tenses, plurals, synonyms, romanised Urdu) | n/a | `src/text-to-sign/lexicon-forms.js` |

## What this is, and what it is not

- **The sign language is ASL.** It is not Pakistani Sign Language. The
  repository contains no PSL data.
- **The signs are unreviewed.** All 476 signs are written from standard
  descriptions of ASL citation forms, and Deaf signers have not checked any of
  them. Some movements (circles, wiggles, twists) are approximated with a few key
  poses. Have Deaf signers review every sign before any real use; the app and the
  code both show each sign's description to make that easier.
- **The tests check geometry, not meaning.** They prove the hands go where each
  description says. They cannot prove the description is the correct sign.
- **It is signed English, not ASL grammar.** Words are signed in English word
  order. ASL grammar (topic-comment order, spatial verbs, facial grammar on every
  sentence) is not produced.
- **No facial expressions on these avatars.** The engine can drive ARKit face
  blendshapes, but neither avatar has them.

## Tests

`tests/text-to-sign.test.mjs` covers normalization, the four word categories
(signed, fingerspelled, omitted, unsupported), word order and timing, speed, the
left hand, truncation, and the vocabulary.

`tests/lexicon.test.mjs` checks the geometry of every phase of all 476 signs, as
described above.

`tests/voice-input.test.mjs` and `tests/sign-queue.test.mjs` cover voice input
with a simulated recogniser, microphone and clock.

`tests/recognizer.test.mjs` covers the camera recogniser on simulated signers:
letters, signs, sentences, refusals, lost hands, and the body measurements.

`tests/avatar-retarget.test.mjs` loads the real skeleton of each GLB in Node,
plays HELLO and the letter A through the same AnimationManager the browser uses,
and checks the geometry:

- During HELLO the hand rises above the shoulder to head height.
- During A the hand is between hip and head height, with the index finger curled.
- At no point does the body tip over.

## Sign to text and speech (experimental)

The "Sign to text and voice" panel under the avatar. Press **Start camera**,
sign, and lower your hands at the end of a sentence; the text appears and is
read aloud.

| Part | File | What happens |
| --- | --- | --- |
| Tracking | `src/camera/camera-tracker.js` | MediaPipe HandLandmarker (21 points per hand) and PoseLandmarker (body). Both run in the browser; the WASM runtime (`public/mediapipe-wasm`) and the models (`public/models`) are inside the project, so video never leaves the device and nothing is fetched at runtime. |
| Features | `src/camera/features.js` | Hand positions are measured relative to the body. Sideways and below the shoulders, the unit is the person's arm length, learned while they sign. Above the shoulders, the unit is the nose height. Hands are assigned left or right from the body's wrists, not from the tracker's own label (unreliable when the palm is hidden). If the hand tracker loses a hand near the face, the body's wrist point keeps its position. |
| Letters | `src/camera/recognizer.js` | A still hand held at shoulder height is graded against the 24 static letters with the three.ws handshape grader (J and Z need movement and are not read). K/P and G/Q are told apart by whether the hand points down. A letter is accepted after about half a second. |
| Signs | `src/camera/recognizer.js`, `templates.js` | A movement between pauses is compared, by dynamic time warping, with a reference path for every one of the 476 signs. The paths are generated from the avatar's own sign definitions. A sign is accepted only if it is close enough and clearly better than the runner-up. Otherwise the panel says it is not sure and offers the 3 closest signs to tap. |
| Speech | `src/voice/speak.js` | The browser's built-in English voice reads each finished sentence. |

### Measured accuracy, and what it means

| Test | Signs | Letters |
| --- | --- | --- |
| Avatar's own signing, no noise (`node scripts/eval-recognizer.mjs 0`) | 96% exact | 22 of 24 |
| Same, with simulated camera noise (`… 1`) | 77% exact, 4% wrong, rest "not sure" | |
| **Real MediaPipe** on the rendered avatar, a different body from the reference (`/tests/browser/camera-e2e.html`) | **1 of 10 exact, 4 of 10 in the top 3** | **10 of 24** (camera close to the hand) |

The last row is the one that matters. It is the real tracker on a body other
than the one the references come from, and recognition is **not yet reliable**.
When unsure, it offers suggestions rather than inventing a word. Letters made
with a closed fist (A, E, M, N, S, T, X) are the most often confused.

No real signing data exists in this project. Tuning further against the
avatar's rendered hands would fit the avatar, not people. The next step is to
record real signers (Deaf signers, in good light) and tune or train on those
recordings, so this needs data the repository does not have.

## Other recognition pieces in three.ws

The three.ws repository has more pieces for recognition. They are not used here:

- `three.ws/src/sign-input.js`: webcam capture with MediaPipe Holistic
  (`@mediapipe/tasks-vision`, which downloads its model at runtime). It sends
  landmark coordinates, not video, to the recognition API.
- `three.ws/api/asl-recognition.js` and `three.ws/workers/model-asl-recognition/`:
  a server for continuous ASL **fingerspelling** recognition, based on the
  Kaggle 2023 ASLFR first-place model. The weights are **not** in the repository.
  The worker's Dockerfile downloads them at build time, so using it needs that
  external download.
- (`sign-grader.js` and `sign-hand-model.js` are used here, for letters.)

There is no trained model for recognising full signs, and there is no PSL data.
