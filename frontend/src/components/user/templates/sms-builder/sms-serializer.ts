import {
  SmsTemplateData,
  SmsCategory,
  SmsCta,
  SmsCtaType,
  SmsButton,
  SmsButtonType,
  SmsHeaderType,
  DEFAULT_SMS_TEMPLATE,
  SMS_CATEGORIES,
} from "./sms-types";

/**
 * Compiles a structured SMS template into a clean, carrier-deliverable text message.
 * Formats content in the strict display order:
 * 1. Optional Header
 * 2. Main Message Body
 * 3. Optional Footer
 * 4. Supported Call-to-Action (link, phone dialer, or keyword)
 */
export function compileSmsMessage(data: SmsTemplateData): string {
  const parts: string[] = [];

  // 1. Optional Header / Media Link
  if (data.headerType === "TEXT" && data.header && data.header.trim()) {
    parts.push(data.header.trim());
  } else if (
    data.headerType &&
    ["IMAGE", "VIDEO", "DOCUMENT"].includes(data.headerType) &&
    data.mediaUrl &&
    data.mediaUrl.trim()
  ) {
    parts.push(data.mediaUrl.trim());
  } else if (!data.headerType && data.header && data.header.trim()) {
    parts.push(data.header.trim());
  }

  // 2. Main Message Body
  if (data.body && data.body.trim()) {
    parts.push(data.body.trim());
  }

  // 3. Optional Footer
  if (data.footer && data.footer.trim()) {
    parts.push(data.footer.trim());
  }

  // 4. Optional Call-to-Action / Buttons
  if (data.cta && data.cta.enabled && data.cta.value && data.cta.value.trim()) {
    const val = data.cta.value.trim();
    const lbl = (data.cta.label || "").trim();
    let ctaLine = "";

    switch (data.cta.type) {
      case "URL":
        ctaLine = lbl ? `${lbl}: ${val}` : val;
        break;
      case "PHONE":
        ctaLine = lbl ? `${lbl}: ${val}` : `Call: ${val}`;
        break;
      case "REPLY_KEYWORD":
        ctaLine = lbl ? `${lbl}: ${val}` : `Reply ${val}`;
        break;
      default:
        ctaLine = lbl ? `${lbl}: ${val}` : val;
        break;
    }

    if (ctaLine) {
      parts.push(ctaLine);
    }
  } else if (data.buttons && data.buttons.length > 0) {
    const buttonLines: string[] = [];
    for (const btn of data.buttons) {
      const text = (btn.text || "").trim();
      switch (btn.type) {
        case "URL":
        case "BOOK_DEMO": {
          const url = (btn.url || "").trim();
          if (url) {
            buttonLines.push(text ? `${text}: ${url}` : url);
          }
          break;
        }
        case "PHONE_NUMBER": {
          const phone = (btn.phoneNumber || "").trim();
          if (phone) {
            buttonLines.push(text ? `${text}: ${phone}` : `Call: ${phone}`);
          }
          break;
        }
        case "COUPON_CODE": {
          const code = (btn.couponCode || "").trim();
          if (code) {
            buttonLines.push(text ? `${text}: ${code}` : `Use code ${code}`);
          }
          break;
        }
        case "QUICK_REPLY": {
          if (text) {
            buttonLines.push(`Reply "${text}"`);
          }
          break;
        }
      }
    }
    if (buttonLines.length > 0) {
      parts.push(buttonLines.join("\n"));
    }
  }

  return parts.join("\n\n");
}

/**
 * Serializes SMS template metadata into the subject field.
 * This preserves clean metadata (header, media, footer, cta, category) without altering backend database schemas.
 */
export function serializeSmsMetadata(data: SmsTemplateData): string {
  const meta: Record<string, any> = {
    version: 1,
    channel: "SMS",
    category: data.category || "PROMOTIONAL",
    description: (data.description || "").trim(),
    header: (data.header || "").trim(),
    headerType: data.headerType || (data.header?.trim() ? "TEXT" : "NONE"),
    mediaUrl: (data.mediaUrl || "").trim(),
    mediaName: (data.mediaName || "").trim(),
    body: (data.body || "").trim(),
    footer: (data.footer || "").trim(),
  };

  if (data.buttons && data.buttons.length > 0) {
    meta.buttons = data.buttons;
    // Map first button to cta for backwards compatibility with legacy consumers
    const first = data.buttons[0];
    const ctaType: SmsCtaType =
      first.type === "PHONE_NUMBER"
        ? "PHONE"
        : first.type === "QUICK_REPLY"
        ? "REPLY_KEYWORD"
        : "URL";
    meta.cta = {
      enabled: true,
      type: ctaType,
      label: first.text || "",
      value: first.url || first.phoneNumber || first.couponCode || first.text || "",
    };
  } else if (data.cta && data.cta.enabled && data.cta.value && data.cta.value.trim()) {
    meta.cta = {
      enabled: true,
      type: data.cta.type || "URL",
      label: (data.cta.label || "").trim(),
      value: data.cta.value.trim(),
    };
  }

  return JSON.stringify(meta);
}

/**
 * Validates whether a category string is a known SmsCategory.
 */
function isValidSmsCategory(val: string): val is SmsCategory {
  return SMS_CATEGORIES.some((c) => c.value === val);
}

/**
 * Sanitizes and normalizes SMS message body content:
 * - Strips unwanted HTML markup while preserving line breaks from block tags & <br>
 * - Decodes HTML entities (&amp;, &nbsp;, &lt;, &gt;, &quot;, &#39;, &apos;)
 * - Preserves emojis, unicode, URLs, variables {{var}}, and intentional spacing.
 */
