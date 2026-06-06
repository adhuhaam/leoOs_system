---
name: OCR approach and Tesseract esbuild gotchas
description: Current OCR approach (GPT Vision), credential priority, and non-obvious Tesseract esbuild pitfalls if ever reverted
---

## Current OCR: GPT Vision

The active OCR pipeline uses `gpt-4o` via the OpenAI client in
`artifacts/api-server/src/lib/ocr.ts`. It sends the passport image as
base64 in a chat.completions call and parses the JSON response.

**Credential priority (hardcoded in ocr.ts):**
1. `OPENAI_API_KEY` — user-provided; uses OpenAI's own endpoint (no baseURL override)
2. `AI_INTEGRATIONS_OPENAI_API_KEY` + `AI_INTEGRATIONS_OPENAI_BASE_URL` — Replit AI
   Integrations proxy; works without any key setup in this Repl.

Override the model with the `OCR_MODEL` environment variable (default: `gpt-4o`).

**MRZ validation layer is kept:** GPT is asked to return the raw MRZ lines; the
`mrz` library validates them with ICAO checksums. Checksum-validated fields
(passport number, DOB, expiry) are preferred over GPT's free-text extraction of
the same data. Fields not in the MRZ (date of issue, address) always come from
GPT's direct read.

**Why we switched away from Tesseract (twice):** Tesseract isn't accurate enough
for real-world Bangladesh/India/Nepal passports — OCR-B font confusion, glare,
skew, and scan quality all hurt it badly. GPT Vision handles these correctly.

## If you ever switch back to Tesseract — read this first

### tesseract.js must NOT be bundled by esbuild

It uses WASM binaries + worker_threads whose paths resolve relative to its own
node_modules directory. Bundling breaks those paths at runtime.

**Two requirements (both needed):**
- Add `"tesseract.js"` to the `external` array in `artifacts/api-server/build.mjs`.
- Add `tesseract.js` to `onlyBuiltDependencies` in `pnpm-workspace.yaml`, or pnpm
  skips its postinstall and the WASM/worker assets are missing.

**Why:** the failure is silent at build time and only shows up as a runtime path
error — easy to reintroduce by "cleaning up" the externals list.

### Do NOT try to download ocrb.traineddata

It does not exist in any official Tesseract repo or the tesseract.js CDN (all 404).
Use the stock `eng` model with `tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<"`.
Bundle `eng.traineddata` (tessdata_fast, ~4MB) and point workers at a local `langPath`.

### Tesseract MRZ accuracy lessons

- Per-field checksum salvage is better than all-or-nothing: emit each field only
  when its own check digit passes; drop invalid fields to null.
- Document-number O↔0 / B↔8 recovery must search by edit distance (k=1 first),
  not brute-force all glyphs at once — the uniqueness gate never fires with too
  many candidates.
- `tessedit_pageseg_mode` expects the `PSM` enum (e.g. `PSM.SINGLE_BLOCK`), not
  a raw string like `"6"`.
