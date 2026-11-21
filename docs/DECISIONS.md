# Decisions

A running log of choices made while building Gitsky. Newest at the bottom.
Longer write-ups for the important ones live in `learn/decisions/`.

| # | Decision | Why |
|---|----------|-----|
| 1 | **Dropped `@react-three/drei` and `@react-three/postprocessing`; use three's own `OrbitControls` and pmndrs `postprocessing` directly.** | Slow internet: drei pulls ~20 transitive packages (troika text, meshline, camera-controls…) and we need two things from it. Driving `postprocessing` ourselves is ~40 lines, gives exact control over when a frame is captured for PNG export, and teaches more. See `learn/decisions/0001-no-drei.md`. |
| 2 | React 18 + `@react-three/fiber` 8 (not 9). | Spec asks for React 18; fiber 9 requires React 19. |
| 3 | Pinned `three@0.169.0`, exact versions everywhere. | `postprocessing` 6.36 supports three < 0.170. Exact pins make `npm ci` reproducible on a flaky connection. |
| 4 | `fake-indexeddb` as a dev dependency. | Lets the cache module be unit-tested in Node in milliseconds, no browser. |
| 5 | Vite `base` comes from `BASE_PATH`, set in CI to `/<repo-name>/`. | Works whatever you name the GitHub repo; local dev stays at `/`. |
| 6 | Fonts: Instrument Sans (UI) + Martian Mono (paths, numbers) from Google Fonts, with system fallbacks. | Distinct from the usual Inter/JetBrains pairing; fallbacks keep the UI fine offline. |
| 7 | No AI attribution lines in commits. | Owner's request. |
