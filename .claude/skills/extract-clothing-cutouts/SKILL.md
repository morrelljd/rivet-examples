---
name: extract-clothing-cutouts
description: Extract high-quality, deduplicated transparent ecommerce clothing cutouts from a folder of photographs where people wear one or more garments. Use when Codex must find outfit or model photos, identify unique clothing across images, create focused references, reconstruct complete garments with Imagegen, remove a solid chroma background into RGBA PNGs, and output only the finished clothing images into a new folder under the current working directory.
---

# Extract Clothing Cutouts

Turn photographs of worn clothing into source-faithful standalone catalog PNGs. Treat each result as a reconstruction from visible evidence, not literal segmentation whenever the wearer or another layer occludes part of the garment.

## Start by asking for two paths

Before doing any work, obtain both values unless the user already supplied them:

1. Ask: `Where can I find the input images? You can give me "." or a folder path relative to the current directory.`
2. Ask: `What should the new output folder be called? I will create it inside the current directory.`

Resolve a relative input path from the current working directory. Resolve the output as exactly one new child folder of the current working directory. If the output path already exists, ask for a different folder name. Do not merge with or overwrite an existing folder.

## Output contract

- Put only finished transparent RGBA clothing PNGs in the requested output folder.
- Use descriptive lowercase hyphenated names such as `navy-fair-isle-cardigan.png`.
- Keep source copies, crops, prompts, chroma images, manifests, and QA files in temporary storage only.
- Preserve every input image unchanged.
- Delete temporary work after final verification succeeds.
- Return the absolute output path and number of PNGs created. Briefly mention clothing fragments skipped because they were too obscured.

Create temporary work outside the output folder:

```bash
WORK="$(mktemp -d "${TMPDIR:-/tmp}/clothing-cutouts.XXXXXX")"
mkdir -p "$WORK"/{source-jpg,crops,chroma,items,qa}
```

If a deterministic helper is needed, write it under `$WORK`; never add auxiliary files to this skill or the final output folder.

## Non-negotiable quality rules

- Read and follow the built-in `imagegen` skill before the first image generation or edit.
- Generate exactly one item per output, except an established matching pair such as shoes or socks.
- Exclude the wearer, body, skin, hair, mannequin, hanger, props, other layers, and scene.
- Prefer omission over invention. Do not guess unreadable text, hidden construction, branding, pockets, fasteners, hardware, or trim.
- Hold fragments whose item type or defining construction cannot be recovered without substantial fabrication.
- Merge duplicates only when source photographs support physical identity. Generated-image similarity is not proof.
- Inspect source crops and final contact sheets visually. Numeric alpha checks cannot establish source fidelity.

## Workflow

### 1. Discover and normalize the source photos

Use `rg --files` first. Include common raster formats such as JPEG, PNG, WebP, HEIC/HEIF, TIFF, BMP, and AVIF. Exclude the requested output path and temporary work path from discovery.

Create upright high-quality JPEG working copies in `$WORK/source-jpg`:

- Apply EXIF orientation.
- Preserve the original pixel dimensions unless memory pressure requires downscaling; never upscale.
- Convert only the working copy to RGB JPEG at quality 95 or better.
- Resolve duplicate basenames with a short stable hash of the relative source path.
- Record original path, normalized filename, dimensions, and source hash in `$WORK/sources.json`.
- Use Pillow when it can decode the format; use `sips` on macOS or `ffmpeg` as a HEIC/AVIF fallback.

Create source contact sheets of at most 12 images each, labeled with normalized filenames. Open and inspect every sheet. Do not infer the wardrobe from filenames alone.

For large folders, split a read-only inventory among subagents using disjoint source batches. Keep one main agent responsible for global item identity, duplicate decisions, generation reconciliation, and final QA.

### 2. Inventory every deliberately worn item

Include tops, bottoms, outerwear, dresses, footwear, hosiery, swimwear, belts, ties, and headwear. Exclude non-clothing props unless requested.

Build this internal manifest shape in `$WORK/manifest.json`:

```json
{
  "items": [
    {
      "slug": "navy-fair-isle-cardigan",
      "label": "Navy Fair Isle Cardigan",
      "category": "outerwear",
      "status": "generate",
      "confidence": "high",
      "description": "Deep navy long zip cardigan with a white Fair Isle yoke and dotted lower knit.",
      "observed": {
        "color": "deep navy and white",
        "material": "medium-weight knit",
        "silhouette": "long relaxed straight body",
        "construction": "center zipper, long sleeves, ribbed cuffs and hem",
        "marks": "white geometric yoke and small white knit dots"
      },
      "unknowns": [],
      "graphic_policy": "exact",
      "chroma_key": "#00ff00",
      "source_refs": [
        {
          "source": "IMG_1284.jpg",
          "bbox": [0.12, 0.08, 0.83, 0.86],
          "role": "primary",
          "notes": "Best overall silhouette and front construction."
        },
        {
          "source": "IMG_1289.jpg",
          "bbox": [0.18, 0.05, 0.79, 0.91],
          "role": "complementary",
          "notes": "Shows lower length and hem."
        }
      ],
      "possible_duplicates": [],
      "duplicate_evidence": "No matching construction found elsewhere."
    }
  ]
}
```

