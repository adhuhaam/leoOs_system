import { createWorker, PSM } from "tesseract.js";
import { parse as parseMRZ } from "mrz";
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
 * Enhance the image for better OCR accuracy:
 * grayscale → normalise (stretch contrast) → mild sharpening.
 */
async function enhanceForOcr(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .grayscale()
    .normalise()
    .sharpen({ sigma: 1.5 })
    .toBuffer();
}

/**
 * Crop the bottom 28% of the image and binarise (black/white threshold).
 * Passport MRZ sits in roughly the bottom 15–20% of the page, so 28% gives
 * plenty of margin for phone photos where the page doesn't fill the frame.
 */
async function cropMrzRegion(buffer: Buffer): Promise<Buffer | null> {
  try {
    const meta = await sharp(buffer).metadata();
    const h = meta.height ?? 0;
    const w = meta.width ?? 0;
    if (h < 100 || w < 100) return null;

    const cropTop = Math.floor(h * 0.72);
    const cropHeight = h - cropTop;

    return sharp(buffer)
      .extract({ left: 0, top: cropTop, width: w, height: cropHeight })
      .threshold(140)   // binarise — makes OCR-B font crisper
      .toBuffer();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// MRZ line extraction
// ---------------------------------------------------------------------------

/**
 * Extract the two TD3 MRZ lines (44 chars each) from raw Tesseract output.
 *
 * When the MRZ worker is used (char whitelist A-Z0-9<) Tesseract can only
 * output valid characters, so < is no longer misread as C/L/K.
 */
function extractMRZLines(text: string): string[] | null {
  const candidates = text
    .split("\n")
    .map((l) =>
      l
        .replace(/\s+/g, "")
        .replace(/[«|]/g, "<")
        .replace(/[^A-Z0-9<]/gi, "")  // strip any remaining non-MRZ chars
        .toUpperCase()
    )
    .filter((l) => l.length >= 38 && l.length <= 48 && /^[A-Z0-9<]+$/.test(l));

  if (candidates.length < 2) return null;

  // Normalise to exactly 44 characters (TD3 format)
  const normalized = candidates.map((l) =>
    l.length === 44 ? l : l.padEnd(44, "<").substring(0, 44)
  );

  // MRZ is at the bottom of the page — take the last two candidates
  return normalized.slice(-2);
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
 * Extract passport data from a preprocessed image buffer.
 *
 * Pipeline:
 *   1. Enhance image (grayscale + normalise + sharpen)
 *   2. Full-image OCR with general worker → address, date of issue
 *   3. Crop bottom 28% + binarise → MRZ-only OCR with char whitelist
 *      (prevents '<' being misread as C/L/K)
 *   4. Parse MRZ with checksum validation → name, number, nationality, DOB, expiry
 *   5. Clean name, clean address, extract issue date
 */
export async function extractPassportData(
  imageBuffer: Buffer,
  _mimeType?: string
): Promise<ExtractedPassportData> {
  logger.info("Starting OCR extraction (two-pass Tesseract + MRZ)");

  // Step 1 — enhance
  const enhanced = await enhanceForOcr(imageBuffer);

  // Step 2 — full-page OCR for text fields
  const generalWorker = await getGeneralWorker();
  const { data: { text: fullText } } = await generalWorker.recognize(enhanced);
  logger.info({ chars: fullText.length }, "Full-page OCR complete");

  // Step 3 — targeted MRZ OCR on the bottom strip
  const mrzCrop = await cropMrzRegion(enhanced);
  let mrzText = "";

  if (mrzCrop) {
    const mrzWorker = await getMrzWorker();
    const { data: { text } } = await mrzWorker.recognize(mrzCrop);
    mrzText = text;
    logger.info({ chars: mrzText.length }, "MRZ strip OCR complete");
  } else {
    logger.warn("Could not crop MRZ region — falling back to full-page text");
    mrzText = fullText;
  }

  // Step 4 — find and parse MRZ lines
  // Prefer lines from the targeted MRZ pass; fall back to full-page
  const mrzLines =
    extractMRZLines(mrzText) ??
    extractMRZLines(fullText);

  let mrzResult: ReturnType<typeof parseMRZ> | null = null;

  if (mrzLines) {
    try {
      mrzResult = parseMRZ(mrzLines);
      logger.info({ valid: mrzResult.valid, lines: mrzLines }, "MRZ parsed");
    } catch (err) {
      logger.warn({ err }, "MRZ parse failed — using text heuristics only");
    }
  } else {
    logger.warn("No MRZ lines detected");
  }

  // Step 5 — build result
  //
  // MRZ-derived fields (name, passport number, DOB, expiry, nationality) are
  // ONLY used when the checksum validates (mrzResult.valid === true). An
  // invalid parse means one or more fields failed the Luhn-style check digit —
  // using those values would silently store wrong data. We fall back to null
  // so the operator can correct the record manually rather than trust bad data.
  const validMrz = mrzResult?.valid === true;
  const f = validMrz
    ? (mrzResult!.fields as Record<string, string | null>)
    : undefined;

  if (!validMrz) {
    logger.warn({ valid: mrzResult?.valid }, "MRZ checksum failed — MRZ-derived fields set to null");
  }

  const lastName  = cleanMrzName(f?.lastName  ?? "");
  const firstName = cleanMrzName(f?.firstName ?? "");
  const fullName  =
    lastName && firstName
      ? `${lastName} ${firstName}`.replace(/\s+/g, " ").trim()
      : lastName || firstName || null;

  const rawNat = f?.nationality ?? null;
  const nationality = rawNat
    ? (NATIONALITY_MAP[rawNat] ?? rawNat.toLowerCase())
    : null;

  return {
    fullName:       fullName || null,
    passportNumber: f?.documentNumber?.replace(/</g, "").trim() ?? null,
    dateOfBirth:    f?.birthDate      ? formatMRZDate(f.birthDate, false)     : null,
    dateOfExpiry:   f?.expirationDate ? formatMRZDate(f.expirationDate, true) : null,
    dateOfIssue:    extractDateOfIssue(fullText),
    address:        extractAddress(fullText),
    nationality,
  };
}
