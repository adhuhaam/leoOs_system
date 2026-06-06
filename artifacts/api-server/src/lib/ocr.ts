import { createWorker, PSM } from "tesseract.js";
import { parse as parseMRZ, type ParseResult } from "mrz";
import sharp from "sharp";
import path from "node:path";
import { logger } from "./logger";

/**
 * Bundled tessdata directory — contains eng.traineddata (committed to repo).
 * __dirname is set by the esbuild banner to the dist/ directory at runtime,
 * so ../tessdata resolves to artifacts/api-server/tessdata/.
 * Using a local langPath means the workers never need outbound network access,
 * making the server fully offline-capable (Raspberry Pi, air-gapped deployments).
 */
const TESSDATA_DIR = path.resolve(__dirname, "../tessdata");

export interface ExtractedPassportData {
  fullName: string | null;
  passportNumber: string | null;
  dateOfBirth: string | null;
  dateOfIssue: string | null;
  dateOfExpiry: string | null;
  address: string | null;
  nationality: string | null;
}

/**
 * Two singleton workers:
 *   _generalWorker — default Tesseract settings, used for full-page text OCR
 *                    (address, date of issue, general biographical content)
 *   _mrzWorker     — character whitelist restricted to A-Z 0-9 < only, PSM 6
 *                    (single uniform block), used for the MRZ strip OCR
 *
 * Keeping them separate avoids setParameters() race conditions when multiple
 * uploads are in-flight at the same time.
 */
let _generalWorker: Awaited<ReturnType<typeof createWorker>> | null = null;
let _mrzWorker: Awaited<ReturnType<typeof createWorker>> | null = null;

async function getGeneralWorker(): Promise<Awaited<ReturnType<typeof createWorker>>> {
  if (_generalWorker) return _generalWorker;
  logger.info({ tessdata: TESSDATA_DIR }, "Initializing general Tesseract worker");
  _generalWorker = await createWorker("eng", 1, { langPath: TESSDATA_DIR });
  logger.info("General Tesseract worker ready");
  return _generalWorker;
}

async function getMrzWorker(): Promise<Awaited<ReturnType<typeof createWorker>>> {
  if (_mrzWorker) return _mrzWorker;
  logger.info("Initializing MRZ Tesseract worker");

  try {
    // Use the standard eng model with a strict character whitelist.
    //
    // The whitelist (A-Z, 0-9, <) means Tesseract can only output characters
    // that are valid in an ICAO MRZ — this directly prevents the most common
    // OCR-B misreads where '<' filler chars are returned as C, L, or K.
    //
    // PSM.SINGLE_BLOCK tells Tesseract the crop is a single uniform text block
    // (the two or three MRZ lines at the bottom of the passport page).
    //
    // These two workers are kept separate so setParameters() calls on the MRZ
    // worker never race with in-flight general OCR requests.
    _mrzWorker = await createWorker("eng", 1, { langPath: TESSDATA_DIR });
    await _mrzWorker.setParameters({
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<",
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    });
    logger.info("MRZ Tesseract worker ready");
  } catch (err) {
    _mrzWorker = null;
    logger.error({ err }, "Failed to initialize MRZ Tesseract worker");
    throw err;
  }

  return _mrzWorker;
}

/** Graceful shutdown — call once on SIGTERM/SIGINT. */
export async function terminateOcrWorker(): Promise<void> {
  await Promise.all([
    _generalWorker?.terminate().then(() => { _generalWorker = null; }),
    _mrzWorker?.terminate().then(() => { _mrzWorker = null; }),
  ]);
}

// ---------------------------------------------------------------------------
// Image preprocessing
// ---------------------------------------------------------------------------

/**
 * Enhance the full image for general (full-page) OCR:
 * auto-rotate (EXIF) → grayscale → normalise (stretch contrast) → mild sharpen.
 */
async function enhanceForOcr(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()        // honour EXIF orientation from phone cameras
    .grayscale()
    .normalise()
    .sharpen({ sigma: 1.5 })
    .toBuffer();
}

/**
 * A normalised grayscale copy of the whole image plus its dimensions.
 * Computed once and reused to cut every MRZ crop variant, so we only pay the
 * decode/rotate/normalise cost a single time.
 */
interface GrayBase {
  buf: Buffer;
  w: number;
  h: number;
}