Use these manifest rules:

- Use unique lowercase hyphenated slugs.
- Express bounding boxes as normalized `[left, top, right, bottom]` floats in `[0, 1]` on the upright normalized source.
- Make the first reference the strongest overall view.
- Add at most one complementary reference unless an exceptional item genuinely needs more.
- Use `graphic_policy: exact` only for legible wording, `mark-only` for a visible but unreadable emblem, and `omit` for uncertain branding.
- Put uncertain attributes in `unknowns`; do not convert guesses into facts.
- Use `status: hold` when item type or defining construction is unknowable.
- Consolidate source-proven repeats before generation, but keep visually similar items separate when identity is uncertain.

### 3. Prepare focused generation references

For every `generate` record:

1. Convert the normalized bounding box to pixels.
2. Add about 12% padding on every side, clamped to the image bounds.
3. Reject a crop whose shorter original dimension is below about 64 pixels unless the item is legitimately narrow, such as a belt or tie.
4. Preserve aspect ratio and place the crop on a neutral square canvas around 1200–1400 pixels.
5. Save the primary crop as `$WORK/crops/SLUG.jpg` and a complementary crop as `SLUG-ref2.jpg`.

Create labeled crop contact sheets and inspect them. Keep enough context to distinguish the target from underlayers while making the target dominant. Never combine references merely because the garments look similar.

### 4. Build one evidence-bound Imagegen prompt per item

Use this structure, replacing every bracket with source evidence and deleting irrelevant clauses:

```text
Use case: background-extraction
Asset type: transparent ecommerce clothing catalog cutout, generated first on a removable chroma key

Input image(s): The reference photograph(s) show the exact same [ITEM] worn by a person. Use them only to identify and reconstruct that item. Image 1 contributes [SILHOUETTE/CONSTRUCTION]. Image 2 contributes [DETAIL], if present. Do not mix in details from visually similar clothing.

Primary request: Reconstruct ONLY the complete empty [ITEM NAME] as a clean [FRONT/ANGLE] ecommerce catalog product photograph. Remove the wearer, body, skin, hair, [VISIBLE UNDERLAYER], [OTHER CLOTHING], and the scene. Show the complete unoccluded item, naturally and symmetrically arranged, with no person, mannequin, or hanger visible.

Item fidelity: Preserve the source-supported [COLOR], [MATERIAL/TEXTURE], [SILHOUETTE], [NECKLINE/WAIST/OPENING], [SLEEVES/LEGS/SHAFTS], [FASTENING], [HEM/SOLE], [PATTERN], and [CLEAR MARKS]. [STATE UNKNOWNS AND WHAT TO OMIT.] Do not invent any other logo, lettering, label, pocket, seam, fastener, hardware, color, or decoration.

Composition: [SQUARE/PORTRAIT/LANDSCAPE] canvas, centered [VIEW], complete item fully inside frame with generous even padding around every outer edge; no cropping or truncation.

Background: perfectly flat, absolutely uniform solid [CHROMA KEY] edge-to-edge. The background must be exactly one color with no shadow, gradient, texture, vignette, floor, horizon, reflection, or lighting variation.

Lighting: neutral diffuse high-end ecommerce product lighting contained on the item only; no cast shadow, contact shadow, reflection, prop, watermark, caption, or border.

Critical: use no [CHROMA KEY] anywhere in the item; preserve a crisp separable outer silhouette; output only one [ITEM OR MATCHED PAIR].
```

Use direct evidence language:

- `Preserve the four small white buttons visible in a vertical row.`
- `The pink fabric is a separate underlayer and must not appear.`
- `The dark lower shapes are cast leaf shadows, not a print.`
- `The source mark is unreadable; omit text rather than inventing it.`
- `The neckline is unresolved; use the simplest construction consistent with the visible opening.`

Avoid vague requests such as `make it stylish`, `improve the design`, or `complete it naturally`; they encourage invention.

Choose the chroma key:

- Default to pure `#00ff00`.
- Use `#ff00ff` for green garments unless magenta or pink is prominent.
- Otherwise choose a maximally distant pure saturated RGB color and record it as `chroma_key`.
- Require the same solid color at every border pixel.

Choose category-appropriate framing:

- Tops and outerwear: front view with neck opening, complete sleeves, cuffs, and hem.
- Pants and tights: portrait view with waistband, full legs, and complete hems or enclosed feet.
- Skirts and dresses: front view with waistband or neckline, full length, and complete hem.
- Footwear: a matched pair only when established; use a slightly elevated front three-quarter view when openings and soles matter.
- Belts and ties: align the long axis with a landscape or portrait canvas and keep both ends complete.
- Swimwear: complete every strap and tie endpoint.