export function cleanSmsContent(raw?: string | null): string {
  if (!raw || typeof raw !== "string") return "";
  let text = raw;

  // Convert HTML break and block closure tags into newlines
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/(p|div|li|h[1-6])>/gi, "\n");

  // Remove common HTML tags
  text = text.replace(/<(?:\/)?(?:p|div|span|strong|b|em|i|u|a|ul|ol|li|h[1-6]|table|tr|td|th|tbody|thead|img|font|small|hr)\b[^>]*>/gi, "");

  // Decode standard HTML entities
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'");

  // Normalize Windows CR-LF to standard \n
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Collapse 3 or more consecutive newlines into at most 2 newlines
  text = text.replace(/\n{3,}/g, "\n\n");

  // Trim leading/trailing blank space while keeping internal formatting
  return text.trim();
}

/**
 * Parses existing template data from the backend into structured SmsTemplateData.
 * Safely parses JSON metadata in subject or falls back gracefully for legacy templates.
 */
export function parseSmsTemplate(
  subject?: string | null,
  body?: string | null,
  name?: string
): SmsTemplateData {
  let category: SmsCategory = "PROMOTIONAL";
  let description = "";
  let header = "";
  let headerType: SmsHeaderType = "NONE";
  let mediaUrl = "";
  let mediaName = "";
  let footer = "";
  let buttons: SmsButton[] = [];
  let cta: SmsCta = {
    enabled: false,
    type: "URL",
    label: "",
    value: "",
  };
  let parsedBody = "";

  if (subject && typeof subject === "string") {
    const trimmed = subject.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.category && isValidSmsCategory(String(parsed.category).toUpperCase())) {
          category = String(parsed.category).toUpperCase() as SmsCategory;
        }
        if (parsed.description && typeof parsed.description === "string") {
          description = parsed.description.trim();
        }
        if (parsed.header && typeof parsed.header === "string") {
          header = parsed.header.trim();
        }
        if (parsed.header && typeof parsed.header === "object") {
          header = parsed.header.text ? String(parsed.header.text).trim() : header;
          headerType = parsed.header.type ? (parsed.header.type as SmsHeaderType) : headerType;
          mediaUrl = parsed.header.mediaUrl ? String(parsed.header.mediaUrl).trim() : mediaUrl;
          mediaName = parsed.header.mediaName ? String(parsed.header.mediaName).trim() : mediaName;
        }
        if (parsed.headerType) {
          headerType = parsed.headerType as SmsHeaderType;
        } else if (!headerType) {
          headerType = header ? "TEXT" : mediaUrl ? "IMAGE" : "NONE";
        }
        if (parsed.mediaUrl && typeof parsed.mediaUrl === "string") {
          mediaUrl = parsed.mediaUrl.trim();
        }
        if (parsed.mediaName && typeof parsed.mediaName === "string") {
          mediaName = parsed.mediaName.trim();
        }
        if (parsed.footer && typeof parsed.footer === "string") {
          footer = parsed.footer.trim();
        }
        if (parsed.body && typeof parsed.body === "string" && parsed.body.trim()) {
          parsedBody = cleanSmsContent(parsed.body);
        }
        if (Array.isArray(parsed.buttons) && parsed.buttons.length > 0) {
          buttons = parsed.buttons.map((b: any, idx: number) => ({
            id: b.id || `btn_${idx}_${Date.now()}`,
            type: (b.type || "URL") as SmsButtonType,
            text: b.text || "",
            url: b.url,
            phoneNumber: b.phoneNumber,
            couponCode: b.couponCode,
          }));
        }
        if (parsed.cta && typeof parsed.cta === "object" && parsed.cta.enabled) {
          const type: SmsCtaType = ["URL", "PHONE", "REPLY_KEYWORD"].includes(parsed.cta.type)
            ? parsed.cta.type
            : "URL";
          cta = {
            enabled: true,
            type,
            label: parsed.cta.label ? String(parsed.cta.label).trim() : "",
            value: parsed.cta.value ? String(parsed.cta.value).trim() : "",
          };

          // If no buttons array was explicitly persisted, convert single cta to buttons array
          if (buttons.length === 0) {
            const btnType: SmsButtonType =
              type === "PHONE"
                ? "PHONE_NUMBER"
                : type === "REPLY_KEYWORD"
                ? "QUICK_REPLY"
                : "URL";
            buttons = [
              {
                id: `btn_cta_1`,
                type: btnType,
                text: cta.label || (type === "PHONE" ? "Call Us" : type === "REPLY_KEYWORD" ? "Reply" : "Visit Website"),
                url: type === "URL" ? cta.value : undefined,
                phoneNumber: type === "PHONE" ? cta.value : undefined,
                couponCode: undefined,
              },
            ];
          }
        }
      } catch {
        // Not valid JSON, check if it's a plain category string
        const upper = trimmed.toUpperCase();
        if (isValidSmsCategory(upper)) {
          category = upper as SmsCategory;
        } else {
          description = trimmed;
        }
      }
    } else {
      const upper = trimmed.toUpperCase();
      if (isValidSmsCategory(upper)) {
        category = upper as SmsCategory;
      } else {
        description = trimmed;
      }
    }
  }

  if (header && headerType === "NONE") {
    headerType = "TEXT";
  }

  // Use parsed body from JSON if available, otherwise fall back to cleanSmsContent(body)
  const finalBody = parsedBody || cleanSmsContent(body);

  return {
    name: name || "",
    category,
    description,
    header,
    headerType,
    mediaUrl,
    mediaName,
    body: finalBody,
    footer,
    buttons,
    cta,
  };
}