async function makeGrayBase(buffer: Buffer): Promise<GrayBase | null> {
  try {
    const buf = await sharp(buffer).rotate().grayscale().normalise().toBuffer();
    const meta = await sharp(buf).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (w < 100 || h < 100) return null;
    return { buf, w, h };
  } catch {
    return null;
  }
}

/**
 * MRZ binarisation mode for a crop variant.
 *   soft — no hard threshold; let Tesseract pick its own (Otsu) threshold
 *   t128/t140/t160 — fixed binarisation thresholds for varying exposure
 */
type MrzMode = "soft" | "t128" | "t140" | "t160";

/** Upscaling target — OCR-B reads best when the 44-char strip is wide. */
const MRZ_TARGET_WIDTH = 1500;

/**
 * Crop the bottom `ratio` of the page, upscale to a consistent width, sharpen
 * and (optionally) binarise. Returns null if the crop can't be produced.
 *
 * Producing several variants and letting MRZ checksums pick the winner is the
 * single biggest accuracy lever for offline OCR: a threshold that destroys one
 * photo is perfect for another, so we try a spread and keep the best parse.
 */
async function makeMrzCrop(
  base: GrayBase,
  ratio: number,
  mode: MrzMode,
): Promise<Buffer | null> {
  try {
    const cropTop = Math.floor(base.h * (1 - ratio));
    const cropHeight = base.h - cropTop;
    if (cropHeight < 20) return null;

    let img = sharp(base.buf)
      .extract({ left: 0, top: cropTop, width: base.w, height: cropHeight })
      .resize({ width: MRZ_TARGET_WIDTH, withoutEnlargement: false, kernel: "lanczos3" })
      .sharpen({ sigma: 1.2 });

    if (mode === "t128") img = img.threshold(128);
    else if (mode === "t140") img = img.threshold(140);
    else if (mode === "t160") img = img.threshold(160);

    return await img.toBuffer();
  } catch {
    return null;
  }
}

/**
 * Ordered crop variants, best-guess first. The main pipeline early-exits as
 * soon as one produces a fully checksum-valid MRZ, so clean scans only pay for
 * the first pass; only difficult photos run the whole spread.
 */
const MRZ_VARIANTS: ReadonlyArray<{ ratio: number; mode: MrzMode }> = [
  { ratio: 0.30, mode: "soft" },
  { ratio: 0.30, mode: "t140" },
  { ratio: 0.25, mode: "soft" },
  { ratio: 0.35, mode: "t128" },
  { ratio: 0.22, mode: "soft" },
  { ratio: 0.40, mode: "t160" },
];

// ---------------------------------------------------------------------------
// MRZ line extraction
// ---------------------------------------------------------------------------

/**
 * Pull every MRZ-looking line out of raw Tesseract output, normalised to
 * exactly 44 chars (TD3). Returns them top-to-bottom in page order.
 */
function mrzCandidateLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) =>
      l
        .replace(/\s+/g, "")
        .replace(/[«»|]/g, "<")
        .replace(/[^A-Z0-9<]/gi, "")  // strip any remaining non-MRZ chars
        .toUpperCase()
    )
    .filter((l) => l.length >= 38 && l.length <= 48 && /^[A-Z0-9<]+$/.test(l))
    .map((l) => (l.length === 44 ? l : l.padEnd(44, "<").substring(0, 44)));
}

/**
 * Extract the two TD3 MRZ lines (44 chars each) from raw Tesseract output.
 * Returns the last two candidates (MRZ sits at the bottom of the page).
 */
function extractMRZLines(text: string): string[] | null {
  const candidates = mrzCandidateLines(text);
  if (candidates.length < 2) return null;
  return candidates.slice(-2);
}

// ---------------------------------------------------------------------------
// Position-aware OCR-B correction
// ---------------------------------------------------------------------------

/**
 * Common OCR-B confusions, split by the direction of the fix.
 * Applied only at TD3 positions whose character class is fixed by the spec,
 * so we never turn a genuine letter in a name into a digit.
 */
const TO_DIGIT: Record<string, string> = {
  O: "0", Q: "0", D: "0", U: "0",
  I: "1", L: "1", J: "1",
  Z: "2", A: "4", S: "5", G: "6", T: "7", B: "8",
};
const TO_ALPHA: Record<string, string> = {
  "0": "O", "1": "I", "2": "Z", "4": "A", "5": "S", "6": "G", "7": "T", "8": "B",
};

