<div align="center">

<img src="public/favicon.svg" width="72" height="72" alt="" />

# Gitsky

**Paste any public GitHub repo and explore it as a living 3D galaxy.**

### [→ Open Gitsky](https://YOUR-GITHUB-USERNAME.github.io/Gitsky/)

<!-- HERO GIF: replace this line with the 6-second clip described in docs/RECORDING.md -->
<!-- ![Gitsky: a repo forming as a spiral galaxy, comets streaking in](docs/hero.gif) -->
<img src="public/og-image.jpg" alt="The vite repository drawn as a spiral galaxy, with its stats beside it" width="720" />

</div>

---

Folders are star systems. Files are stars. Recent commits streak in as comets. In 30
seconds you can see where a codebase is big, where it's busy, and where nobody has
touched anything in a while.

## Features

- **A galaxy per repo.** Top-level folders sit on logarithmic spiral arms, biggest near the
  core; nested folders cluster around them. The same repo always looks the same.
- **Stars that mean something.** Colour is the language, size is the file's bytes (log
  scale), brightness and twinkle are how often it changed in the sampled commits.
  The hottest files get diffraction spikes.
- **Comets.** The last N commits replay in order: one comet per touched file, coloured by
  author, flashing its star on arrival. Scrub the timeline to any commit.
- **A supernova.** The most-changed file explodes when its comet lands.
- **Warp into any folder.** It becomes a solar system: its files are planets (most-changed
  closest to the sun), its sub-folders ringed gas giants you can warp into next.
- **Zoom into a file.** Select any star and its contents load: its functions, classes and
  headings orbit it as planets, and a code panel shows the outline and source.
- **Zoom out to the universe.** See the people who build a repo and the other projects they
  build, as a field of galaxies joined by filaments. Chart any of them with one click.
- **Collide two repos.** `?repo=react/react&vs=vitejs/vite` crashes two galaxies together in a
  gravity simulation: tidal tails, bridges, a merger. Files they share are threaded with light.
- **Understand it in 30 seconds.** A written summary, hottest files, largest files,
  language share, quiet zones and contributors. Click anything to fly there.
- **Find anything.** Search pulses every match; Enter flies to the best one. Hover for
  details, click for a panel with recent commits and a link to the file on GitHub.
- **Share your sky.** Export a 1200×630 poster of your current view, or copy a
  `?repo=owner/name` link that opens straight to it.
- **Accessible.** Every control is keyboard-reachable, and a List view shows the same data
  as a sortable table. Respects reduced motion.
- **Fast on modest hardware.** 50,000 stars at 60 fps on an Intel Iris Xe laptop GPU, with
  automatic quality downgrade if frames drop. Works on phones.

## How it works

```
 owner/repo ─▶ GitHub REST API ─────────────▶ IndexedDB cache ─▶ layout (pure TS) ─▶ WebGL
              (from your browser)              (reloads are free)   spiral + clusters    one draw call
              ├─ repo meta                1 call                    sizes, colours       for every star
              ├─ last 100 commits         1 call                    churn, nebulae       + bloom
              ├─ whole file tree          1 call
              └─ files per commit         1 call each, sized to your remaining quota
```

Without a token GitHub allows 60 requests an hour, so Gitsky reads your remaining quota
first and samples as many commits as it can afford (about 25). With an optional token it
samples up to 300. Four famous repos are bundled as snapshots and cost no API calls at all.

## Privacy

There is **no Gitsky server**. The site is static files on GitHub Pages; your browser talks
to `api.github.com` directly. If you add a token, it stays in this browser tab's
`sessionStorage` (gone when you close the tab) and is only ever sent to `api.github.com`.
No analytics, no cookies.

Opening a file reads it from `raw.githubusercontent.com` (no API quota). The Universe view
asks the GitHub API about the repo's contributors and their public repos, and shows their
public avatars from GitHub. Nothing is sent anywhere else.

## Limitations

Gitsky samples recent history, sizes are bytes not lines, and very large trees can be
truncated by GitHub. The full, honest list is in [LIMITATIONS.md](LIMITATIONS.md).

## Run it locally

```bash
git clone https://github.com/YOUR-GITHUB-USERNAME/Gitsky.git
cd Gitsky
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests, a couple of seconds
npm run build      # production build in dist/
```

Useful extras:

- `http://localhost:5173/?repo=pmndrs/zustand` opens a repo directly.
- `http://localhost:5173/?stress=50000` draws a labelled synthetic sky for performance testing.
- `npm run snapshot -- owner/repo` fetches a repo into `public/snapshots/` (set
  `GITHUB_TOKEN` for deeper history), and `npm run snapshot:index` rebuilds the index
  without any API calls.

## Learn how it's built

[`learn/`](learn/README.md) is a short course written alongside the code: spiral-galaxy
math, shaders, instanced rendering, bloom, picking, rate-limited APIs, caching, and the real
bugs we hit along the way. Start at [learn/README.md](learn/README.md).

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md), and
[docs/IDEAS.md](docs/IDEAS.md) for good first issues.

## License

[MIT](LICENSE)
