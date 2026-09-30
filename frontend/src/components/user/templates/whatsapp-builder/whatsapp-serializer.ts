import {
  WhatsAppTemplateData,
  WhatsAppHeader,
  WhatsAppHeaderType,
  WhatsAppButton,
  WhatsAppButtonType,
  WhatsAppCategory,
} from "./whatsapp-types";

export const DEFAULT_WHATSAPP_TEMPLATE: WhatsAppTemplateData = {
  name: "",
  category: "MARKETING",
  language: "en_US",
  header: {
    type: "NONE",
    text: "",
    mediaUrl: "",
    mediaName: "",
  },
  body: "",
  footer: "",
  buttons: [],
};

/**
 * Normalizes any button representation from various formats into a canonical WhatsAppButton.
 */
export function normalizeButton(raw: any, index: number): WhatsAppButton | null {
  if (!raw || typeof raw !== "object") return null;

  const rawType = String(raw.type || raw.button_type || "").toUpperCase().trim();
  let type: WhatsAppButtonType = "URL";

  if (rawType.includes("PHONE") || rawType.includes("CALL")) {
    type = "PHONE_NUMBER";
  } else if (rawType.includes("COUPON") || rawType.includes("OFFER")) {
    type = "COUPON_CODE";
  } else if (rawType.includes("DEMO") || rawType.includes("BOOK")) {
    type = "BOOK_DEMO";
  } else if (rawType.includes("QUICK") || rawType.includes("REPLY")) {
    type = "QUICK_REPLY";
  } else {
    type = "URL";
  }

  const text = String(raw.text || raw.label || raw.title || raw.name || "").trim();
  if (!text) return null;

  const url = raw.url || raw.website_url || raw.websiteUrl || raw.target_url || raw.link || "";
  const phoneNumber = raw.phoneNumber || raw.phone_number || raw.phone || raw.number || "";
  const couponCode = raw.couponCode || raw.coupon_code || raw.code || "";

  return {
    id: String(raw.id || `btn_${Date.now()}_${index}`),
    type,
    text,
    url: String(url).trim() || undefined,
    phoneNumber: String(phoneNumber).trim() || undefined,
    couponCode: String(couponCode).trim() || undefined,
  };
}

/**
 * Serializes the full structured WhatsApp template metadata into JSON string for persistence in `subject`.
 */
export function serializeWhatsAppMetadata(data: WhatsAppTemplateData): string {
  const metadata = {
    version: 1,
    channel: "WHATSAPP",
    category: data.category || "MARKETING",
    language: data.language || "en_US",
    header: data.header || { type: "NONE" },
    body: data.body || "",
    footer: data.footer || "",
    buttons: data.buttons || [],
  };
  return JSON.stringify(metadata);
}

/**
 * Compiles a structured WhatsApp template into a human-readable and delivery-compatible WhatsApp message string.
 * This is stored in `template.body` for campaigns, automations, and Meta Graph API submission.
 */
export function compileWhatsAppMessage(data: WhatsAppTemplateData): string {
  const parts: string[] = [];

  // 1. Header
  if (data.header && data.header.type !== "NONE") {
    if (data.header.type === "TEXT" && data.header.text?.trim()) {
      parts.push(`*${data.header.text.trim()}*`);
    } else if (data.header.mediaUrl?.trim()) {
      parts.push(`[${data.header.type}: ${data.header.mediaUrl.trim()}]`);
    }
  }

  // 2. Body
  if (data.body?.trim()) {
    parts.push(data.body.trim());
  }

  // 3. Footer
  if (data.footer?.trim()) {
    parts.push(`_${data.footer.trim()}_`);
  }

  // 4. Buttons
  if (data.buttons && data.buttons.length > 0) {
    const buttonLines: string[] = [];
    data.buttons.forEach((btn) => {
      if (!btn.text?.trim()) return;
      const type = (btn.type || "URL").toUpperCase();
      switch (type) {
        case "COUPON_CODE":
          buttonLines.push(`🏷️ ${btn.text.trim()}${btn.couponCode ? ` [Code: ${btn.couponCode.trim()}]` : ""}`);
          break;
        case "URL":
        case "BOOK_DEMO":
          buttonLines.push(`👉 ${btn.text.trim()}${btn.url ? `: ${btn.url.trim()}` : ""}`);
          break;
        case "PHONE_NUMBER":
          buttonLines.push(`📞 ${btn.text.trim()}${btn.phoneNumber ? `: ${btn.phoneNumber.trim()}` : ""}`);
          break;
        case "QUICK_REPLY":
          buttonLines.push(`🔘 ${btn.text.trim()}`);
          break;
      }
    });

    if (buttonLines.length > 0) {
      parts.push(`--------------------\n${buttonLines.join("\n")}`);
    }
  }

  return parts.join("\n\n");
}

