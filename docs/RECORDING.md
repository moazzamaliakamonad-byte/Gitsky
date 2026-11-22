# Recording the hero GIF

> Easiest takes: open the site, press **Take the guided tour** and record the first 20
> seconds; or open a sky and press **D** (drift mode) for a clean, interface-free shot that
> moves on its own.

## Alternative: deep time (the strongest single shot)
Open `?repo=vitejs/vite`, press the hourglass (**Deep time**) and record about 15 seconds:
the galaxy grows from a handful of stars in 2020 to today's spiral, with folders igniting
as they're born. Move the cursor off the canvas before you start.

The README's first screen needs one 6-second clip that makes people want to try it. This is
the exact shot list.

## The shot (6 seconds, looped)

| Time | What happens | How |
|------|--------------|-----|
| 0.0–2.6 s | The galaxy **forms**: stars spiral out of the core while the camera descends | Load `?repo=react/react` fresh (the intro plays on every load) |
| 2.6–4.0 s | Two or three **comets** streak in and their stars flash | Playback starts automatically once the galaxy has formed |
| 4.0–5.2 s | Type `/` then `fiber` in search: matches **pulse** across the sky | Pre-type nothing; type at a natural speed |
| 5.2–6.0 s | Press Enter: the camera **flies** to `ReactFiberHooks.js`, the panel slides in | Stop recording as the panel settles |

Don't show the hero text: start from `?repo=react/react`, which opens straight into the
explore view.

## Setup
1. Use the **production build** for smooth frames: `npm run build && npm run preview`, then
   open `http://localhost:4173/?repo=react/react`.
2. Browser window **1280×720**, 100% zoom, no extensions visible, bookmarks bar hidden.
3. Settings (gear): quality **High**.
4. Do one dry run, so the snapshot is cached and fonts are loaded.

## Recording on Windows (free)
- **ShareX** (free, open source): *Capture → Screen recording (GIF)*, select the browser's
  page area, 30 fps. Or record MP4 with *Screen recording* and convert below.
- Or **Xbox Game Bar** (`Win + G`) to MP4, then convert.

## Converting and sizing
GitHub READMEs autoplay GIFs; keep it **under 8 MB** (ideally 3–5 MB).

```bash
# MP4 → high-quality GIF at 720 px wide, 20 fps, with a generated palette
ffmpeg -i clip.mp4 -vf "fps=20,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=192[p];[b][p]paletteuse=dither=bayer:bayer_scale=4" docs/hero.gif
```

Dark, noisy space scenes compress poorly. If the GIF is too large, drop to `fps=15` or
`scale=640:-1`. Alternatively, commit `docs/hero.mp4` and embed it as a video in the README
(GitHub renders uploaded MP4s in issues and READMEs when dragged into the web editor).

## Putting it in the README
Save as `docs/hero.gif`, then in `README.md` replace the `<img src="public/og-image.jpg" …>`
line with:

```md
![Gitsky: the react repo forming as a spiral galaxy, comets streaking in](docs/hero.gif)
```
