import { SmsEncodingInfo } from "./sms-types";

/**
 * Standard GSM 03.38 Basic Character Set
 */
const GSM_BASIC_CHARS =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";

/**
 * GSM 03.38 Extended Character Set (counts as 2 characters due to ESC 0x1B prefix)
 * ^ { } \ [ ~ ] | €
 */
const GSM_EXTENDED_CHARS = "^{}\\[~]|€";

/**
 * Sample variable data mapping for live customer preview
 */
export const SAMPLE_VARIABLE_DATA: Record<string, string> = {
  first_name: "Alex",
  last_name: "Morgan",
  name: "Alex Morgan",
  email: "alex@example.com",
  phone: "+1 555-0199",
  company: "Acme Corp",
  city: "San Francisco",
};

/**
 * Checks if a single character is in the GSM 7-bit basic set.
 */
export function isGsmBasicChar(char: string): boolean {
  return GSM_BASIC_CHARS.includes(char);
}

/**
 * Checks if a single character is in the GSM 7-bit extended set.
 */
export function isGsmExtendedChar(char: string): boolean {
  return GSM_EXTENDED_CHARS.includes(char);
}

/**
 * Analyzes the SMS message body to calculate encoding, character count,
 * segment count, and non-GSM characters.
 */
export function analyzeSmsText(text: string): SmsEncodingInfo {
  if (!text) {
    return {
      encoding: "GSM-7",
      charCount: 0,
      gsmLength: 0,
      segments: 0,
      maxCharsPerSegment: 160,
      charsRemainingInSegment: 160,
      hasUnicode: false,
      unicodeChars: [],
    };
  }

  // Count code units and check for non-GSM characters
  const unicodeCharSet = new Set<string>();
  let gsmLength = 0;
  let hasUnicode = false;

  // Iterate by code points to handle emojis and surrogate pairs properly
  for (const char of text) {
    if (isGsmBasicChar(char)) {
      gsmLength += 1;
    } else if (isGsmExtendedChar(char)) {
      gsmLength += 2; // Extended GSM character counts as 2
    } else {
      hasUnicode = true;
      unicodeCharSet.add(char);
    }
  }

  const unicodeChars = Array.from(unicodeCharSet);
  const charCount = text.length; // JS length / UTF-16 code units used by carriers

  if (hasUnicode) {
    // UCS-2 (Unicode) encoding: Single message <= 70 chars. Multi-part <= 67 chars/segment
    const maxSingle = 70;
    const maxMulti = 67;
    const segments = charCount <= maxSingle ? (charCount === 0 ? 0 : 1) : Math.ceil(charCount / maxMulti);
    const maxCharsPerSegment = segments <= 1 ? maxSingle : maxMulti;
    const charsRemainingInSegment =
      segments <= 1
        ? maxSingle - charCount
        : maxMulti - (charCount % maxMulti === 0 ? 0 : charCount % maxMulti);

    return {
      encoding: "UCS-2",
      charCount,
      gsmLength: charCount,
      segments,
      maxCharsPerSegment,
      charsRemainingInSegment: Math.max(0, charsRemainingInSegment),
      hasUnicode: true,
      unicodeChars,
    };
  }

  // GSM-7 encoding: Single message <= 160 chars. Multi-part <= 153 chars/segment
  const maxSingle = 160;
  const maxMulti = 153;
  const segments = gsmLength <= maxSingle ? (gsmLength === 0 ? 0 : 1) : Math.ceil(gsmLength / maxMulti);
  const maxCharsPerSegment = segments <= 1 ? maxSingle : maxMulti;
  const charsRemainingInSegment =
    segments <= 1
      ? maxSingle - gsmLength
      : maxMulti - (gsmLength % maxMulti === 0 ? 0 : gsmLength % maxMulti);

  return {
    encoding: "GSM-7",
    charCount,
    gsmLength,
    segments,
    maxCharsPerSegment,
    charsRemainingInSegment: Math.max(0, charsRemainingInSegment),
    hasUnicode: false,
    unicodeChars: [],
  };
}

/**
 * Replaces variables in template text with sample preview values.
 */
export function renderSmsPreviewText(
  body: string,
  useSampleData: boolean = true,
  customSamples?: Record<string, string>
): string {
  if (!body) return "";
  if (!useSampleData) return body;

  const samples: Record<string, string> = { ...SAMPLE_VARIABLE_DATA };
  if (customSamples) {
    for (const [k, v] of Object.entries(customSamples)) {
      if (v !== undefined && v !== "") {
        samples[k.toLowerCase()] = v;
      }
    }
  }

  return body.replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (match, varName) => {
    const key = varName.toLowerCase();
    if (key in samples && samples[key] !== undefined && samples[key] !== "") {
      return samples[key];
    }
    // Fallback: capitalize the variable name as placeholder sample
    return key
      .split("_")
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  });
}

/**
 * Regex to find URLs in text for link highlighting
 */
export const URL_REGEX = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/gi;

/**
 * Splits text into segments of plain text and clickable URL matches.
 */
export function splitTextWithUrls(text: string): Array<{ text: string; isUrl: boolean }> {
  if (!text) return [];

  const parts: Array<{ text: string; isUrl: boolean }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(URL_REGEX);

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        text: text.substring(lastIndex, match.index),
        isUrl: false,
      });
    }
    parts.push({
      text: match[0],
      isUrl: true,
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({
      text: text.substring(lastIndex),
      isUrl: false,
    });
  }

  return parts;
}