### 5. Generate and reconcile

Use the built-in Imagegen tool with the primary crop and only a genuinely complementary second crop. Save the returned chroma image to `$WORK/chroma/SLUG.png` and keep the exact prompt in temporary records.

For more than eight items, partition disjoint slug batches among subagents. Limit each slug to one active generation. Require each worker to return slug, prompt, reference paths, chroma path, and brief visual review. Reconcile all results against the manifest and resume only missing or failed slugs.

Compare every chroma result with its source before accepting it. Plausibility alone is insufficient.

### 6. Remove the chroma background

Prefer the tested helper from the built-in Imagegen skill when present:

```bash
python3 "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" \
  --input "$WORK/chroma/SLUG.png" \
  --out "$WORK/items/SLUG.png" \
  --auto-key border \
  --soft-matte \
  --transparent-threshold 12 \
  --opaque-threshold 220 \
  --despill \
  --force
```

If that helper is unavailable, implement the same temporary operation with Pillow:

1. Sample the median RGB value from a thin band around all four borders.
2. For each pixel, measure maximum per-channel distance from the sampled key.
3. Make distance `<=12` fully transparent and distance `>=220` fully opaque.
4. Use a smoothstep alpha ramp between those thresholds and multiply by the original alpha.
5. For partially transparent pixels, cap key-dominant channels to the strongest non-key channel to remove spill.
6. Set fully transparent pixels to `(0, 0, 0, 0)` and save RGBA PNG.

Use border sampling only when the generated background is visibly uniform. If removal damages clothing colors, regenerate with a more distant key instead of forcing a destructive matte.

### 7. Perform technical and visual QA

For every PNG, verify with Pillow or an equivalent decoder:

- format is PNG and mode is RGBA;
- alpha channel contains both transparent and visible pixels;
- all four corners are transparent;
- the outer border is substantially transparent;
- nontransparent content is neither empty nor nearly the entire canvas;
- the alpha bounding box leaves visible padding and no item extremity is clipped;
- no obvious chroma-colored pixels remain along partially transparent edges;
- every `generate` manifest slug has exactly one output and no unexplained output exists.

Create checkerboard contact sheets of at most 12 cutouts each in `$WORK/qa`. Inspect every sheet, then inspect sensitive items individually against their source crops.

Apply this visual rubric:

1. Confirm target identity and category.
2. Compare proportions, silhouette, color, and material character.
3. Compare neckline, rise, waist, opening, sleeve or leg length, hem, and sole shape.
4. Compare fasteners, pockets, trim, pattern placement, and clearly legible marks.
5. Confirm complete topology: every sleeve, cuff, strap, tie, hem, toe, heel, shaft, or enclosed foot.
6. Confirm absence of body parts, underlayers, adjacent clothing, props, shadow, and background.
7. Reject unsupported construction or fake text.

Treat failures as:

- Critical: wrong item, body remains, another garment is fused in, major clipping, opaque background, or destructive matte. Regenerate.
- Major: invented hood, collar, pocket, fastening, wrong silhouette or color, fake logo/text, missing defining pattern, or incomplete endpoints. Correct or regenerate.
- Minor: faint edge halo, slight centering drift, or low-impact texture drift. Correct when visible at catalog size.

When correcting, attach the current output plus the strongest source crop and use:

```text
Correct the attached catalog cutout using the source crop. Keep the successful silhouette, color, and chroma-workflow composition. Remove the unsupported [FAILURE]. Restore the source-supported [DETAIL]. Do not add [COMMON HALLUCINATION]. Return the corrected item on the same uniform [CHROMA KEY] background with no shadow.
```

If an item fails twice, rewrite the prompt around the observed failure rather than repeating it unchanged.

### 8. Deduplicate conservatively

Use perceptual hashes or silhouette/color similarity only to rank pairs for review. Never auto-delete from generated-image similarity.

Confirm identity from source photos using matching distinctive construction, pattern placement, distressing, hardware, or logos; compatible color and material; and absence of contradictory details. Repeated outfit context or adjacent-photo chronology is supporting evidence, not sole proof.

Do not merge generic black skirts, plain tops, jeans, or shoes merely because Imagegen standardized their poses. Retain both when source evidence is inconclusive. Keep one canonical slug only for source-proven duplicates.

### 9. Deliver only the finished PNGs

After all accepted items pass:

1. Confirm the requested output folder still does not exist.
2. Create that one folder inside the current working directory.
3. Copy only accepted canonical `.png` files from `$WORK/items` into it.
4. Reopen every copied file and confirm RGBA plus transparency.
5. Confirm the folder contains no non-PNG files, duplicate aliases, or auxiliary artifacts.
6. Delete `$WORK` only after final verification succeeds.

Return the absolute output-folder path and PNG count, and display up to 12 images to the user in chat, mentioning that they can view the rest in the directory. Mention any unrecoverable fragments briefly.