/**
 * Strips HTML tags and unescapes common HTML entities while preserving linebreaks.
 */
export function cleanHtmlText(text: string): string {
  if (!text) return "";
  let cleaned = text;
  if (cleaned.includes("<") || cleaned.includes("&")) {
    cleaned = cleaned
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  }
  return cleaned.trim();
}

/**
 * Extracts header media, buttons, footer, and clean body from a compiled WhatsApp message text.
 */
export function extractFromCompiledBody(rawBodyText: string): {
  header: WhatsAppHeader;
  cleanBody: string;
  footer: string;
  buttons: WhatsAppButton[];
} {
  let text = cleanHtmlText(rawBodyText || "");
  let header: WhatsAppHeader = { type: "NONE" };
  let footer = "";
  const buttons: WhatsAppButton[] = [];

  // 1. Check for media header tag at top: [IMAGE: ...], [VIDEO: ...], [DOCUMENT: ...]
  const imageMatch = text.match(/^\[IMAGE:\s*([^\s\]]+)\]/i);
  const videoMatch = text.match(/^\[VIDEO:\s*([^\s\]]+)\]/i);
  const docMatch = text.match(/^\[DOCUMENT:\s*([^\s\]]+)\]/i);

  if (imageMatch) {
    header = {
      type: "IMAGE",
      mediaUrl: imageMatch[1].trim(),
      mediaName: "Header Image",
    };
    text = text.substring(imageMatch[0].length).trim();
  } else if (videoMatch) {
    header = {
      type: "VIDEO",
      mediaUrl: videoMatch[1].trim(),
      mediaName: "Header Video",
    };
    text = text.substring(videoMatch[0].length).trim();
  } else if (docMatch) {
    header = {
      type: "DOCUMENT",
      mediaUrl: docMatch[1].trim(),
      mediaName: "Header Document",
    };
    text = text.substring(docMatch[0].length).trim();
  } else {
    // Check for bold text header: *Header Text* on first line
    const textHeaderMatch = text.match(/^\*([^\*\n]+)\*\s*(?:\n+|$)/);
    if (textHeaderMatch) {
      header = {
        type: "TEXT",
        text: textHeaderMatch[1].trim(),
      };
      text = text.substring(textHeaderMatch[0].length).trim();
    }
  }

  // 2. Check for button divider: --------------------
  const dividerMatch = text.match(/\r?\n\s*-{3,}\s*(?:\r?\n|$)([\s\S]*)$/);
  if (dividerMatch && dividerMatch.index !== undefined) {
    const buttonBlock = dividerMatch[1].trim();
    text = text.substring(0, dividerMatch.index).trim();

    const lines = buttonBlock.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    lines.forEach((line, index) => {
      // 1. Coupon Match
      const couponMatch = line.match(/^(?:🏷️|🎟️)?\s*([^\[]+?)(?:\s*\[Code:\s*([^\]]+)\])?$/i);
      if (couponMatch && (couponMatch[2] || /coupon|offer|discount|code/i.test(couponMatch[1]) || /🏷️|🎟️/.test(line))) {
        const label = couponMatch[1].trim();
        const code = couponMatch[2]?.trim() || "";
        buttons.push({
          id: `btn_extracted_${Date.now()}_${index}`,
          type: "COUPON_CODE",
          text: label,
          couponCode: code || undefined,
        });
        return;
      }

      // 2. Phone Call Match
      const phoneMatch = line.match(/^(?:📞|☎️)?\s*([^:]+?)(?::\s*([+\d\s\(\)-]{5,}))?$/);
      if (phoneMatch && (phoneMatch[2] || /call|phone|tel|dial/i.test(phoneMatch[1]) || /📞|☎️/.test(line))) {
        const label = phoneMatch[1].trim();
        const phone = phoneMatch[2]?.trim() || "";
        buttons.push({
          id: `btn_extracted_${Date.now()}_${index}`,
          type: "PHONE_NUMBER",
          text: label,
          phoneNumber: phone || undefined,
        });
        return;
      }

      // 3. URL / Book Demo Match
      const urlMatch = line.match(/^(?:👉|🔗)?\s*([^:]+?)(?::\s*(.+))?$/);
      if (urlMatch) {
        const label = urlMatch[1].trim();
        const url = urlMatch[2]?.trim() || "";
        const isDemo = /demo/i.test(label);
        buttons.push({
          id: `btn_extracted_${Date.now()}_${index}`,
          type: isDemo ? "BOOK_DEMO" : "URL",
          text: label,
          url: url || undefined,
        });
        return;
      }

      // 4. Quick Reply
      const qrMatch = line.match(/^(?:🔘|•)?\s*(.+)$/);
      if (qrMatch) {
        buttons.push({
          id: `btn_extracted_${Date.now()}_${index}`,
          type: "QUICK_REPLY",
          text: qrMatch[1].trim(),
        });
        return;
      }
    });
  }

  // 3. Check for footer: _Footer Text_ at end of text
  const footerMatch = text.match(/\r?\n\s*_([^_]+)_\s*$/);
  if (footerMatch && footerMatch.index !== undefined) {
    footer = footerMatch[1].trim();
    text = text.substring(0, footerMatch.index).trim();
  }

  return {
    header,
    cleanBody: text,
    footer,
    buttons,
  };
}

