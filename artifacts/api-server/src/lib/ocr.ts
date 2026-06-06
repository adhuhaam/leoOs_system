import OpenAI from "openai";
import { parse as parseMRZ, type ParseResult } from "mrz";
import { logger } from "./logger";

// ---------------------------------------------------------------------------
// OpenAI client
//
// Priority order for credentials:
//   1. OPENAI_API_KEY  — user-provided key, uses OpenAI's own endpoint
//   2. AI_INTEGRATIONS_OPENAI_API_KEY + AI_INTEGRATIONS_OPENAI_BASE_URL
//                      — Replit AI Integrations proxy (no key setup needed)
//
// Set OPENAI_API_KEY in the environment secrets to use your own account.
// ---------------------------------------------------------------------------

const userApiKey = process.env.OPENAI_API_KEY;
const integrationApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const integrationBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

const openai = new OpenAI({
  apiKey: userApiKey ?? integrationApiKey ?? "missing",
  ...(userApiKey ? {} : { baseURL: integrationBaseUrl }),
});

/** Vision model to use. Override with OCR_MODEL env var if needed. */
const OCR_MODEL = process.env.OCR_MODEL ?? "gpt-4o";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ExtractedPassportData {
  fullName: string | null;
  passportNumber: string | null;
  dateOfBirth: string | null;
  dateOfIssue: string | null;
  dateOfExpiry: string | null;
  address: string | null;
  nationality: string | null;
}

// ---------------------------------------------------------------------------
// Nationality map (ICAO 3-letter → display name)
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
// MRZ helpers (used to validate what GPT returned)
// ---------------------------------------------------------------------------

/** Was this specific check-digit field valid in the parse? */
function fieldValid(res: ParseResult, field: string): boolean {
  return res.details.some((d) => d.field === field && d.valid);
}

/**
 * Score a parse by how many check digits validated.
 * Used to pick the best candidate when we have multiple attempts.
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

// ---------------------------------------------------------------------------
// Name + date helpers
// ---------------------------------------------------------------------------

/**
 * Clean an MRZ name field: convert < to spaces and strip trailing filler runs
 * (strings of 3+ identical letters — Tesseract artefacts from blank positions).
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
      /(.)\1{2,}/.test(last) ||
      (last.length === 1 && words.length > 1);
    if (isFillerRun) {
      words.pop();
    } else {
      break;
    }
  }

  return words.join(" ");
}

/** Convert MRZ date (YYMMDD) → "DD MMM YYYY". */
function formatMRZDate(mrzDate: string, preferFuture = false): string | null {
  if (!mrzDate || mrzDate.length !== 6 || /[^0-9]/.test(mrzDate)) return null;
  const yy = parseInt(mrzDate.slice(0, 2), 10);
  const mm = parseInt(mrzDate.slice(2, 4), 10);
  const dd = parseInt(mrzDate.slice(4, 6), 10);
  if (!mm || mm > 12 || !dd || dd > 31) return null;
  const fullYear = preferFuture || yy < 30 ? 2000 + yy : 1900 + yy;
  const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  return `${String(dd).padStart(2, "0")} ${months[mm - 1]} ${fullYear}`;
}