const toDigits = (s: string[], idxs: number[]) => {
  for (const i of idxs) if (s[i]) s[i] = TO_DIGIT[s[i]] ?? s[i];
};
const toAlpha = (s: string[], idxs: number[]) => {
  for (const i of idxs) if (s[i]) s[i] = TO_ALPHA[s[i]] ?? s[i];
};

/**
 * Apply TD3 character-class constraints to a [line1, line2] pair before
 * handing it to the checksum parser. The MRZ spec fixes which columns must be
 * digits (dates, check digits) and which must be letters (issuing state,
 * nationality), so class-correcting those columns fixes the most common
 * OCR-B misreads without ever touching the free-text name columns.
 *
 * TD3 line 2 layout (0-indexed):
 *   0-8 doc number · 9 check · 10-12 nationality · 13-18 DOB · 19 check
 *   20 sex · 21-26 expiry · 27 check · 28-41 personal no · 42 check · 43 composite
 */
function correctTd3(lines: string[]): string[] {
  if (lines.length !== 2) return lines;
  const l1 = lines[0].padEnd(44, "<").substring(0, 44).split("");
  const l2 = lines[1].padEnd(44, "<").substring(0, 44).split("");

  // Line 1: P at col 0, issuing state letters at 2-4
  if (l1[0] && l1[0] !== "P") l1[0] = "P";
  toAlpha(l1, [2, 3, 4]);

  // Line 2: numeric columns (dates + check digits + composite)
  toDigits(l2, [9, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24, 25, 26, 27, 43]);
  // Line 2: nationality letters
  toAlpha(l2, [10, 11, 12]);
  // Line 2: sex must be M / F / <
  if (l2[20] && !"MF<".includes(l2[20])) l2[20] = "<";

  return [l1.join(""), l2.join("")];
}

/**
 * Score a parse result so the best variant wins. A fully-valid MRZ scores
 * highest; otherwise we count individually-valid check digits (document
 * number, DOB, expiry, composite) so partially-readable scans still rank.
 */
function scoreMrz(res: ParseResult): number {
  if (res.valid) return 100;
  let score = 0;
  for (const d of res.details) {
    if (
      d.valid &&
      (d.field === "documentNumberCheckDigit" ||
        d.field === "birthDateCheckDigit" ||
        d.field === "expirationDateCheckDigit" ||
        d.field === "compositeCheckDigit")
    ) {
      score += 1;
    }
  }
  return score;
}

/** Was this specific check-digit field valid in the parse? */
function fieldValid(res: ParseResult, field: string): boolean {
  return res.details.some((d) => d.field === field && d.valid);
}

// ---------------------------------------------------------------------------
// Document-number checksum recovery
// ---------------------------------------------------------------------------

/** ICAO 9303 character value: digits 0-9, A=10..Z=35, '<'=0. */
function charValue(c: string): number {
  if (c >= "0" && c <= "9") return c.charCodeAt(0) - 48;
  if (c >= "A" && c <= "Z") return c.charCodeAt(0) - 55;
  return 0;
}

/** TD3 check digit over a field (weights cycle 7,3,1). */
function td3CheckDigit(s: string): number {
  const w = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum += charValue(s[i]) * w[i % 3];
  return sum % 10;
}

/**
 * Ambiguous OCR-B substitutions used only for document-number recovery.
 * Each char maps to the set of glyphs it is realistically confused with.
 */
const AMBIG: Record<string, string[]> = {
  "0": ["0", "O", "D", "Q"], O: ["O", "0"], D: ["D", "0"], Q: ["Q", "0"],
  "1": ["1", "I", "L"], I: ["I", "1"], L: ["L", "1"],
  "2": ["2", "Z"], Z: ["Z", "2"],
  "5": ["5", "S"], S: ["S", "5"],
  "6": ["6", "G"], G: ["G", "6"],
  "8": ["8", "B"], B: ["B", "8"],
};

/**
 * The document number (TD3 line 2, cols 0-8) is alphanumeric, so neither
 * class-correction nor the mrz library's autocorrect can resolve O↔0 / B↔8
 * style confusions there. We search candidate corrections in order of edit
 * distance (try 1 substitution, then 2, then 3) and accept a fix ONLY when
 * exactly one candidate at the smallest edit distance satisfies the field's
 * check digit (col 9).
 *
 * Searching by edit distance is what makes this reliable: a single mod-10
 * check digit can only pin down a small number of errors, and expanding every
 * glyph at once produces many candidates that pass the digit by coincidence.
 * Trying the fewest corrections first keeps the answer unique when the read is
 * mostly right; when it is too corrupted to disambiguate we leave the line
 * untouched so the (still-invalid) field is dropped downstream — we never
 * invent a passport number.
 */