/**
 * Parses existing template data from backend.
 * Checks `subject` first for serialized JSON metadata.
 * If not present or incomplete, falls back intelligently to parsing `body` text.
 */
export function parseWhatsAppTemplate(
  rawSubject?: string | null,
  rawBody?: string | null
): WhatsAppTemplateData {
  if (rawSubject && rawSubject.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(rawSubject.trim());
      if (parsed && typeof parsed === "object") {
        // 1. Header
        let header: WhatsAppHeader = { type: "NONE" };
        if (parsed.header && typeof parsed.header === "object") {
          const rawType = String(parsed.header.type || "NONE").toUpperCase() as WhatsAppHeaderType;
          let mediaUrl = parsed.header.mediaUrl ? String(parsed.header.mediaUrl).trim() : "";
          const imgMatch = mediaUrl.match(/^\[(?:IMAGE|VIDEO|DOCUMENT):\s*([^\s\]]+)\]/i);
          if (imgMatch) mediaUrl = imgMatch[1].trim();

          header = {
            type: ["NONE", "TEXT", "IMAGE", "VIDEO", "DOCUMENT"].includes(rawType) ? rawType : "NONE",
            text: parsed.header.text ? cleanHtmlText(parsed.header.text) : "",
            mediaUrl,
            mediaName: parsed.header.mediaName ? String(parsed.header.mediaName).trim() : "",
          };
        }

        // 2. Body
        let body = typeof parsed.body === "string" && parsed.body.trim()
          ? cleanHtmlText(parsed.body)
          : "";

        // If body in JSON mistakenly contains compiled syntax like [IMAGE:] or divider, clean it
        if (body && (body.includes("[IMAGE:") || body.includes("[VIDEO:") || body.includes("[DOCUMENT:") || /\r?\n\s*-{3,}\s*\r?\n/.test(body))) {
          const sanitized = extractFromCompiledBody(body);
          body = sanitized.cleanBody;
          if (header.type === "NONE" && sanitized.header.type !== "NONE") {
            header = sanitized.header;
          }
          if (sanitized.footer) {
            parsed.footer = sanitized.footer;
          }
          if ((!parsed.buttons || parsed.buttons.length === 0) && sanitized.buttons.length > 0) {
            parsed.buttons = sanitized.buttons;
          }
        }

        // 3. Footer
        let footer = typeof parsed.footer === "string" ? cleanHtmlText(parsed.footer) : "";

        // 4. Buttons
        let buttons: WhatsAppButton[] = [];
        if (Array.isArray(parsed.buttons) && parsed.buttons.length > 0) {
          buttons = (parsed.buttons as unknown[])
            .map((b: unknown, i: number) => normalizeButton(b, i))
            .filter((b: WhatsAppButton | null): b is WhatsAppButton => b !== null);
        }

        // If body, buttons, or media are missing or incomplete from JSON, inspect rawBody
        if (rawBody && rawBody.trim()) {
          const extracted = extractFromCompiledBody(rawBody);
          if (!body) {
            body = extracted.cleanBody;
          }
          if (header.type === "NONE" && extracted.header.type !== "NONE") {
            header = extracted.header;
          } else if (header.type !== "NONE" && !header.mediaUrl && extracted.header.mediaUrl) {
            header.mediaUrl = extracted.header.mediaUrl;
            if (!header.mediaName && extracted.header.mediaName) {
              header.mediaName = extracted.header.mediaName;
            }
          }
          if (!footer && extracted.footer) {
            footer = extracted.footer;
          }
          if (buttons.length === 0 && extracted.buttons.length > 0) {
            buttons = extracted.buttons;
          }
        }

        return {
          name: typeof parsed.name === "string" ? parsed.name : "",
          category: (parsed.category as WhatsAppCategory) || "MARKETING",
          language: parsed.language || "en_US",
          header,
          body,
          footer,
          buttons,
        };
      }
    } catch {
      // Fall through to rawBody fallback below
    }
  }

  // Legacy or unformatted template: parse plain body, extracting embedded headers, buttons, and footers
  if (rawBody && rawBody.trim()) {
    const extracted = extractFromCompiledBody(rawBody);
    return {
      name: "",
      category: "MARKETING",
      language: "en_US",
      header: extracted.header,
      body: extracted.cleanBody,
      footer: extracted.footer,
      buttons: extracted.buttons,
    };
  }

  return {
    ...DEFAULT_WHATSAPP_TEMPLATE,
  };
}

