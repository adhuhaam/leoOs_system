---
name: Tesseract.js esbuild setup
description: How to correctly integrate tesseract.js in this esbuild-bundled Express server
---

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

**How to apply:** Any time tesseract.js is added to a new package in this monorepo, repeat both steps for that artifact's build config.