function recoverDocNumber(line2: string): string {
  if (line2.length < 10) return line2;
  const docRaw = line2.substring(0, 9);
  const checkChar = line2[9];
  if (checkChar < "0" || checkChar > "9") return line2;
  const target = checkChar.charCodeAt(0) - 48;

  if (td3CheckDigit(docRaw) === target) return line2; // already consistent

  const chars = docRaw.split("");
  // Possible corrections per column, excluding the observed glyph itself.
  const alts = chars.map((c) => (AMBIG[c] ?? []).filter((a) => a !== c));
  const editable: number[] = [];
  for (let i = 0; i < 9; i++) if (alts[i].length) editable.push(i);

  const maxEdits = Math.min(3, editable.length);
  for (let k = 1; k <= maxEdits; k++) {
    const matches = new Set<string>();

    // Cartesian product of alternatives across the chosen `picked` columns.
    const product = (picked: number[], pi: number, cur: string[]): void => {
      if (matches.size > 1) return;
      if (pi === picked.length) {
        const cand = cur.join("");
        if (td3CheckDigit(cand) === target) matches.add(cand);
        return;
      }
      const pos = picked[pi];
      for (const a of alts[pos]) {
        const next = cur.slice();
        next[pos] = a;
        product(picked, pi + 1, next);
      }
    };

    // Choose k of the editable columns to correct simultaneously.
    const choose = (start: number, picked: number[]): void => {
      if (matches.size > 1) return;
      if (picked.length === k) {
        product(picked, 0, chars.slice());
        return;
      }
      for (let i = start; i < editable.length; i++) {
        choose(i + 1, [...picked, editable[i]]);
      }
    };
    choose(0, []);

    if (matches.size === 1) {
      const [only] = [...matches];
      return only + line2.substring(9);
    }
    if (matches.size > 1) return line2; // ambiguous at this distance — give up
  }
  return line2;
}

// ---------------------------------------------------------------------------
// Name cleanup
// ---------------------------------------------------------------------------

/**
 * Remove trailing filler misreads from an MRZ name field.
 *
 * Even with a char whitelist, Tesseract occasionally confuses < with C or L.
 * The filler positions at the end of the name show up as words consisting
 * almost entirely of C/L/K runs. We drop them from the right until we reach
 * a word that looks like a real name fragment.
 */
