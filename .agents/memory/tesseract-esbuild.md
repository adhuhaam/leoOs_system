---
name: Tesseract.js esbuild setup
description: Non-obvious gotchas for offline Tesseract.js OCR in this esbuild-bundled Express server, plus the MRZ checksum-recovery accuracy principles
---

## tesseract.js must NOT be bundled by esbuild

It uses WASM binaries + worker_threads whose paths resolve relative to its own
node_modules directory. Bundling breaks those paths at runtime.

**Two requirements (both needed):**
- Add `"tesseract.js"` to the `external` array in the api-server `build.mjs`.
- Add `tesseract.js` to `onlyBuiltDependencies` in `pnpm-workspace.yaml`, or pnpm
  skips its postinstall and the WASM/worker assets are missing.

**Why:** the failure is silent at build time and only shows up as a runtime
path error, so it's easy to reintroduce by "cleaning up" the externals list.

## Do NOT try to download ocrb.traineddata

It does not exist in any official Tesseract repo or the tesseract.js CDN (all
404). The correct offline approach for MRZ is the stock `eng` model constrained
with a `tessedit_char_whitelist` of `A-Z0-9<` — same effect (restricted output
alphabet) without a special model. Bundle `eng.traineddata` (tessdata_fast is
fine, ~4MB) and point workers at a local `langPath` for true offline operation.

## MRZ accuracy: trust check digits, never fabricate

The TD3 MRZ carries its own check digits; lean on them rather than trusting raw
OCR. Durable rules that took several iterations to get right:

- **Per-field salvage, not all-or-nothing.** Emit documentNumber / birthDate /
  expiry only when their *own* check digit (or full MRZ validity) passes; drop
  invalid fields to null instead of discarding the whole parse. An operator
  correcting one null beats silently storing a wrong value.
- **Document-number recovery must search by edit distance, not brute force.**
  The doc number field is alphanumeric, so O↔0 / B↔8 confusions can't be fixed
  by position-class coercion or the `mrz` library's autocorrect. A single mod-10
  check digit only pins down a few errors, so expanding every ambiguous glyph at
  once yields many candidates that pass the digit by coincidence → the
  uniqueness gate never fires (effectively a no-op). Instead try k=1 correction,
  then k=2, then k=3, and accept only when exactly ONE candidate at the smallest
  edit distance validates. Otherwise leave it for per-field salvage to drop.
  **Why:** keeps recovery reliable for mostly-correct reads while guaranteeing we
  never invent a passport number.
- **Multi-variant preprocessing + checksum scoring.** Different crop ratios /
  thresholds win on different scans; run several, score each parse by how many
  check digits validate, and early-exit on a fully-valid parse.
- `tessedit_pageseg_mode` expects the `PSM` enum (e.g. `PSM.SINGLE_BLOCK`), not a
  raw string like `"6"`.
