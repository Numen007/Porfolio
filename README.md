# Prabodh Kale — Portfolio & Links

Personal site for Prabodh Kale, video editor and AI visual storyteller (Mumbai).

- `index.html` — portfolio
- `links/` — link-in-bio page (`/links`)

Plain HTML, CSS and JavaScript: no build step, no dependencies.

## Run locally

```bash
python3 -m http.server 4173
```

Then open http://localhost:4173.

## Editing the work grid

All videos are listed in `data.js`:

- `t` title, `c` category (`ai`, `motion`, `podcast`, `short`), `tag` small label, `v: true` for vertical reels
- `pos: 1–9` pins a video to the top rows, in that order; the same nine drive the hero background, the showreel and the bio page
- `later: true` moves a video below the first rows

Most videos stream from the Wix media CDN (`id` + `p` poster frame). Self-hosted ones live in `assets/video/` and use `src` instead:
`<name>.mp4` (full), `<name>-sm.mp4` (hover preview) and `<name>.jpg` (poster).

The three podcast episodes are YouTube embeds, written directly in `index.html`.

After changing `data.js`, `main.js` or `styles.css`, bump the `?v=` number on their `<script>`/`<link>` tags so returning visitors get the new version.