function cleanMrzName(raw: string): string {
  const words = raw
    .replace(/</g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

  while (words.length > 0) {
    const last = words[words.length - 1];
    const isFillerRun =
      // 3+ identical characters in a row (e.g. "LLLLLLL", "CCCCC")
      /(.)\1{2,}/.test(last) ||
      // Short single-letter tokens left over from filler
      (last.length === 1 && words.length > 1);
    if (isFillerRun) {
      words.pop();
    } else {
      break;
    }
  }

  return words.join(" ");
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Convert MRZ date (YYMMDD) → "DD MMM YYYY" */
function formatMRZDate(mrzDate: string, preferFuture = false): string | null {
  if (!mrzDate || mrzDate.length !== 6 || /[^0-9]/.test(mrzDate)) return null;
  const yy = parseInt(mrzDate.slice(0, 2), 10);
  const mm = parseInt(mrzDate.slice(2, 4), 10);
  const dd = parseInt(mrzDate.slice(4, 6), 10);
  if (!mm || mm > 12 || !dd || dd > 31) return null;
  // Expiry/issue dates: 20xx; birth dates: 19xx when yy >= 30
  const fullYear = preferFuture || yy < 30 ? 2000 + yy : 1900 + yy;
  const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  return `${String(dd).padStart(2, "0")} ${months[mm - 1]} ${fullYear}`;
}

/**
 * Extract date of issue from full-page OCR text.
 *
 * Bangladesh passports label it "Date of Issue" (or bilingual label).
 * Indian passports label it "Date of Issue".
 * We accept DD MMM YYYY, DD/MM/YYYY and DD-MM-YYYY variants.
 * We also try a looser scan: look for the word "issue" anywhere on the
 * line followed by a date on the same or the very next line.
 */
function extractDateOfIssue(text: string): string | null {
  // Named-label patterns (most reliable)
  const labelPatterns = [
    // "Date of Issue  30 APR 2023"
    /date\s+of\s+issu\w*[\s:\/]+(\d{1,2}[\s\-\/][A-Za-z]{3}[\s\-\/]\d{4})/i,
    // "Date of Issue  30/04/2023"
    /date\s+of\s+issu\w*[\s:\/]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/i,
    // Abbreviated "Issue : 30 APR 2023"
    /issu\w*\s*[:\-]\s*(\d{1,2}[\s\-\/][A-Za-z]{3}[\s\-\/]\d{4})/i,
    /issu\w*\s*[:\-]\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/i,
  ];

  for (const p of labelPatterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1].trim();
  }

  // Fallback: look for any DD MMM YYYY on a line that contains "issue"
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (/issu/i.test(lines[i])) {
      // Check this line and the next for a date
      const block = (lines[i] + " " + (lines[i + 1] ?? "")).trim();
      const dm = block.match(/\b(\d{1,2}[\s\/\-][A-Za-z]{3}[\s\/\-]\d{4})\b/);
      if (dm?.[1]) return dm[1].trim();
      const dm2 = block.match(/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\b/);
      if (dm2?.[1]) return dm2[1].trim();
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Address extraction + cleanup
// ---------------------------------------------------------------------------

/**
 * Extract and clean the address from full-page OCR text.
 * Keeps only characters that appear in real addresses; strips OCR noise.
 */
function extractAddress(text: string): string | null {
  const patterns = [
    /(?:permanent\s+)?address\s*[:\-]?\s*([^\n]{5,}(?:\n[^\n]{3,}){0,2})/i,
    /place\s+of\s+(?:birth|residence)\s*[:\-]?\s*([^\n]{3,})/i,
    /p\.?\s*o\.?\s*box\s*[:\-]?\s*([^\n]{3,})/i,
  ];

  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) {
      const raw = m[1];

      // Keep only characters that legitimately appear in addresses
      const cleaned = raw
        .replace(/[^A-Za-z0-9\s,.\-\/&#]/g, " ")  // strip OCR noise
        .replace(/\s+/g, " ")
        .trim();

      // Must be at least 5 chars after cleaning to be useful
      if (cleaned.length >= 5) return cleaned.substring(0, 200);
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Nationality map
// ---------------------------------------------------------------------------

const NATIONALITY_MAP: Record<string, string> = {
  BGD: "bangladesh",
  IND: "india",
  PAK: "pakistan",
  MDV: "maldives",
  LKA: "sri lanka",
  NPL: "nepal",
};

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Run the MRZ worker over one crop variant, extract candidate line pairs,
 * apply position-aware correction, and parse with the library's own
 * checksum-guided autocorrection. Returns the best-scoring parse for this
 * crop, or null if no MRZ-shaped lines were found.
 */
async function parseMrzFromCrop(crop: Buffer): Promise<ParseResult | null> {
  const mrzWorker = await getMrzWorker();
  const { data: { text } } = await mrzWorker.recognize(crop);

  const candidates = mrzCandidateLines(text);
  if (candidates.length < 2) return null;

  // Try the last two lines, and (for safety) the last-but-one pairing, since
  // a stray noise line can sometimes be picked up below the real MRZ.
  const pairs: string[][] = [candidates.slice(-2)];
  if (candidates.length >= 3) pairs.push(candidates.slice(-3, -1));

  let best: ParseResult | null = null;
  for (const pair of pairs) {
    const corrected = correctTd3(pair);
    // Recover the alphanumeric document number via its own check digit before
    // parsing — fixes O↔0 / B↔8 confusions the library can't resolve there.
    corrected[1] = recoverDocNumber(corrected[1]);
    try {
      // autocorrect:true lets the library use the check digits themselves to
      // repair single-character OCR errors — a major accuracy win on its own.
      const res = parseMRZ(corrected, { autocorrect: true });
      if (!best || scoreMrz(res) > scoreMrz(best)) best = res;
      if (res.valid) break;
    } catch {
      // ignore malformed pair, try the next
    }
  }
  return best;
}

/**
 * Extract passport data from an uploaded image buffer (fully offline).
 *
 * Pipeline:
 *   1. Build one normalised grayscale base image (auto-rotated)
 *   2. Full-page OCR with the general worker → address, date of issue
 *   3. MRZ pass: generate several upscaled crop/threshold variants, OCR each
 *      with the whitelist worker, position-correct + checksum-autocorrect each,
 *      and keep the highest-scoring parse. Early-exit on a fully-valid MRZ.
 *   4. Per-field trust: use each MRZ field only when its own check digit (or the
 *      whole MRZ) validated, so a bad read is dropped instead of stored wrong.
 */
export async function extractPassportData(
  imageBuffer: Buffer,
  _mimeType?: string
): Promise<ExtractedPassportData> {
  logger.info("Starting OCR extraction (multi-variant Tesseract + MRZ)");

  // Step 1 — normalised grayscale base (reused for every crop)
  const base = await makeGrayBase(imageBuffer);

  // Step 2 — full-page OCR for text fields (address, date of issue)
  const enhanced = await enhanceForOcr(imageBuffer);
  const generalWorker = await getGeneralWorker();
  const { data: { text: fullText } } = await generalWorker.recognize(enhanced);
  logger.info({ chars: fullText.length }, "Full-page OCR complete");

  // Step 3 — MRZ: try each crop variant, keep the best checksum score
  let mrzResult: ParseResult | null = null;
  if (base) {
    for (const variant of MRZ_VARIANTS) {
      const crop = await makeMrzCrop(base, variant.ratio, variant.mode);
      if (!crop) continue;

      const res = await parseMrzFromCrop(crop);
      if (res && (!mrzResult || scoreMrz(res) > scoreMrz(mrzResult))) {
        mrzResult = res;
      }
      if (mrzResult?.valid) {
        logger.info({ variant }, "Fully-valid MRZ found — stopping early");
        break;
      }
    }
  }

  // Last resort: try to read the MRZ off the full-page OCR text
  if (!mrzResult?.valid) {
    const fallbackLines = extractMRZLines(fullText);
    if (fallbackLines) {
      try {
        const corrected = correctTd3(fallbackLines);
        if (corrected.length === 2) corrected[1] = recoverDocNumber(corrected[1]);
        const res = parseMRZ(corrected, { autocorrect: true });
        if (!mrzResult || scoreMrz(res) > scoreMrz(mrzResult)) mrzResult = res;
      } catch {
        /* ignore */
      }
    }
  }

  if (!mrzResult) {
    logger.warn("No MRZ detected in any variant");
  } else {
    logger.info(
      { valid: mrzResult.valid, score: scoreMrz(mrzResult) },
      "Best MRZ parse selected"
    );
  }

  // Step 4 — build result with per-field check-digit trust.
  //
  // We trust a field only when its own check digit validated (or the whole MRZ
  // did). A composite-valid MRZ implies every field is good; otherwise we
  // salvage the individually-valid fields and drop the rest so an operator
  // corrects them rather than the system storing silently-wrong data.
  const res = mrzResult;
  const fields = (res?.fields ?? {}) as Record<string, string | null>;
  const wholeValid = res?.valid === true;

  const trust = (checkField: string): boolean =>
    !!res && (wholeValid || fieldValid(res, checkField));

  // Name/nationality have no dedicated check digit; trust them when the whole
  // MRZ validated or the document-number line (line 2 start) checks out, which
  // strongly correlates with a clean read.
  const nameTrust = wholeValid || (!!res && fieldValid(res, "documentNumberCheckDigit"));

  const lastName  = nameTrust ? cleanMrzName(fields.lastName  ?? "") : "";
  const firstName = nameTrust ? cleanMrzName(fields.firstName ?? "") : "";
  const fullName  =
    lastName && firstName
      ? `${lastName} ${firstName}`.replace(/\s+/g, " ").trim()
      : lastName || firstName || null;

  const rawNat = nameTrust ? (fields.nationality ?? null) : null;
  const nationality = rawNat
    ? (NATIONALITY_MAP[rawNat] ?? rawNat.toLowerCase())
    : null;

  const passportNumber = trust("documentNumberCheckDigit")
    ? (fields.documentNumber?.replace(/</g, "").trim() ?? null)
    : null;
  const dateOfBirth = trust("birthDateCheckDigit") && fields.birthDate
    ? formatMRZDate(fields.birthDate, false)
    : null;
  const dateOfExpiry = trust("expirationDateCheckDigit") && fields.expirationDate
    ? formatMRZDate(fields.expirationDate, true)
    : null;

  return {
    fullName:       fullName || null,
    passportNumber,
    dateOfBirth,
    dateOfExpiry,
    dateOfIssue:    extractDateOfIssue(fullText),
    address:        extractAddress(fullText),
    nationality,
  };
}
