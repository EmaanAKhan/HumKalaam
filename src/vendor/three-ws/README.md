# Vendored from three.ws

These files are copied from `../../../../three.ws/src/` (repository
https://github.com/nirholas/three.ws, commit `800052ed82`). They are Apache-2.0
licensed; see `LICENSE` and `NOTICE` in this folder.

| File | Role |
| --- | --- |
| `sign-speech.js` | Compiles a word list into one continuous AnimationClip (`compileUtterance`) |
| `sign-dictionary.js` | The ASL lexicon: 32 signs, 73 word forms, each with a plain-English gloss |
| `fingerspelling.js` | Manual alphabet A-Z and 0-9 |
| `sign-clip.js`, `sign-handshapes.js`, `sign-rig.js` | Handshapes, body anchors, arm IK on the canonical skeleton |
| `animation-manager.js`, `animation-retarget.js`, `glb-canonicalize.js`, `animation-canonical-rest.js`, `animation-arm-relax.js` | Retargets canonical clips onto any humanoid rig (Unreal, Mixamo, VRM, ...) |
| `shared/log.js` | Logger used by the animation manager |

## Local changes

Two changes from upstream:

- `animation-manager.js`, `loadVrmaAnimation()`: the dynamic import of
  `@pixiv/three-vrm-animation` is replaced by a rejected promise. Hum Kalaam
  never loads `.vrma` files and the package is not installed; without this
  change Vite fails to resolve the import.
- `sign-handshapes.js`, `handAxes()`: **bug fix.** The thumb's adduction axis
  (the palm normal) is negated for the left hand. Upstream, every handshape put
  the LEFT thumb on the wrong side (an L-hand's thumb pointed down instead of
  up, 6-18 cm off), which affected left-handed signing and the non-dominant hand
  of every two-handed sign. After the fix all 44 handshapes mirror exactly;
  `tests/lexicon.test.mjs` checks this. Worth reporting upstream.

To update, copy the same files again from `three.ws/src/` and reapply both changes.
