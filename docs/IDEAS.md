# Ideas and good first issues

Each item says roughly where to start. Items marked **good first issue** are small and
self-contained.

## Good first issues
- **Elixir, Dart, Haskell colours.** Add languages to `src/layout/color.ts`, choosing hues
  that fit the existing families. Test in `tests/mapping.test.ts`.
- **"Largest and unchanged" insight.** Files over 100 KB untouched in the sample.
  `src/layout/insights.ts` + a block in `InsightsPanel.tsx`.
- **Keyboard shortcut list.** A `?` key that opens a small dialog of all shortcuts.
- **Copy path button** in the file detail panel.
- **Gist-friendly error.** `gist.github.com` links should get "Gists aren't repositories"
  instead of the generic host error (`src/data/parseRepoInput.ts`).
- **Timeline keyboard play/pause** with the space bar when the timeline is focused.
- **Remember the quality choice** across visits (localStorage, guarded with try/catch).

## Medium
- **Web Worker for `buildModel`.** Move layout off the main thread; transfer the typed arrays.
- **Compare two branches.** Two galaxies side by side, or one galaxy with added and removed
  stars highlighted.
- **Author filter.** Click an author in the timeline to replay only their comets.
- **Square share card** for Instagram (1080×1080).
- **Directory-aware search.** `components/` matches every file in any `components` folder.

## Bigger
- **Deeper history without a token** via GitHub's GraphQL API? It requires a token, so
  instead consider letting users upload a `git log --name-only` text file.
- **GitLab support.** A second client behind the same `RepoData` interface.
- **Embeddable widget.** `<iframe src=".../embed?repo=…">` for READMEs and docs sites.
- **Time-lapse export.** Record the comet replay as a WebM using `MediaRecorder` on the canvas.
