# Progress

| Milestone | Status | Notes |
|-----------|--------|-------|
| M0 Setup | done | Vite + React 18 + TS strict, ESLint/Prettier, Vitest, Pages workflow, learn/ skeleton |
| M1 Data layer | done | Input parsing, GitHub client, request budget, IndexedDB cache, snapshot format + script, 4 snapshots (vite 3,016 files, react 7,282, go 12,000 of 16,442, zustand 144). 50 tests. |
| M2 Layout engine | done | Folder tree, log-spiral arms with clusters strung along arm segments, nested orbits, seeded jitter, size (log bytes), colour palette with hue families, churn brightness. 50k synthetic files lay out well under 200 ms; real snapshots 0.2–13 ms. |
| M3 Renderer | done | One-draw-call star field with forming animation, twinkle, diffraction spikes and density-aware exposure; folder nebulae (instanced billboards); spiral-arm haze traced from the layout's own spiral; star-chart rings; live folder labels with collision avoidance; cinematic intro descent; bloom + vignette; orbit controls with auto-rotate and fly-to; adaptive DPR + FPS governor; Low/High toggle; hero with plate caption and spectrum chips. Measured 60 fps on Iris Xe (vite Low, go High). |
| M4 Interaction | done | Screen-space picking (pointer recorded on move, picked once per frame only when pointer or camera moved), hover reticle + tooltip, selection reticle, file panel (breadcrumb, size percentile, touch strip, recent commits, GitHub link, fly here), folder selection (dims everything else, folder stats, busiest files, sub-folders, authors), folder labels select folders, search with ranked results / keyboard navigation / pulsing matches / Enter flies, "/" focuses search, Escape peels back layers, Open-repo popover. |
| M5 Time and comets | done | Stateless comet system (pure `cometsAt(playhead)`, quadratic Bézier paths arcing from SHA-chosen rim origins, 90-point fading trails, impact rings) in one draw call; star flash on arrival via `aTouch`/`uPlayhead`; comets and timeline ticks coloured by author; timeline bar with log-scaled tick histogram, gliding playhead, commit card, play/pause, keyboard-accessible range; playback waits for the galaxy to form, loops with a pause; reduced motion = no autoplay, no comets, instant landing on scrub. |
| M6 Insights and list view | — | |
| M7 Share | — | |
| M8 Error states and polish | — | |
| M9 Launch readiness | — | |
