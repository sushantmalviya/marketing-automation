import { describe, it, expect } from "vitest";
import {
  analyzeSmsText,
  renderSmsPreviewText,
  splitTextWithUrls,
} from "@/components/user/templates/sms-builder/sms-encoder";
import {
  serializeSmsMetadata,
  compileSmsMessage,
  parseSmsTemplate,
} from "@/components/user/templates/sms-builder/sms-serializer";
import { SmsTemplateData, SmsCta } from "@/components/user/templates/sms-builder/sms-types";

describe("SMS Builder - Encoder & Segmentation", () => {
  it("should calculate single-segment GSM-7 message correctly", () => {
    const text = "Hello from Marketing Automation! Welcome to our platform.";
    const analysis = analyzeSmsText(text);

    expect(analysis.encoding).toBe("GSM-7");
    expect(analysis.hasUnicode).toBe(false);
    expect(analysis.charCount).toBe(text.length);
    expect(analysis.segments).toBe(1);
    expect(analysis.maxCharsPerSegment).toBe(160);
    expect(analysis.charsRemainingInSegment).toBe(160 - text.length);
  });

  it("should calculate multi-segment GSM-7 message correctly (>160 chars)", () => {
    // 170 characters of standard GSM-7 text
    const text =
      "This is a longer message designed to exceed the standard 160-character limit of a single SMS text message to verify that the carrier concatenation segment math computes properly.";
    expect(text.length).toBeGreaterThan(160);

    const analysis = analyzeSmsText(text);
    expect(analysis.encoding).toBe("GSM-7");
    expect(analysis.hasUnicode).toBe(false);
    // Over 160 chars, carrier segments are 153 chars each
    expect(analysis.segments).toBe(Math.ceil(analysis.gsmLength / 153));
    expect(analysis.maxCharsPerSegment).toBe(153);
  });

  it("should count extended GSM-7 characters as 2 characters", () => {
    // € and { and } are extended GSM characters
    const text = "Special offer: €50 discount {VIP}";
    const analysis = analyzeSmsText(text);

    expect(analysis.encoding).toBe("GSM-7");
    expect(analysis.hasUnicode).toBe(false);
    // Length in code units + 3 extra for €, {, }
    expect(analysis.gsmLength).toBe(text.length + 3);
  });

  it("should detect Unicode emojis and switch to UCS-2 encoding with 70/67 limits", () => {
    const text = "Flash Sale Alert! ⚡ Get 20% off today!";
    const analysis = analyzeSmsText(text);

    expect(analysis.encoding).toBe("UCS-2");
    expect(analysis.hasUnicode).toBe(true);
    expect(analysis.unicodeChars).toContain("⚡");
    expect(analysis.maxCharsPerSegment).toBe(70);
    expect(analysis.segments).toBe(1);
  });

  it("should calculate multi-segment UCS-2 message correctly (>70 chars)", () => {
    const text =
      "🔥 Exclusive Member Deal: You have unlocked premium VIP access to all our latest services for this month only! Visit our store.";
    expect(text.length).toBeGreaterThan(70);

    const analysis = analyzeSmsText(text);
    expect(analysis.encoding).toBe("UCS-2");
    expect(analysis.hasUnicode).toBe(true);
    expect(analysis.segments).toBe(Math.ceil(text.length / 67));
    expect(analysis.maxCharsPerSegment).toBe(67);
  });

  it("should handle empty text gracefully", () => {
    const analysis = analyzeSmsText("");
    expect(analysis.encoding).toBe("GSM-7");
    expect(analysis.charCount).toBe(0);
    expect(analysis.segments).toBe(0);
    expect(analysis.charsRemainingInSegment).toBe(160);
  });
});

