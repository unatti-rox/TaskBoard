# Creative Export

Batch resizing/export pipeline: takes one master creative and exports every
required ad size (social, display, print) as separate files, ready to hand
off to media buying.

## Setup (one time)

```bash
cd scripts/creative-export
npm install
```

## Use

```bash
node export-creative.js path/to/master.png
```

This exports every size in `sizes.json` into `./exports/`, named
`{master-filename}_{SizeLabel}.{ext}` — e.g. a master called
`campaign-hero.png` produces:

```
exports/campaign-hero_FB-1080x1920-reel.jpg
exports/campaign-hero_FB-1080x1920-story.jpg
exports/campaign-hero_FB-1200x628.jpg
exports/campaign-hero_FB-1200x1200.jpg
exports/campaign-hero_GD-960x1200.jpg
exports/campaign-hero_GD-1200x628.jpg
exports/campaign-hero_GD-1200x1200.jpg
```

Each size crops the master to fill the target aspect ratio, centered
(so no stretching or distortion).

## Options

```
node export-creative.js <master-file> [options]

  --out=<dir>         Output directory (default: ./exports)
  --sizes=<file>       Sizes config JSON (default: ./sizes.json)
  --format=jpg|png|webp  Force output format for every size (default: per-size, jpg)
  --fit=cover|contain  cover crops to fill (default); contain fits the whole image
                        and pads with --background
  --background=#hex    Background/pad color (default: #ffffff)
  --quality=<1-100>    JPEG/WebP quality (default: 90)
```

## Adding or changing sizes

Edit `sizes.json`. Each entry is:

```json
{ "name": "GD-300x250", "width": 300, "height": 250, "format": "jpg" }
```

- `name` becomes part of the exported filename and should follow your
  naming convention (e.g. `PLATFORM-WIDTHxHEIGHT[-variant]`).
- `format` is optional; omit it to fall back to the script's default (jpg).

Current defaults cover:

| Name | Size | Use |
|---|---|---|
| FB-1080x1920-reel | 1080x1920 | Facebook/Instagram Reel |
| FB-1080x1920-story | 1080x1920 | Facebook/Instagram Story |
| FB-1200x628 | 1200x628 | Facebook feed link ad |
| FB-1200x1200 | 1200x1200 | Facebook feed square |
| GD-960x1200 | 960x1200 | Google Display vertical |
| GD-1200x628 | 1200x628 | Google Display landscape |
| GD-1200x1200 | 1200x1200 | Google Display square |
