import { describe, it, expect } from "vitest";
import {
  serializeWhatsAppMetadata,
  compileWhatsAppMessage,
  generateWhatsAppPreview,
  parseWhatsAppTemplate,
  cleanHtmlText,
  extractFromCompiledBody,
} from "@/components/user/templates/whatsapp-builder/whatsapp-serializer";
import type { WhatsAppTemplateData } from "@/components/user/templates/whatsapp-builder/whatsapp-types";

describe("WhatsApp Template Serializer Tests", () => {
  // 1. Image header serialization
  it("should correctly serialize and preserve image header", () => {
    const data: WhatsAppTemplateData = {
      name: "Promo Image",
      category: "MARKETING",
      language: "en_US",
      header: {
        type: "IMAGE",
        mediaUrl: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
        mediaName: "sample.jpg",
      },
      body: "Hello {{first_name}}, check this banner!",
      footer: "Reply STOP to cancel",
      buttons: [],
    };

    const serialized = serializeWhatsAppMetadata(data);
    const parsed = JSON.parse(serialized);
    expect(parsed.header.type).toBe("IMAGE");
    expect(parsed.header.mediaUrl).toBe("https://res.cloudinary.com/demo/image/upload/sample.jpg");
    expect(parsed.header.mediaName).toBe("sample.jpg");

    // Body should not contain [IMAGE: ...]
    const cleanBody = compileWhatsAppMessage(data);
    expect(cleanBody).toBe("Hello {{first_name}}, check this banner!");
    expect(cleanBody).not.toContain("[IMAGE:");
  });

  // 2. Text header serialization
  it("should correctly serialize and preserve text header", () => {
    const data: WhatsAppTemplateData = {
      name: "Text Header Promo",
      category: "MARKETING",
      language: "en_US",
      header: {
        type: "TEXT",
        text: "Special Deal Alert",
      },
      body: "Hi {{1}}, get 20% off today.",
      footer: "",
      buttons: [],
    };

    const serialized = serializeWhatsAppMetadata(data);
    const parsed = JSON.parse(serialized);
    expect(parsed.header.type).toBe("TEXT");
    expect(parsed.header.text).toBe("Special Deal Alert");

    const cleanBody = compileWhatsAppMessage(data);
    expect(cleanBody).toBe("Hi {{1}}, get 20% off today.");
    expect(cleanBody).not.toContain("*Special Deal Alert*");
  });

  // 3. Video/document header serialization
  it("should correctly serialize video and document headers", () => {
    const videoData: WhatsAppTemplateData = {
      name: "Video Promo",
      category: "MARKETING",
      language: "en_US",
      header: {
        type: "VIDEO",
        mediaUrl: "https://example.com/video.mp4",
        mediaName: "video.mp4",
      },
      body: "Watch our product walkthrough.",
      footer: "",
      buttons: [],
    };

    const parsedVideo = JSON.parse(serializeWhatsAppMetadata(videoData));
    expect(parsedVideo.header.type).toBe("VIDEO");
    expect(parsedVideo.header.mediaUrl).toBe("https://example.com/video.mp4");

    const docData: WhatsAppTemplateData = {
      name: "Invoice Document",
      category: "UTILITY",
      language: "en_US",
      header: {
        type: "DOCUMENT",
        mediaUrl: "https://example.com/invoice.pdf",
        mediaName: "invoice.pdf",
      },
      body: "Your monthly invoice is attached.",
      footer: "",
      buttons: [],
    };

    const parsedDoc = JSON.parse(serializeWhatsAppMetadata(docData));
    expect(parsedDoc.header.type).toBe("DOCUMENT");
    expect(parsedDoc.header.mediaUrl).toBe("https://example.com/invoice.pdf");
  });

  // 4. Body variable preservation
  it("should preserve body variables with exact naming and sequencing", () => {
    const data: WhatsAppTemplateData = {
      name: "Multi-Variable Notification",
      category: "MARKETING",
      language: "en_US",
      header: { type: "NONE" },
      body: "Dear {{name}}, your booking #{{booking_id}} for {{event_date}} is confirmed.",
      footer: "Thanks for choosing us",
      buttons: [],
    };

    const serialized = serializeWhatsAppMetadata(data);
    const parsed = JSON.parse(serialized);
    expect(parsed.body).toBe("Dear {{name}}, your booking #{{booking_id}} for {{event_date}} is confirmed.");

    const reloaded = parseWhatsAppTemplate(serialized, data.body);
    expect(reloaded.body).toBe("Dear {{name}}, your booking #{{booking_id}} for {{event_date}} is confirmed.");
  });

  // 5. URL button preservation
  it("should preserve static and dynamic URL buttons", () => {
    const data: WhatsAppTemplateData = {
      name: "URL Buttons Promo",
      category: "MARKETING",
      language: "en_US",
      header: { type: "NONE" },
      body: "Click below to view your order.",
      footer: "",
      buttons: [
        {
          id: "btn_1",
          type: "URL",
          text: "View Order",
          url: "https://shop.example.com/orders/{{order_id}}",
        },
        {
          id: "btn_2",
          type: "BOOK_DEMO",
          text: "Book Demo",
          url: "https://calendly.com/demo",
        },
      ],
    };

    const serialized = serializeWhatsAppMetadata(data);
    const parsed = JSON.parse(serialized);
    expect(parsed.buttons.length).toBe(2);
    expect(parsed.buttons[0].type).toBe("URL");
    expect(parsed.buttons[0].text).toBe("View Order");
    expect(parsed.buttons[0].url).toBe("https://shop.example.com/orders/{{order_id}}");
    expect(parsed.buttons[1].type).toBe("BOOK_DEMO");
    expect(parsed.buttons[1].url).toBe("https://calendly.com/demo");
  });

  // 6. Quick-reply preservation
  it("should preserve quick-reply buttons and phone call buttons", () => {
    const data: WhatsAppTemplateData = {
      name: "Quick Reply Template",
      category: "MARKETING",
      language: "en_US",
      header: { type: "NONE" },
      body: "How would you rate our support?",
      footer: "",
      buttons: [
        {
          id: "btn_qr1",
          type: "QUICK_REPLY",
          text: "Excellent 👍",
        },
        {
          id: "btn_qr2",
          type: "QUICK_REPLY",
          text: "Needs Improvement",
        },
        {
          id: "btn_call",
          type: "PHONE_NUMBER",
          text: "Call Support",
          phoneNumber: "+15551234567",
        },
      ],
    };

    const serialized = serializeWhatsAppMetadata(data);
    const parsed = JSON.parse(serialized);
    expect(parsed.buttons.length).toBe(3);
    expect(parsed.buttons[0].type).toBe("QUICK_REPLY");
    expect(parsed.buttons[0].text).toBe("Excellent 👍");
    expect(parsed.buttons[2].type).toBe("PHONE_NUMBER");
    expect(parsed.buttons[2].phoneNumber).toBe("+15551234567");
  });

  // 7. Save and reload structured template
  it("should accurately reload structured template across round-trips", () => {
    const initial: WhatsAppTemplateData = {
      name: "Summer Sale 2026",
      category: "MARKETING",
      language: "en_US",
      header: {
        type: "IMAGE",
        mediaUrl: "https://example.com/hero.png",
        mediaName: "hero.png",
      },
      body: "Hey {{customer_name}}, use code {{promo_code}} for 30% off!",
      footer: "Valid until Sunday",
      buttons: [
        {
          id: "btn_claim",
          type: "URL",
          text: "Claim Now",
          url: "https://example.com/sale",
        },
        {
          id: "btn_contact",
          type: "PHONE_NUMBER",
          text: "Call Desk",
          phoneNumber: "+917806030359",
        },
      ],
    };

    const subjectJson = serializeWhatsAppMetadata(initial);
    const cleanBody = compileWhatsAppMessage(initial);

    // Simulate backend response reload
    const reloaded = parseWhatsAppTemplate(subjectJson, cleanBody);
    expect(reloaded.category).toBe("MARKETING");
    expect(reloaded.language).toBe("en_US");
    expect(reloaded.header.type).toBe("IMAGE");
    expect(reloaded.header.mediaUrl).toBe("https://example.com/hero.png");
    expect(reloaded.body).toBe("Hey {{customer_name}}, use code {{promo_code}} for 30% off!");
    expect(reloaded.footer).toBe("Valid until Sunday");
    expect(reloaded.buttons.length).toBe(2);
    expect(reloaded.buttons[0].text).toBe("Claim Now");
    expect(reloaded.buttons[1].phoneNumber).toBe("+917806030359");
  });

  // 8. Preview generation without altering structured data
  it("should generate a human-readable preview without mutating structured state", () => {
    const data: WhatsAppTemplateData = {
      name: "Preview Test",
      category: "MARKETING",
      language: "en_US",
      header: {
        type: "IMAGE",
        mediaUrl: "https://example.com/preview.png",
      },
      body: "Exclusive preview body for {{name}}.",
      footer: "Footer notes",
      buttons: [
        {
          id: "b1",
          type: "URL",
          text: "Visit Website",
          url: "https://example.com",
        },
      ],
    };

    const preview = generateWhatsAppPreview(data);
    expect(preview).toContain("[IMAGE: https://example.com/preview.png]");
    expect(preview).toContain("Exclusive preview body for {{name}}.");
    expect(preview).toContain("_Footer notes_");
    expect(preview).toContain("👉 Visit Website: https://example.com");

    // Ensure compileWhatsAppMessage retains only clean body
    const bodyForStorage = compileWhatsAppMessage(data);
    expect(bodyForStorage).toBe("Exclusive preview body for {{name}}.");
    expect(bodyForStorage).not.toContain("[IMAGE:");
    expect(bodyForStorage).not.toContain("👉");
  });
});