describe("SMS Builder - Personalization & URLs", () => {
  it("should replace variable placeholders with sample preview values", () => {
    const template = "Hello {{first_name}} {{last_name}}, welcome to {{company}} in {{city}}!";
    const rendered = renderSmsPreviewText(template, true);

    expect(rendered).toContain("Alex");
    expect(rendered).toContain("Morgan");
    expect(rendered).toContain("Acme Corp");
    expect(rendered).toContain("San Francisco");
    expect(rendered).not.toContain("{{first_name}}");
  });

  it("should retain raw placeholders when sample preview is disabled", () => {
    const template = "Hello {{first_name}}, your code is 1234.";
    const rendered = renderSmsPreviewText(template, false);

    expect(rendered).toBe(template);
  });

  it("should extract URLs from text for clickable preview rendering", () => {
    const text = "Check out our sale: https://example.com/deals and sign up!";
    const parts = splitTextWithUrls(text);

    expect(parts.length).toBe(3);
    expect(parts[0].isUrl).toBe(false);
    expect(parts[0].text).toBe("Check out our sale: ");
    expect(parts[1].isUrl).toBe(true);
    expect(parts[1].text).toBe("https://example.com/deals");
    expect(parts[2].isUrl).toBe(false);
    expect(parts[2].text).toBe(" and sign up!");
  });
});

describe("SMS Builder - Metadata Serialization", () => {
  it("should serialize category and description into subject JSON", () => {
    const data: SmsTemplateData = {
      name: "Promo Summer",
      category: "PROMOTIONAL",
      description: "20% off campaign",
      body: "Hello {{first_name}}",
    };

    const serialized = serializeSmsMetadata(data);
    const parsed = JSON.parse(serialized);

    expect(parsed.category).toBe("PROMOTIONAL");
    expect(parsed.description).toBe("20% off campaign");
  });

  it("should parse structured JSON metadata from subject", () => {
    const subject = JSON.stringify({
      category: "NOTIFICATION",
      description: "Order status alert",
    });
    const body = "Your order #123 has shipped.";

    const parsed = parseSmsTemplate(subject, body, "Order Alert");
    expect(parsed.name).toBe("Order Alert");
    expect(parsed.category).toBe("NOTIFICATION");
    expect(parsed.description).toBe("Order status alert");
    expect(parsed.body).toBe(body);
  });

  it("should gracefully handle legacy templates with plain string subject", () => {
    const subject = "TRANSACTIONAL";
    const body = "Your receipt for $45.00";

    const parsed = parseSmsTemplate(subject, body, "Receipt");
    expect(parsed.category).toBe("TRANSACTIONAL");
    expect(parsed.body).toBe(body);
  });

  it("should default to PROMOTIONAL when subject is empty or null", () => {
    const parsed = parseSmsTemplate(null, "Test message", "Test");
    expect(parsed.category).toBe("PROMOTIONAL");
    expect(parsed.description).toBe("");
    expect(parsed.body).toBe("Test message");
  });
});

describe("SMS Builder - Content Cleaning & Preview Consistency", () => {
  it("should strip HTML markup and convert line breaks from <p> and <br>", () => {
    const htmlInput = "<p>Hi {{first_name}},</p><p>Big Sale today! 🛍️</p><br/>Visit: https://brand.com/sale";
    const parsed = parseSmsTemplate(null, htmlInput, "Promo");

    expect(parsed.body).toBe("Hi {{first_name}},\nBig Sale today! 🛍️\n\nVisit: https://brand.com/sale");
    expect(parsed.body).not.toContain("<p>");
    expect(parsed.body).not.toContain("</p>");
    expect(parsed.body).not.toContain("<br/>");
  });

  it("should decode HTML entities like &amp;, &nbsp;, &quot;", () => {
    const encoded = "Flash&nbsp;Sale &amp; Special &quot;VIP&quot; Deals! Check https://example.com?a=1&amp;b=2";
    const parsed = parseSmsTemplate(null, encoded, "Promo");

    expect(parsed.body).toBe("Flash Sale & Special \"VIP\" Deals! Check https://example.com?a=1&b=2");
  });

  it("should resolve custom preview sample data when provided", () => {
    const template = "Hey {{first_name}}, your order for {{company}} is ready!";
    const customSamples = {
      first_name: "Samantha",
      company: "Starlight Media",
    };

    const rendered = renderSmsPreviewText(template, true, customSamples);
    expect(rendered).toBe("Hey Samantha, your order for Starlight Media is ready!");
  });

  it("should preserve line breaks, emojis, and punctuation across multiple paragraphs", () => {
    const multiLine = "Line 1 🔥\n\nLine 2 🚀\nLine 3: https://example.com";
    const parsed = parseSmsTemplate(null, multiLine, "Multiline");

    expect(parsed.body).toBe(multiLine);
  });
});

