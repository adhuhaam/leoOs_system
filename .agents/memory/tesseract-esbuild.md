---
name: Tesseract.js esbuild setup
description: How to correctly integrate tesseract.js in this esbuild-bundled Express server, and MRZ OCR accuracy approach
---

## esbuild bundling

`tesseract.js` must NOT be bundled by esbuild. It uses WASM binaries and worker_threads with file paths relative to its installed location in node_modules — bundling breaks those paths.

**Two things required:**

1. Add to `external` array in `artifacts/api-server/build.mjs`:
   ```js
   "tesseract.js",
   ```

2. Add to `onlyBuiltDependencies` in `pnpm-workspace.yaml`:
   ```yaml
   onlyBuiltDependencies:
     - tesseract.js
   ```
   Without this, pnpm shows a warning and skips the postinstall script.

**Why:** tesseract.js v7+ relies on WASM + Node.js worker_threads. The WASM binary and traineddata paths are resolved relative to the package's own directory in node_modules. If esbuild inlines the JS, those relative paths break at runtime.

## MRZ accuracy approach

**Root problem:** Tesseract misreads `<` filler characters as `C`, `L`, `K` (OCR-B font confusion). This corrupts name fields and MRZ parsing.

**Implemented fix:** Two singleton workers, kept separate to avoid `setParameters()` races on concurrent uploads:

- `_generalWorker` — default settings, `eng` language → full-page OCR for address, date of issue
- `_mrzWorker` — `eng` + `tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<"` + `PSM.SINGLE_BLOCK` → runs on the binarised bottom-28% crop of the image

**Important:** `tessedit_pageseg_mode` expects the `PSM` enum (`PSM.SINGLE_BLOCK`), NOT a raw string like `"6"`. Import `PSM` from `"tesseract.js"`.

**Image preprocessing:** grayscale → normalise → sharpen (sigma 1.5) before any OCR. For MRZ crop: additionally threshold(140) to binarise.

## DO NOT attempt ocrb.traineddata

`ocrb.traineddata` does not exist in any official Tesseract repository:
- `tessdata`, `tessdata_fast`, `tessdata_best` — all 404
- tesseract.js CDN (tessdata.projectnaptha.com) — also 404

The `eng` + char whitelist approach is the correct solution for MRZ accuracy. It achieves the same goal (constrained output alphabet) without needing a special model.