/**
 * Replaces personalization variable tags like {{first_name}} with realistic mock data for preview rendering
 * when requested, but leaves unchanged if variable interpolation is not needed.
 */
export function interpolateVariables(text: string): string {
  if (!text) return "";
  return text
    .replace(/\{\{\s*first_name\s*\}\}/gi, "Alex")
    .replace(/\{\{\s*last_name\s*\}\}/gi, "Morgan")
    .replace(/\{\{\s*name\s*\}\}/gi, "Alex Morgan")
    .replace(/\{\{\s*email\s*\}\}/gi, "alex@example.com")
    .replace(/\{\{\s*phone\s*\}\}/gi, "+1 555-0199")
    .replace(/\{\{\s*company\s*\}\}/gi, "Acme Corp")
    .replace(/\{\{\s*city\s*\}\}/gi, "San Francisco");
}

/**
 * Renders WhatsApp markdown into safe HTML for display in the simulated chat preview.
 * Supports:
 * - *bold*
 * - _italic_
 * - ~strikethrough~
 * - ```monospace```
 * - \n to <br>
 */
export function renderFormattedWhatsAppText(text: string): { __html: string } {
  if (!text) return { __html: "" };

  // Escape HTML characters
  let escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Monospace ```code```
  escaped = escaped.replace(/```([\s\S]*?)```/g, "<code class='bg-slate-100 px-1 py-0.5 rounded font-mono text-[11px]'>$1</code>");

  // *bold*
  escaped = escaped.replace(/\*([^\*\n]+)\*/g, "<strong>$1</strong>");

  // _italic_
  escaped = escaped.replace(/_([^_\n]+)_/g, "<em>$1</em>");

  // ~strikethrough~
  escaped = escaped.replace(/~([^~\n]+)~/g, "<del>$1</del>");

  // Line breaks
  escaped = escaped.replace(/\n/g, "<br />");

  return { __html: escaped };
}
