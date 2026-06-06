---
name: Tesseract.js esbuild setup
description: How to correctly integrate tesseract.js in this esbuild-bundled Express server, and MRZ accuracy lessons
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

## MRZ accuracy

**Root problem:** Tesseract misreads `<` filler characters as `C`, `L`, `K` (OCR-B font confusion). This corrupts name fields and MRZ parsing.

**Fix (implemented):** Two singleton workers:
- `_generalWorker` — default settings for full-page text (address, dates)
- `_mrzWorker` — `tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<"` + `PSM.SINGLE_BLOCK`, used on the binarised bottom-28% crop of the image

**Important:** `tessedit_pageseg_mode` expects the `PSM` enum (`PSM.SINGLE_BLOCK`), NOT a raw string like `"6"`. Import `PSM` from `"tesseract.js"`.

**Why two workers not setParameters():** `setParameters()` is global on the worker; concurrent uploads would race and corrupt each other's settings.

**Image preprocessing order:** grayscale → normalise → sharpen → then OCR. For MRZ crop: also threshold(140) to binarise before OCR.
