import { EmailBlock, FontFamilyType } from "./types";

export const FONT_FAMILY_MAP: Record<FontFamilyType, string> = {
  system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', Times, serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
};

export function getDefaultBlocks(): EmailBlock[] {
  return [
    {
      id: "block_logo_default",
      type: "image",
      src: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=360&auto=format&fit=crop&q=80",
      alt: "Acme Logo",
      align: "center",
      width: 30,
      maxWidth: 160,
      isLogo: true,
      objectFit: "contain",
    },
    {
      id: "block_banner_default",
      type: "image",
      src: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&auto=format&fit=crop&q=80",
      alt: "Special Summer Promotion",
      align: "center",
      width: 100,
      maxWidth: 600,
      borderRadius: 8,
      objectFit: "cover",
      isLogo: false,
    },
    {
      id: "block_heading_1",
      type: "heading",
      text: "Welcome to Our Community, {{first_name}}!",
      level: 1,
      align: "center",
      color: "#0f172a",
      fontSize: 26,
      fontWeight: "bold",
      bold: true,
      fontFamily: "system",
      marginY: 12,
    },
    {
      id: "block_text_1",
      type: "text",
      content:
        "We're thrilled to have you here! Explore our latest updates, curated offerings, and special seasonal promotions designed especially for you.",
      align: "center",
      color: "#475569",
      fontSize: 15,
      fontFamily: "system",
      lineHeight: 1.6,
    },
    {
      id: "block_btn_1",
      type: "button",
      text: "Explore Deals Now →",
      url: "https://example.com/deals",
      actionType: "url",
      align: "center",
      bgColor: "#2563eb",
      textColor: "#ffffff",
      borderRadius: 8,
      fontSize: 15,
      paddingY: 12,
      paddingX: 28,
    },
    {
      id: "block_divider_1",
      type: "divider",
      style: "solid",
      color: "#e2e8f0",
      thickness: 1,
      marginY: 20,
    },
    {
      id: "block_link_1",
      type: "link",
      text: "View terms, conditions, and FAQ →",
      url: "https://example.com/terms",
      actionType: "url",
      align: "center",
      color: "#2563eb",
      fontSize: 13,
      fontFamily: "system",
      underline: true,
    },
    {
      id: "block_text_2",
      type: "text",
      content:
        "Need help? Reply directly to this email or visit our support center.\n© 2026 Your Company Inc. All rights reserved.",
      align: "center",
      color: "#94a3b8",
      fontSize: 12,
      fontFamily: "system",
      lineHeight: 1.5,
    },
  ];
}