describe("SMS Builder - Header, Footer, and Call-to-Action Integration", () => {
  it("should compile SMS with only body when header, footer, and CTA are not provided", () => {
    const data: SmsTemplateData = {
      name: "Simple Text",
      category: "PROMOTIONAL",
      body: "Hi {{first_name}}, this is a simple text.",
    };

    const compiled = compileSmsMessage(data);
    expect(compiled).toBe("Hi {{first_name}}, this is a simple text.");
  });

  it("should compile SMS in exact order: Header -> Body -> Footer -> CTA", () => {
    const data: SmsTemplateData = {
      name: "Full Campaign",
      category: "PROMOTIONAL",
      header: "FLASH SALE 50% OFF",
      body: "Enjoy our biggest sale of the summer.",
      footer: "Reply STOP to unsubscribe",
      cta: {
        enabled: true,
        type: "URL",
        label: "Shop Now",
        value: "https://brand.com/summer",
      },
    };

    const compiled = compileSmsMessage(data);
    const expected =
      "FLASH SALE 50% OFF\n\nEnjoy our biggest sale of the summer.\n\nReply STOP to unsubscribe\n\nShop Now: https://brand.com/summer";

    expect(compiled).toBe(expected);
  });

  it("should format Phone and Reply Keyword CTAs correctly in compiled message", () => {
    const phoneData: SmsTemplateData = {
      name: "Support SMS",
      category: "TRANSACTIONAL",
      body: "Your order is ready.",
      cta: {
        enabled: true,
        type: "PHONE",
        label: "Call Support",
        value: "+1-800-555-0199",
      },
    };
    expect(compileSmsMessage(phoneData)).toBe("Your order is ready.\n\nCall Support: +1-800-555-0199");

    const keywordData: SmsTemplateData = {
      name: "Opt-out Prompt",
      category: "PROMOTIONAL",
      body: "Exclusive deals for you.",
      cta: {
        enabled: true,
        type: "REPLY_KEYWORD",
        value: "STOP",
      },
    };
    expect(compileSmsMessage(keywordData)).toBe("Exclusive deals for you.\n\nReply STOP");
  });

  it("should serialize and parse full structured template data through subject JSON", () => {
    const data: SmsTemplateData = {
      name: "VIP Offer",
      category: "PROMOTIONAL",
      description: "Summer VIP campaign",
      header: "VIP SPECIAL",
      body: "Exclusive access to members.",
      footer: "Text HELP for info",
      cta: {
        enabled: true,
        type: "URL",
        label: "Claim",
        value: "https://brand.com/vip",
      },
    };

    const subject = serializeSmsMetadata(data);
    const compiledBody = compileSmsMessage(data);

    const parsed = parseSmsTemplate(subject, compiledBody, data.name);
    expect(parsed.name).toBe("VIP Offer");
    expect(parsed.category).toBe("PROMOTIONAL");
    expect(parsed.description).toBe("Summer VIP campaign");
    expect(parsed.header).toBe("VIP SPECIAL");
    expect(parsed.body).toBe("Exclusive access to members.");
    expect(parsed.footer).toBe("Text HELP for info");
    expect(parsed.cta?.enabled).toBe(true);
    expect(parsed.cta?.type).toBe("URL");
    expect(parsed.cta?.label).toBe("Claim");
    expect(parsed.cta?.value).toBe("https://brand.com/vip");
  });

  it("should accurately compute segments across entire compiled message with header and footer", () => {
    const data: SmsTemplateData = {
      name: "Multi-element",
      category: "PROMOTIONAL",
      header: "SALE",
      body: "Hello world",
      footer: "STOP to opt-out",
    };

    const compiled = compileSmsMessage(data);
    expect(compiled).toBe("SALE\n\nHello world\n\nSTOP to opt-out");

    const analysis = analyzeSmsText(compiled);
    expect(analysis.charCount).toBe(compiled.length);
    expect(analysis.segments).toBe(1);
    expect(analysis.hasUnicode).toBe(false);
  });

  it("should compile SMS with WhatsApp-style multi-buttons in exact order: Header -> Body -> Footer -> Buttons", () => {
    const data: SmsTemplateData = {
      name: "Multi Button Campaign",
      category: "PROMOTIONAL",
      header: "BLACK FRIDAY",
      body: "Enjoy 50% off storewide today only.",
      footer: "Reply STOP to opt out",
      buttons: [
        {
          id: "b1",
          type: "URL",
          text: "Shop Now",
          url: "https://brand.com/sale",
        },
        {
          id: "b2",
          type: "PHONE_NUMBER",
          text: "Call Support",
          phoneNumber: "+18005550199",
        },
        {
          id: "b3",
          type: "COUPON_CODE",
          text: "Coupon",
          couponCode: "BLACK50",
        },
        {
          id: "b4",
          type: "QUICK_REPLY",
          text: "YES",
        },
      ],
    };

    const compiled = compileSmsMessage(data);
    const expected = [
      "BLACK FRIDAY",
      "Enjoy 50% off storewide today only.",
      "Reply STOP to opt out",
      "Shop Now: https://brand.com/sale\nCall Support: +18005550199\nCoupon: BLACK50\nReply \"YES\"",
    ].join("\n\n");

    expect(compiled).toBe(expected);
  });

  it("should omit header when headerType is NONE even if header text exists", () => {
    const data: SmsTemplateData = {
      name: "No Header Template",
      category: "PROMOTIONAL",
      header: "THIS SHOULD BE OMITTED",
      headerType: "NONE",
      body: "Only body message.",
    };

    const compiled = compileSmsMessage(data);
    expect(compiled).toBe("Only body message.");
  });

  it("should serialize and parse multi-buttons preserving roundtrip fidelity", () => {
    const data: SmsTemplateData = {
      name: "Roundtrip Test",
      category: "PROMOTIONAL",
      description: "Testing buttons serialization",
      header: "DEAL ALERT",
      headerType: "TEXT",
      body: "Check our deals.",
      footer: "Txt STOP to end",
      buttons: [
        {
          id: "btn_1",
          type: "BOOK_DEMO",
          text: "Book Demo",
          url: "https://brand.com/demo",
        },
        {
          id: "btn_2",
          type: "COUPON_CODE",
          text: "Promo",
          couponCode: "SAVE30",
        },
      ],
    };

    const subject = serializeSmsMetadata(data);
    const compiled = compileSmsMessage(data);
    const parsed = parseSmsTemplate(subject, compiled, data.name);

    expect(parsed.name).toBe("Roundtrip Test");
    expect(parsed.header).toBe("DEAL ALERT");
    expect(parsed.headerType).toBe("TEXT");
    expect(parsed.body).toBe("Check our deals.");
    expect(parsed.footer).toBe("Txt STOP to end");
    expect(parsed.buttons?.length).toBe(2);
    expect(parsed.buttons?.[0].type).toBe("BOOK_DEMO");
    expect(parsed.buttons?.[0].text).toBe("Book Demo");
    expect(parsed.buttons?.[0].url).toBe("https://brand.com/demo");
    expect(parsed.buttons?.[1].type).toBe("COUPON_CODE");
    expect(parsed.buttons?.[1].couponCode).toBe("SAVE30");
  });

  it("should accurately compute segments across header, body, footer, and multi-buttons", () => {
    const data: SmsTemplateData = {
      name: "Segment Calculation Test",
      category: "PROMOTIONAL",
      header: "SALE",
      body: "Hello customer",
      footer: "STOP to end",
      buttons: [
        {
          id: "b1",
          type: "URL",
          text: "Shop",
          url: "https://x.com",
        },
      ],
    };

    const compiled = compileSmsMessage(data);
    expect(compiled).toBe("SALE\n\nHello customer\n\nSTOP to end\n\nShop: https://x.com");

    const analysis = analyzeSmsText(compiled);
    expect(analysis.charCount).toBe(compiled.length);
    expect(analysis.segments).toBe(1);
    expect(analysis.hasUnicode).toBe(false);
  });

  describe("Promotional Media Support (Image, Video, Document)", () => {
    it("should compile SMS with image media URL header in exact order: Image URL -> Body -> Footer -> CTA", () => {
      const data: SmsTemplateData = {
        name: "MMS Promo",
        category: "PROMOTIONAL",
        headerType: "IMAGE",
        mediaUrl: "https://cdn.example.com/assets/promo-banner.jpg",
        mediaName: "promo-banner.jpg",
        body: "Check out our new arrivals!",
        footer: "Reply STOP to cancel",
        cta: {
          enabled: true,
          type: "URL",
          label: "View Collection",
          value: "https://example.com/collection",
        },
      };

      const compiled = compileSmsMessage(data);
      const expected =
        "https://cdn.example.com/assets/promo-banner.jpg\n\nCheck out our new arrivals!\n\nReply STOP to cancel\n\nView Collection: https://example.com/collection";

      expect(compiled).toBe(expected);
    });

    it("should compile SMS with video media URL header", () => {
      const data: SmsTemplateData = {
        name: "Video Promo",
        category: "PROMOTIONAL",
        headerType: "VIDEO",
        mediaUrl: "https://cdn.example.com/assets/teaser.mp4",
        mediaName: "teaser.mp4",
        body: "Watch our exclusive product launch trailer!",
      };

      const compiled = compileSmsMessage(data);
      expect(compiled).toBe("https://cdn.example.com/assets/teaser.mp4\n\nWatch our exclusive product launch trailer!");
    });

    it("should compile SMS with document media URL header", () => {
      const data: SmsTemplateData = {
        name: "Brochure SMS",
        category: "PROMOTIONAL",
        headerType: "DOCUMENT",
        mediaUrl: "https://cdn.example.com/assets/catalog.pdf",
        mediaName: "catalog.pdf",
        body: "Here is your requested product catalog.",
        cta: {
          enabled: true,
          type: "PHONE",
          label: "Call Sales",
          value: "+18005550123",
        },
      };

      const compiled = compileSmsMessage(data);
      expect(compiled).toBe(
        "https://cdn.example.com/assets/catalog.pdf\n\nHere is your requested product catalog.\n\nCall Sales: +18005550123"
      );
    });

    it("should serialize and deserialize mediaUrl and mediaName through subject JSON", () => {
      const data: SmsTemplateData = {
        name: "Media Roundtrip",
        category: "PROMOTIONAL",
        headerType: "IMAGE",
        mediaUrl: "/api/assets/download/img-123.jpg",
        mediaName: "summer-sale.jpg",
        body: "Save 40% this weekend only.",
        footer: "Reply STOP to unsubscribe",
        cta: {
          enabled: true,
          type: "URL",
          label: "Shop Sale",
          value: "https://brand.com/sale",
        },
      };

      const serializedSubject = serializeSmsMetadata(data);
      const compiledBody = compileSmsMessage(data);

      const parsed = parseSmsTemplate(serializedSubject, compiledBody, data.name);
      expect(parsed.name).toBe("Media Roundtrip");
      expect(parsed.headerType).toBe("IMAGE");
      expect(parsed.mediaUrl).toBe("/api/assets/download/img-123.jpg");
      expect(parsed.mediaName).toBe("summer-sale.jpg");
      expect(parsed.body).toBe("Save 40% this weekend only.");
      expect(parsed.footer).toBe("Reply STOP to unsubscribe");
      expect(parsed.cta?.enabled).toBe(true);
      expect(parsed.cta?.type).toBe("URL");
      expect(parsed.cta?.value).toBe("https://brand.com/sale");
    });

    it("should calculate carrier segments taking media URL into account", () => {
      const data: SmsTemplateData = {
        name: "Media Segment Test",
        category: "PROMOTIONAL",
        headerType: "IMAGE",
        mediaUrl: "https://example.com/assets/img.jpg",
        body: "Special deal!",
      };

      const compiled = compileSmsMessage(data);
      const analysis = analyzeSmsText(compiled);
      expect(analysis.charCount).toBe(compiled.length);
      expect(analysis.segments).toBe(1);
    });
  });
});
