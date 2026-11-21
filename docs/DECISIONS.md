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
| 8 | Sample the most recent N commits contiguously. | Keeps "last N commits" literally true and the replay continuous. `learn/decisions/0002-sample-recent-commits.md`. |
| 9 | Compact snapshot format: dirs table + `[dir, name, bytes]` tuples + commit file indices, versioned. | Small, still readable, validated on decode. `learn/decisions/0003-snapshot-format.md`. |
| 10 | Cache freshness window: 1 hour. A newer cached copy is shown with zero API calls; an older one costs 2 calls to check the head SHA. | Reloads must be free; staleness of an hour is fine for "understand a codebase". |
| 11 | `/tree/<x>/...` URLs take the first segment as the branch. | A URL can't distinguish branch `feature/x` from branch `feature` + folder `x`; the common case wins. |
| 12 | Bundled snapshots: vitejs/vite (landing default), react/react, golang/go, pmndrs/zustand. Capped at 12,000 files. | Varied shapes: monorepo, framework, compiler (largest), tiny lib. Vite is the default because it is small (118 KB) and colourful (TS, JS, Vue, CSS, HTML). facebook/react now redirects to react/react, and we store what the API returns. |
| 13 | On rate-limit or network failure mid-way through commit details, keep the partial sample. | A smaller honest sample beats an error screen. |
| 14 | Offline/rate-limited with an older cached copy: show it, labelled as saved. | Graceful degradation. |
| 15 | Closed-form spiral layout instead of force-directed. | O(n), deterministic, and the metaphor is the layout. `learn/decisions/0004-spiral-not-force-layout.md`. |
| 16 | Top-level folders own a segment of their arm; their sub-folders are strung along it. | Real repos have only 5–10 top-level folders, which would look like blobs; strings of clusters read as arms. |
| 17 | Stateless `rand(seed, k)` instead of a stateful PRNG. | Adding a file never moves other stars. |
| 18 | Arm count is 2–4, chosen from the number of top-level folders (ceil(n/6)). | Fewer arms keep each arm populated; overridable via `LayoutOptions.arms`. |
| 19 | Every atmospheric layer (nebulae, haze, spikes, labels, rings) is derived from repo data. | Owner wants exceptional visuals; brief forbids fake data. `learn/decisions/0005-layers-of-light.md`. |
| 20 | Frame the camera on the 97th-percentile star distance (`layout.extent`), not the max. | A few outliers made big repos tiny in their own frame. |
| 21 | `camera.setViewOffset` shifts the galaxy above the hero text on the landing page. | Keeps the galaxy visible without moving it in 3D; projection and picking stay exact. |
| 22 | Vite `server.watch.awaitWriteFinish` enabled. | Windows watcher missed rapid writes and served stale modules. `learn/stories/the-galaxy-that-vanished.md`. |
| 23 | Spectrum (language mix by bytes) stored in the snapshot index; `npm run snapshot:index` rebuilds it with zero API calls. | Chips show each bundled sky's colours before you open it. |
| 24 | Screen-space nearest-star picking instead of ray casting or GPU colour picking. | Tolerance in pixels feels right at every distance; no extra render pass; ~1 ms for 50k. `learn/concepts/picking-and-camera-animation.md`. |
| 25 | Search moves to the HUD centre; opening another repo moves into an "Open repo" popover. | While exploring, finding files is the frequent action; switching repos is rare. |
| 26 | Search pulses up to 2,000 matches and lists the best 8. | The sky shows the spread; the list gives precise targets. |
| 27 | Comets are a pure function of the playhead, not a pooled particle system. | Scrubbing backwards and jumping are free and always correct. `learn/concepts/comets-and-time.md`. |
| 28 | Comet colour = author (stable hash into a warm palette). | Shows who works where; warm hues read as events against the cooler language palette. |
| 29 | Fractional playhead lives outside React (timelineClock); React only sees whole-commit changes. | Avoids 60 re-renders per second. |
| 30 | Insights summary is generated sentences built from computed facts, always naming the sample size. | The 30-second goal needs words, not just charts; honesty rules require the sample to be stated. |
| 31 | Language palette fails the dataviz validator's lightness band and one CVD pair (HTML vs Python, ΔE 4.8 deutan); we keep it and guarantee non-colour identity everywhere (labels, tooltip, legend, list view). | Stars are light emitters on black and need high lightness; validator result recorded honestly in `learn/concepts/insights-and-accessible-data.md`. |
| 32 | List view paginates 200 rows instead of virtualising. | Keeps a real, searchable, screen-reader-friendly table with no extra dependency. |
| 33 | Quality and token moved into a Settings popover. | HUD stayed on one row at 1280 px. |
| 34 | Capture by rendering a frame on demand and copying it in the same task, not preserveDrawingBuffer. | No per-frame cost for an occasional export. `learn/concepts/exporting-images-from-webgl.md`. |
| 35 | The share card uses the user's current view, not a fixed camera. | It's *their* sky: whatever they found worth sharing. |
| 36 | Share is the one accent-coloured HUD button. | Spreading is the growth loop; the primary action gets the warm accent. |
| 37 | Diffraction spikes are assigned by rank in the data layer (`computeSpikes`), not by a size threshold in the shader. | Thresholds spiked hundreds of stars in big repos; ranks keep spikes rare and meaningful. |
| 38 | `?stress=N` synthetic sky exists for performance testing, labelled as synthetic in the name, description, HUD and a notice. | Measuring 50k on real hardware needs 50k files; honesty rules require it to be unmistakable. |
| 39 | The site's OG image is rendered by the app itself and saved via `scripts/capture-receiver.ts`. | The browser renders the real galaxy far better than an offline rasteriser; no new dependency. |
| 40 | OG image ships as JPEG (71 KB) rather than PNG (957 KB). | Link previews load on slow connections; galaxy noise compresses badly as PNG. |
| 41 | `?repo=` keeps / and @ unescaped. | Readable, shareable links (`?repo=owner/name`); both characters are legal in a query string. |