export function serializeBlocksToHtml(blocks: EmailBlock[]): string {
  const contentHtml = blocks
    .map((block) => {
      switch (block.type) {
        case "heading": {
          const Tag = `h${block.level}`;
          const weight =
            block.fontWeight === "bold" || block.bold !== false
              ? "font-weight: 700;"
              : block.fontWeight === "semibold"
              ? "font-weight: 600;"
              : block.fontWeight === "medium"
              ? "font-weight: 500;"
              : "font-weight: 400;";
          const size = block.fontSize || (block.level === 1 ? 28 : block.level === 2 ? 22 : 18);
          const fontFamily = block.fontFamily ? `font-family: ${FONT_FAMILY_MAP[block.fontFamily]};` : "";
          const margin = block.marginY !== undefined ? `margin: ${block.marginY}px 0;` : "margin: 12px 0;";
          return `<${Tag} style="${margin} color: ${block.color}; text-align: ${block.align}; font-size: ${size}px; line-height: 1.3; ${weight} ${fontFamily}">${escapeHtml(block.text)}</${Tag}>`;
        }
        case "text": {
          let formatted = escapeHtml(block.content).replace(/\n/g, "<br />");
          if (block.bold) formatted = `<strong>${formatted}</strong>`;
          if (block.italic) formatted = `<em>${formatted}</em>`;
          if (block.underline) formatted = `<u>${formatted}</u>`;

          const size = block.fontSize || 15;
          const lh = block.lineHeight || 1.6;
          const fontFamily = block.fontFamily ? `font-family: ${FONT_FAMILY_MAP[block.fontFamily]};` : "";
          return `<div style="margin: 10px 0; color: ${block.color}; text-align: ${block.align}; font-size: ${size}px; line-height: ${lh}; ${fontFamily}">${formatted}</div>`;
        }
        case "image": {
          if (!block.src) return "";
          const isLogo = !!block.isLogo;
          const maxW = isLogo ? (block.maxWidth || 180) : (block.maxWidth || 600);
          const fit = block.objectFit || (isLogo ? "contain" : "cover");
          const align = block.align || "center";
          const radius = block.borderRadius || 0;
          const margin = isLogo ? "8px 0 16px 0" : "14px 0";

          const imgStyle = [
            `max-width: ${maxW}px;`,
            `width: ${block.width}%;`,
            `height: auto;`,
            `display: inline-block;`,
            `vertical-align: middle;`,
            `border-radius: ${radius}px;`,
            `border: 0;`,
            `outline: none;`,
            `text-decoration: none;`,
            `-ms-interpolation-mode: bicubic;`,
            `object-fit: ${fit};`,
          ].join(" ");

          const imgTag = `<img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt || (isLogo ? "Brand Logo" : "Email Banner"))}" width="${block.width}%" style="${imgStyle}" data-is-logo="${isLogo}" />`;
          const wrapped = block.linkUrl
            ? `<a href="${escapeHtml(block.linkUrl)}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; display: inline-block; max-width: 100%;">${imgTag}</a>`
            : imgTag;
          return `<div style="text-align: ${align}; margin: ${margin};">${wrapped}</div>`;
        }
        case "button": {
          const size = block.fontSize || 15;
          const radius = block.borderRadius !== undefined ? block.borderRadius : 6;
          const py = block.paddingY || 12;
          const px = block.paddingX || 28;
          const widthStyle = block.fullWidth ? "display: block; width: 100%; box-sizing: border-box;" : "display: inline-block;";

          let finalHref = block.url || "#";
          if (block.actionType === "phone" && block.phoneNumber) {
            finalHref = `tel:${block.phoneNumber.replace(/\s+/g, "")}`;
          } else if (block.actionType === "email" && block.emailAddress) {
            finalHref = `mailto:${block.emailAddress.trim()}`;
          }

          return `<div style="text-align: ${block.align}; margin: 20px 0;">
  <a href="${escapeHtml(finalHref)}" target="_blank" rel="noopener noreferrer" style="${widthStyle} background-color: ${block.bgColor}; color: ${block.textColor}; font-size: ${size}px; font-weight: 600; text-decoration: none; padding: ${py}px ${px}px; border-radius: ${radius}px; text-align: center; mso-padding-alt: 0;">
    ${escapeHtml(block.text || "Click Here")}
  </a>
</div>`;
        }
        case "link": {
          const size = block.fontSize || 14;
          const fontFamily = block.fontFamily ? `font-family: ${FONT_FAMILY_MAP[block.fontFamily]};` : "";
          const textDecoration = block.underline !== false ? "underline" : "none";
          const fontWeight = block.bold ? "bold" : "normal";

          let finalHref = block.url || "#";
          if (block.actionType === "phone" && block.phoneNumber) {
            finalHref = `tel:${block.phoneNumber.replace(/\s+/g, "")}`;
          } else if (block.actionType === "email" && block.emailAddress) {
            finalHref = `mailto:${block.emailAddress.trim()}`;
          }

          return `<div style="text-align: ${block.align}; margin: 12px 0;">
  <a href="${escapeHtml(finalHref)}" target="_blank" rel="noopener noreferrer" style="color: ${block.color}; font-size: ${size}px; font-weight: ${fontWeight}; text-decoration: ${textDecoration}; ${fontFamily}">
    ${escapeHtml(block.text || "Click here")}
  </a>
</div>`;
        }
        case "divider": {
          return `<hr style="border: none; border-top: ${block.thickness}px ${block.style} ${block.color}; margin: ${block.marginY}px 0;" />`;
        }
        case "spacer": {
          return `<div style="height: ${block.height}px; line-height: ${block.height}px; font-size: 0;">&nbsp;</div>`;
        }
        case "list": {
          const ListTag = block.listType === "number" ? "ol" : "ul";
          const size = block.fontSize || 15;
          const fontFamily = block.fontFamily ? `font-family: ${FONT_FAMILY_MAP[block.fontFamily]};` : "";
          const itemsHtml = block.items
            .map((item) => `<li style="margin-bottom: 6px;">${escapeHtml(item)}</li>`)
            .join("");
          return `<${ListTag} style="color: ${block.color}; font-size: ${size}px; line-height: 1.6; margin: 12px 0; padding-left: 28px; ${fontFamily}">${itemsHtml}</${ListTag}>`;
        }
        case "html": {
          return `<div style="margin: 12px 0;">${block.content}</div>`;
        }
        default:
          return "";
      }
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Marketing Email</title>
  <!--[if mso]>
  <style type="text/css">
    table {border-collapse:collapse;border-spacing:0;margin:0;}
    div, td {padding:0;}
    div {margin:0 !important;}
  </style>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; max-width: 100%; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; max-width: 100% !important; border-radius: 0 !important; }
      .email-content { padding: 20px 16px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 20px 8px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 10px 0;">
        <table class="email-container" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <tr>
            <td class="email-content" style="padding: 28px 24px;">
${contentHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function parseHtmlToBlocks(html: string): EmailBlock[] {
  if (!html || !html.trim()) {
    return getDefaultBlocks();
  }

  // If running in browser environment with DOMParser
  if (typeof window !== "undefined" && typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      // Check if it's our structured template container
      const tdContent = doc.querySelector("table table td") || doc.body;
      const children = Array.from(tdContent.children);

      if (children.length > 0) {
        const blocks: EmailBlock[] = [];
        let blockIndex = 1;

        for (const el of children) {
          const tagName = el.tagName.toLowerCase();

          // Heading
          if (/^h[1-3]$/.test(tagName)) {
            const level = parseInt(tagName.charAt(1), 10) as 1 | 2 | 3;
            const style = (el as HTMLElement).style;
            blocks.push({
              id: `block_h_${Date.now()}_${blockIndex++}`,
              type: "heading",
              text: el.textContent || "",
              level,
              align: (style.textAlign as "left" | "center" | "right") || "left",
              color: style.color || "#0f172a",
              fontSize: style.fontSize ? parseInt(style.fontSize, 10) : undefined,
              bold: style.fontWeight === "700" || style.fontWeight === "bold",
            });
            continue;
          }

          // Divider
          if (tagName === "hr") {
            blocks.push({
              id: `block_div_${Date.now()}_${blockIndex++}`,
              type: "divider",
              style: "solid",
              color: "#e2e8f0",
              thickness: 1,
              marginY: 20,
            });
            continue;
          }

          // Spacer
          if (tagName === "div" && (el as HTMLElement).style.height && (el as HTMLElement).textContent?.trim() === "") {
            blocks.push({
              id: `block_sp_${Date.now()}_${blockIndex++}`,
              type: "spacer",
              height: parseInt((el as HTMLElement).style.height, 10) || 24,
            });
            continue;
          }

          // Button or Link
          const anchorBtn = el.querySelector("a") || (tagName === "a" ? (el as HTMLAnchorElement) : null);
          if (anchorBtn) {
            const href = anchorBtn.getAttribute("href") || "#";
            const isTel = href.startsWith("tel:");
            const isMailto = href.startsWith("mailto:");
            const hasButtonStyling = !!(anchorBtn.style.backgroundColor || anchorBtn.style.padding);

            if (hasButtonStyling) {
              let actionType: "url" | "phone" | "email" = "url";
              let phoneNumber = "";
              let emailAddress = "";

              if (isTel) {
                actionType = "phone";
                phoneNumber = href.replace(/^tel:/i, "");
              } else if (isMailto) {
                actionType = "email";
                emailAddress = href.replace(/^mailto:/i, "");
              }

              blocks.push({
                id: `block_btn_${Date.now()}_${blockIndex++}`,
                type: "button",
                text: anchorBtn.textContent || "Click Here",
                url: href,
                actionType,
                phoneNumber: phoneNumber || undefined,
                emailAddress: emailAddress || undefined,
                align: ((el as HTMLElement).style.textAlign as "left" | "center" | "right") || "center",
                bgColor: anchorBtn.style.backgroundColor || "#2563eb",
                textColor: anchorBtn.style.color || "#ffffff",
                borderRadius: anchorBtn.style.borderRadius ? parseInt(anchorBtn.style.borderRadius, 10) : 6,
              });
              continue;
            } else {
              // It's a text link block
              let actionType: "url" | "phone" | "email" = "url";
              let phoneNumber = "";
              let emailAddress = "";

              if (isTel) {
                actionType = "phone";
                phoneNumber = href.replace(/^tel:/i, "");
              } else if (isMailto) {
                actionType = "email";
                emailAddress = href.replace(/^mailto:/i, "");
              }

              blocks.push({
                id: `block_lnk_${Date.now()}_${blockIndex++}`,
                type: "link",
                text: anchorBtn.textContent || "Click here",
                url: href,
                actionType,
                phoneNumber: phoneNumber || undefined,
                emailAddress: emailAddress || undefined,
                align: ((el as HTMLElement).style.textAlign as "left" | "center" | "right") || "left",
                color: anchorBtn.style.color || "#2563eb",
                underline: anchorBtn.style.textDecoration !== "none",
                bold: anchorBtn.style.fontWeight === "bold" || anchorBtn.style.fontWeight === "700",
              });
              continue;
            }
          }

          // Image (Brand Logo or Banner)
          const imgEl = el.querySelector("img") || (tagName === "img" ? (el as HTMLImageElement) : null);
          if (imgEl) {
            const anchor = el.querySelector("a");
            const isLogoAttr = imgEl.getAttribute("data-is-logo") === "true";
            const altText = imgEl.getAttribute("alt") || "";
            const isLogo = isLogoAttr || altText.toLowerCase().includes("logo");

            // Extract maxWidth
            let parsedMaxWidth: number | undefined;
            const styleMaxW = imgEl.style.maxWidth;
            if (styleMaxW && styleMaxW.includes("px")) {
              parsedMaxWidth = parseInt(styleMaxW, 10);
            }

            // Extract width percentage
            let parsedWidth = 100;
            const styleW = imgEl.style.width || imgEl.getAttribute("width") || "";
            if (styleW && styleW.includes("%")) {
              parsedWidth = parseInt(styleW, 10);
            } else if (isLogo && !parsedMaxWidth) {
              parsedWidth = 30;
            }

            // Extract borderRadius
            let parsedRadius = 0;
            const styleRad = imgEl.style.borderRadius;
            if (styleRad && styleRad.includes("px")) {
              parsedRadius = parseInt(styleRad, 10);
            }

            // Extract objectFit
            const parsedFit = (imgEl.style.objectFit as "contain" | "cover") || (isLogo ? "contain" : "cover");

            blocks.push({
              id: `block_img_${Date.now()}_${blockIndex++}`,
              type: "image",
              src: imgEl.getAttribute("src") || "",
              alt: altText,
              linkUrl: anchor?.getAttribute("href") || undefined,
              align: ((el as HTMLElement).style.textAlign as "left" | "center" | "right") || "center",
              width: parsedWidth,
              maxWidth: parsedMaxWidth || (isLogo ? 160 : 600),
              borderRadius: parsedRadius,
              objectFit: parsedFit,
              isLogo,
            });
            continue;
          }

          // List
          if (tagName === "ul" || tagName === "ol") {
            const items = Array.from(el.querySelectorAll("li")).map((li) => li.textContent || "");
            blocks.push({
              id: `block_list_${Date.now()}_${blockIndex++}`,
              type: "list",
              listType: tagName === "ol" ? "number" : "bullet",
              items: items.length > 0 ? items : ["List item 1", "List item 2"],
              color: (el as HTMLElement).style.color || "#334155",
            });
            continue;
          }

          // Paragraph / Text div
          if (tagName === "p" || tagName === "div") {
            const content = el.innerHTML.replace(/<br\s*[\/]?>/gi, "\n").replace(/<[^>]+>/g, "");
            blocks.push({
              id: `block_txt_${Date.now()}_${blockIndex++}`,
              type: "text",
              content: content || el.textContent || "",
              align: ((el as HTMLElement).style.textAlign as "left" | "center" | "right") || "left",
              color: (el as HTMLElement).style.color || "#475569",
              fontSize: (el as HTMLElement).style.fontSize ? parseInt((el as HTMLElement).style.fontSize, 10) : 15,
            });
            continue;
          }

          // Fallback to HTML block
          blocks.push({
            id: `block_html_${Date.now()}_${blockIndex++}`,
            type: "html",
            content: el.outerHTML,
          });
        }

        if (blocks.length > 0) {
          return blocks;
        }
      }
    } catch {
      // fallback below
    }
  }

  // If HTML could not be parsed into distinct blocks, wrap the entire HTML safely into an HtmlBlock
  // This guarantees existing template body is NEVER lost or mangled
  return [
    {
      id: `block_html_imported_${Date.now()}`,
      type: "html",
      content: html,
    },
  ];
}