/** Coerce a nullable value to a non-empty trimmed string or null. */
function str(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

// ---------------------------------------------------------------------------
// GPT Vision prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a passport OCR assistant. Extract all visible data from the passport image and return it as a single JSON object with these exact keys (use null for anything not visible or unclear):

{
  "mrz_line1": "First MRZ line, exactly 44 uppercase chars (A-Z, 0-9, <). Example: P<BGDBISWAS<<ANTU<ANTOR<<<<<<<<<<<<<<<<<<",
  "mrz_line2": "Second MRZ line, exactly 44 uppercase chars. Example: A190016636BGD9205103M2502286<<<<<<<<<<<<<<<8",
  "full_name": "Full name as printed on the biographical page (not MRZ format)",
  "date_of_birth": "Date of birth as printed, e.g. 10 May 1992",
  "date_of_issue": "Date of issue as printed, e.g. 01 Mar 2020",
  "date_of_expiry": "Date of expiry as printed, e.g. 28 Feb 2025",
  "nationality": "Nationality as printed (country name), e.g. Bangladeshi",
  "passport_number": "Passport number as printed on the biographical page",
  "address": "Permanent address if visible on the page, otherwise null"
}

Copy the MRZ lines character-for-character from the Machine Readable Zone at the bottom of the passport. Use only A-Z, 0-9, and < — no spaces or other characters.

Return ONLY the JSON object. No markdown, no explanation.`;

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Extract passport data from an image buffer using GPT Vision.
 *
 * The image is sent to GPT-4o which reads every field directly. The raw MRZ
 * lines returned by GPT are then validated with ICAO check digits (via the
 * `mrz` library) so checksum-backed fields are always preferred over GPT's
 * free-text extraction of the same data. Fields not covered by the MRZ
 * (date of issue, address) always come from GPT's direct read.
 */
export async function extractPassportData(
  imageBuffer: Buffer,
  mimeType: string = "image/jpeg",
): Promise<ExtractedPassportData> {
  logger.info({ model: OCR_MODEL }, "Starting GPT Vision OCR extraction");

  const base64 = imageBuffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const response = await openai.chat.completions.create({
    model: OCR_MODEL,
    max_tokens: 600,
    temperature: 0,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: dataUrl, detail: "high" },
          },
          {
            type: "text",
            text: SYSTEM_PROMPT,
          },
        ],
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "";
  logger.info({ rawLength: raw.length }, "GPT Vision response received");

  // Parse GPT JSON response (strip markdown fences if GPT adds them)
  let gpt: Record<string, unknown> = {};
  try {
    const json = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    gpt = JSON.parse(json);
  } catch {
    logger.warn({ raw }, "Failed to parse GPT JSON — using empty fallback");
  }

  // ---------------------------------------------------------------------------
  // MRZ validation: parse and checksum-validate the MRZ lines GPT returned.
  // If the MRZ validates, trust it over GPT's free-text extraction of the
  // same numeric fields (passport number, DOB, expiry).
  // ---------------------------------------------------------------------------

  let mrzResult: ParseResult | null = null;
  const line1 = str(gpt.mrz_line1);
  const line2 = str(gpt.mrz_line2);

  if (line1 && line2) {
    try {
      // autocorrect: the library uses the check digits to fix single-char errors
      const res = parseMRZ([line1, line2], { autocorrect: true });
      mrzResult = res;
      logger.info(
        { valid: res.valid, score: scoreMrz(res) },
        "MRZ checksum validation result"
      );
    } catch (err) {
      logger.warn({ err }, "MRZ parse threw — falling back to GPT direct fields");
    }
  }

  const res = mrzResult;
  const mrzFields = (res?.fields ?? {}) as Record<string, string | null>;
  const wholeValid = res?.valid === true;

  const trust = (checkField: string): boolean =>
    !!res && (wholeValid || fieldValid(res, checkField));

  // Name and nationality have no dedicated check digit in the MRZ.
  // Trust them from MRZ when the document number (which validates) checks out,
  // which strongly correlates with a clean read. Otherwise use GPT's direct read.
  const nameTrust = wholeValid || (!!res && fieldValid(res, "documentNumberCheckDigit"));

  // ---------------------------------------------------------------------------
  // Build final result: MRZ-validated fields preferred; GPT direct-read as fallback
  // ---------------------------------------------------------------------------

  // Full name: GPT's direct read of the biographical page is more natural.
  // Fall back to MRZ-derived name if GPT didn't return one.
  const fullName: string | null =
    str(gpt.full_name) ??
    (nameTrust
      ? ([cleanMrzName(mrzFields.lastName ?? ""), cleanMrzName(mrzFields.firstName ?? "")]
          .filter(Boolean)
          .join(" ") || null)
      : null);

  // Passport number: MRZ checksum-validated wins; GPT direct read as fallback.
  const passportNumber: string | null =
    (trust("documentNumberCheckDigit") && mrzFields.documentNumber
      ? mrzFields.documentNumber.replace(/</g, "").trim() || null
      : null) ??
    str(gpt.passport_number);

  // Date of birth: MRZ (YYMMDD → formatted) or GPT's printed date.
  const dateOfBirth: string | null =
    (trust("birthDateCheckDigit") && mrzFields.birthDate
      ? formatMRZDate(mrzFields.birthDate, false)
      : null) ??
    str(gpt.date_of_birth);

  // Date of expiry: MRZ (YYMMDD → formatted) or GPT's printed date.
  const dateOfExpiry: string | null =
    (trust("expirationDateCheckDigit") && mrzFields.expirationDate
      ? formatMRZDate(mrzFields.expirationDate, true)
      : null) ??
    str(gpt.date_of_expiry);

  // Nationality: MRZ 3-letter code mapped to display name, or GPT's text.
  let nationality: string | null = null;
  if (nameTrust && mrzFields.nationality) {
    nationality = NATIONALITY_MAP[mrzFields.nationality] ?? mrzFields.nationality.toLowerCase();
  } else {
    const gptNat = str(gpt.nationality);
    if (gptNat) {
      // Normalise GPT's free-text nationality to a lowercase country name
      const lower = gptNat.toLowerCase().replace(/[^a-z\s]/g, "").trim();
      nationality = lower || null;
    }
  }

  // Date of issue and address: not in the MRZ, always from GPT's direct read.
  const dateOfIssue: string | null = str(gpt.date_of_issue);
  const address: string | null = str(gpt.address)?.substring(0, 200) ?? null;

  logger.info(
    { fullName, passportNumber, nationality, mrzValid: wholeValid },
    "GPT Vision OCR extraction complete"
  );

  return {
    fullName,
    passportNumber,
    dateOfBirth,
    dateOfIssue,
    dateOfExpiry,
    address,
    nationality,
  };
}
