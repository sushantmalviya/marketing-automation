export type WhatsAppHeaderType = "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";

export interface WhatsAppHeader {
  type: WhatsAppHeaderType;
  text?: string;
  mediaUrl?: string;
  mediaName?: string;
  mediaSize?: number;
}

export type WhatsAppCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";

export interface WhatsAppCategoryOption {
  value: WhatsAppCategory;
  label: string;
  description: string;
}

export const WHATSAPP_CATEGORIES: WhatsAppCategoryOption[] = [
  {
    value: "MARKETING",
    label: "Marketing",
    description: "Promotions, special offers, product announcements, and newsletters",
  },
  {
    value: "UTILITY",
    label: "Utility",
    description: "Order confirmations, shipping updates, account alerts, and billing",
  },
  {
    value: "AUTHENTICATION",
    label: "Authentication",
    description: "One-time passwords, verification codes, and account security notices",
  },
];

export interface WhatsAppLanguageOption {
  code: string;
  name: string;
}

export const WHATSAPP_LANGUAGES: WhatsAppLanguageOption[] = [
  { code: "en_US", name: "English (US)" },
  { code: "en_GB", name: "English (UK)" },
  { code: "es", name: "Spanish" },
  { code: "pt_BR", name: "Portuguese (Brazil)" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "hi", name: "Hindi" },
  { code: "ar", name: "Arabic" },
  { code: "id", name: "Indonesian" },
  { code: "it", name: "Italian" },
  { code: "tr", name: "Turkish" },
  { code: "ru", name: "Russian" },
  { code: "ja", name: "Japanese" },
];

export type WhatsAppButtonType =
  | "COUPON_CODE"
  | "URL"
  | "PHONE_NUMBER"
  | "QUICK_REPLY"
  | "BOOK_DEMO";

export interface WhatsAppButton {
  id: string;
  type: WhatsAppButtonType;
  text: string;
  url?: string;
  phoneNumber?: string;
  couponCode?: string;
}

export interface WhatsAppTemplateData {
  name: string;
  category: WhatsAppCategory;
  language: string;
  header: WhatsAppHeader;
  body: string;
  footer: string;
  buttons: WhatsAppButton[];
}

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
