# My Wardrobe

Your entire wardrobe as a browsable collection — clothing cutouts extracted from your
own photos, laid out in a catalog grid, with AI try-on renders of you wearing each piece.

Inspired by [@cdngdev's wardrobe demo](https://x.com/cdngdev) (extract every piece of
clothing you own from your camera roll, then render new outfits on yourself) and the
accompanying [extract-clothing-cutouts skill](https://gist.github.com/tandpfun/b73063c8be8fc46644da9925d48b3240)
by [@tandpfun](https://github.com/tandpfun).

## What's here

- **The app** — a Vite + React wardrobe browser:
  - a grid of transparent clothing cutouts on a studio backdrop
  - click an item for a detail panel: name, category, and tag details ("office", "casual", …)
  - **colors extracted from the image** — a primary color, swatch suggestions you can click
    to apply, an eyedropper ("Pick primary color from image"), and a secondary color that is
    only suggested when a distinct color has meaningful coverage
  - **"Render on me"** — renders you wearing the selected piece with OpenAI's `gpt-image-1`
  - drag & drop images anywhere to add items; edits persist in `localStorage`
- **The skill** — `.claude/skills/extract-clothing-cutouts/SKILL.md`, included verbatim from
  the gist. Point Claude Code (or Codex) at a folder of photos and it extracts deduplicated,
  transparent, catalog-quality PNG cutouts of every garment worn in them.

## Quick start

```bash
npm install
npm run dev
```

The app opens with 15 generated placeholder garments so you can explore immediately
(regenerate them anytime with `npm run samples`).

## Filling it with *your* wardrobe

1. In Claude Code, ask for the `extract-clothing-cutouts` skill and point it at a folder of
   photos of you (it will ask for an input folder and an output folder name).
   > Note: the skill was written for Codex's built-in `imagegen` tool. In Claude Code,
   > substitute any image-generation step with your preferred image model (e.g. the
   > `gpt-image-1` API) — the workflow, QA, and chroma-key steps all still apply.
2. Drop the finished PNGs into `public/wardrobe/` and add entries to
   `src/data/wardrobe.json` — or simply drag & drop them onto the running app.

## Try-on renders

1. Put a full-body photo of yourself at `public/me.jpg` (or `.png`).
2. Provide an OpenAI API key, either as `VITE_OPENAI_API_KEY` in `.env` (see
   `.env.example`) or by pasting it into the panel — it's stored only in your browser's
   `localStorage`.
3. Select an item and hit **Render on me**.

> ⚠️ The key is used directly from the browser, which is fine for a personal tool running
> on `localhost` — don't deploy this publicly with a key baked in.

## Project layout

```
.claude/skills/extract-clothing-cutouts/   the extraction skill (verbatim from the gist)
public/wardrobe/                           cutout images (placeholders until you add yours)
scripts/generate-sample-cutouts.mjs        regenerates the placeholder SVGs
src/
  App.tsx                                  grid, filters, drag & drop import
  components/DetailPanel.tsx               try-on pane + item form
  lib/colors.ts                            palette extraction & secondary-color suggestion
  lib/tryon.ts                             gpt-image-1 try-on rendering
  lib/storage.ts                           localStorage overlay over the seed data
  data/wardrobe.json                       seed wardrobe
```
