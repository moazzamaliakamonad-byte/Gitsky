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
| 42 | README uses the generated OG card as its image until the hero GIF is recorded. | A real render beats an empty placeholder on the first screen. |
| 43 | Copyright line uses the git author name from the repo config. | MIT requires a holder; it's the owner's project. |
| 44 | Stars use a point-spread function (nucleus + Moffat wing + edge roll-off) instead of Gaussian discs. | Power-law wings are what make points read as starlight; no visible sprite edge. `learn/concepts/drawing-a-star.md`. |
| 45 | Energy-conserving sprites: stars below a 3.2 px footprint are drawn at the footprint, dimmed by lost area. | Far stars became identical blocky dots; now distance reads as faintness. |
| 46 | A hue-preserving highlight shoulder (knee 0.62) plus fine grain runs after bloom, in the same EffectPass. | Dense cores rolled to flat clipped blotches; the shoulder leaves the tuned mid-tones untouched. Zero extra passes. |
| 47 | Unresolved-starlight layer: 4 faint points per file (cap 36k High / 12k Low), scattered within the file's own cluster, never pickable, dimmed by densityExposure^1.5. | Gives the galaxy a luminous body while staying exactly as dense as the data. Measured 60 fps at 50k stars on Iris Xe. |
| 48 | Disk haze gains fbm mottling, dust lanes, star-forming knots, and fades near the core and when edge-on. | Texture on the data-driven spiral; changes how arms look, never where they are. ADR 0005 amendment. |
| 49 | Bloom threshold raised from 0.12 to 0.2. | Only genuinely bright light blooms; faint stars stay crisp pinpoints. |
| 50 | Logo: a git history drawn as a constellation (fork, two parallel commits, merge, HEAD as the accent star). The favicon is a bolder redraw of the same mark. | Git and sky in one glyph; the old two-arm swirl was a generic galaxy icon. The bold variant keeps the shape legible at 16 px. |
| 51 | Black holes = heaviest lockfiles / generated code / binary assets, at least 192 KB and 40x the median, at most 3. | Pure mass with little meaning is exactly what a black hole is; thresholds keep them rare. Hand-written files never qualify. `learn/concepts/black-holes-and-supernovae.md`. |
| 52 | Lensing is a thin-lens (beta = theta - thetaE^2/theta) post-processing pass in screen space, disabled on frames with no hole on screen. | One cheap pass gives Einstein rings, swirled starlight and a crisp shadow; a GR ray tracer would not fit Iris Xe. Documented as an approximation. |
| 53 | Accretion disks are split: the far half is lensed in the main scene, the near half is drawn after the lens in an overlay scene, cross-faded. | A screen-space lens would otherwise bend and swallow the part of the disk that is in front of the hole. |
| 54 | Supernova = the most-changed sampled file (2+ touches), triggered by its first comet, a pure function of the playhead. | Rewards the busiest file with the biggest event; scrubbing stays correct with no state. |
| 55 | Black-hole and supernova files explain themselves in the file panel and the legend note. | Honesty: a striking effect must say what data produced it. |
| 56 | Close-up sprite caps: stars 72 px, glow 28 px (device-independent). | Zoomed into react's core, overdraw dropped from 46 to 55 fps; the governor covers the rest. |
| 57 | A folder seen up close is a solar system: the folder is the sun, direct files are planets (most-changed innermost), sub-folders are ringed gas giants with a moon per file, overflow files are an asteroid belt. | A second, closer level of detail that still encodes only real data; Kepler speeds make it feel physical. `learn/concepts/warp-and-solar-systems.md`. |
| 58 | Caps: 24 planets, 8 giants, 12 moons each; anything beyond is counted in the system panel. | Keeps every system readable and cheap; honesty requires saying what isn't drawn. |
| 59 | The warp is camera flight + FOV 50 to 96 degrees + camera-space streaks + a DOM white flash that hides the scene switch. | The wide FOV sells speed; the flash makes an instant scene swap invisible. Reduced motion swaps instantly. |
| 60 | The galaxy stays mounted but hidden inside a system. | Coming back is instant: no re-forming animation, no rebuilt buffers. |
| 61 | Escape climbs one level (system, parent system, galaxy). | Consistent with Escape peeling back one layer everywhere else. |
| 62 | Galaxy collisions use a restricted three-body simulation (Toomre & Toomre 1972): softened point-mass cores, massless file stars, leapfrog on the CPU. | Two force evaluations per star (~0.3 ms for 10k) instead of N-squared; reproduces tails and bridges. `learn/concepts/galaxy-collisions.md`. |
| 63 | Mass from sqrt(file count); Plummer softening 0.5 of radius; G set so the bigger disk's edge orbits in 24 s; drag on the cores while they overlap. | Disks keep their shape until disturbed; measured haze vs tails to pick the softening; friction gives the story its acts (pass, tails, fall back, merge). |
| 64 | Files with the same path in both repos pulse and are joined by threads while the galaxies touch. | The one place the collision shows data rather than physics; the panel says which is which. |
| 65 | `?repo=a&vs=b` deep-links a collision; Escape ends it. | Shareable like every other view. |
| 66 | Up to 12,000 stars per galaxy, fixed (not by quality). | A quality change used to rebuild and restart the simulation mid-story. |
| 67 | React state in the collision panel changes only on visible changes. | Setting it every frame re-rendered the panel 60 times a second and halved the frame rate. |
| 68 | Black holes redesigned as "devouring": one hole (more only at 8x the threshold), 2,600 stateless infall streaks spiralling in and stretching, a whirlpool disk with inflow lanes, a soft horizon with a warm glow and no outline. | The owner rejected the first version ("not it"): three identical dark circles with crisp rings read as stickers. Seeing it eat is what makes it a black hole. |
| 69 | Infall streaks take their colours from the 48 nearest files. | Ties the effect to the neighbourhood it sits in; the panel labels the streams as an effect. |
| 70 | Black holes removed entirely (supersedes 51-53, 68-69). The supernova keeps a small ripple-only post pass. | Three designs (screen-space lens, devouring whirlpool, ray traced) never looked right to the owner, and none helped anyone understand a repo. Effort goes to features that do. |
| 71 | A selected file's top-level symbols (functions, classes, types, constants, Markdown headings, config keys) orbit its star as planets; a code panel shows the outline and the source. | Useful first: you see what a file contains without leaving the sky. Line-based outlines per language, top level only: fast, never throws, easy to read. |
| 72 | File text comes from raw.githubusercontent.com pinned to the charted commit; binaries, files over 400 KB and synthetic files are never fetched. | Raw downloads don't spend the 60-requests-an-hour API budget; pinning keeps content consistent with the stars. |
| 73 | Within 18 units of the camera, stars resolve into small emissive suns with clickable file names, and their glow sprites fade out; sprites are capped at 28 px. | Close up, swelling sprites read as blur. A body plus a crisp label reads as an object. |
| 74 | Universe view: the repo's top contributors (1 request) and each one's own top repos (1 request each), laid out as galaxies around the home galaxy and linked by filaments. | Shows the neighbourhood people actually care about; about 13 requests without a token, sized to the remaining budget, cached for a day. `learn/concepts/universe.md`. |
| 75 | Universe labels are placed by priority with overlap avoidance. | 90 repo names otherwise pile into an unreadable block. |
| 76 | "Whole galaxy" button and the Home key fly back to the overview from anywhere (warping out of a system, closing the universe). | Zooming in deep needs a one-step way out. |
| 77 | Console theme: chamfered instrument plates with glowing cut corners and brackets, scanlines, cyan instrument ink (amber stays for actions), a viewfinder frame with edge rulers, a targeting reticle with lock-on readout, terminal-style input. | The owner asked for an advanced sci-fi look. Every readout is real data (sector = folder under the camera's target, range, heading, elevation, fps), so the chrome informs rather than decorates. |
