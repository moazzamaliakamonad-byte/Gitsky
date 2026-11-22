# Contributing to Gitsky

Thanks for wanting to help. Gitsky is small on purpose, and these notes keep it that way.

## Setup

```bash
npm install
npm run dev     # http://localhost:5173
```

The landing page uses bundled snapshots, so you can develop without spending GitHub API
calls. Open `?repo=pmndrs/zustand` (tiny) or `?stress=50000` (synthetic, labelled) to test
extremes.

## Before you open a pull request

```bash
npm run typecheck
npm run lint
npm test          # must stay under 30 seconds; it's about 2 today
npm run build
```

## Ground rules

1. **Honest UI.** Never present sampled or estimated numbers as complete. Say "in the last
   N commits"; say "bytes", not "lines". New insights need honest labels.
2. **Pure logic gets unit tests.** `src/data` and `src/layout` are DOM-free TypeScript,
   tested with Vitest in Node. Write the test first when you can. No browser or end-to-end
   tests: they're slow and flaky.
3. **Performance is a feature.** The target is 60 fps on an integrated laptop GPU. No
   per-star React components, no per-frame allocations, and measure before and after.
4. **Few dependencies.** Adding one needs a reason in `docs/DECISIONS.md`.
5. **TypeScript strict, no `any`** without a comment explaining why.
6. **Short interface copy.** Buttons, fields and panels say what they are; if a name says
   enough, add no explanation. Methods and caveats belong in LIMITATIONS.md and the docs,
   not on screen.

## Where things live

| Folder | What |
|--------|------|
| `src/data` | GitHub client, rate-limit budget, cache, snapshot format, deep-time history |
| `src/layout` | Pure functions: tree → positions, colours, churn, insights |
| `src/render` | three.js / react-three-fiber scene, shaders, picking |
| `src/ui` | React DOM: panels, search, timeline, dialogs |
| `src/state` | zustand store and actions |
| `scripts` | Snapshot tooling (`snapshot`, `snapshot:index`, `snapshot:deep`) |
| `build` | Build-time code: the service worker template and its precache list |

Good first issues are listed in [docs/IDEAS.md](docs/IDEAS.md).
