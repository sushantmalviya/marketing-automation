export type SmsCategory =
  | "PROMOTIONAL"
  | "TRANSACTIONAL"
  | "NOTIFICATION"
  | "REMINDER"
  | "OTP";

export interface SmsCategoryOption {
  value: SmsCategory;
  label: string;
  description: string;
  badgeColor: string;
  iconName?: string;
}

export const SMS_CATEGORIES: SmsCategoryOption[] = [
  {
    value: "PROMOTIONAL",
    label: "Promotional",
    description: "Marketing offers, discounts, flash sales, and product announcements",
    badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  {
    value: "TRANSACTIONAL",
    label: "Transactional",
    description: "Order confirmations, receipts, invoices, and purchase records",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    value: "NOTIFICATION",
    label: "Notification",
    description: "Account alerts, delivery status, system notices, and policy updates",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    value: "REMINDER",
    label: "Reminder",
    description: "Appointment reminders, payment due dates, and schedule alerts",
    badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    value: "OTP",
    label: "OTP / Verification",
    description: "One-time security passwords, 2FA codes, and verification requests",
    badgeColor: "bg-rose-50 text-rose-700 border-rose-200",
  },
];

export type SmsHeaderType = "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";

export interface SmsHeader {
  type: SmsHeaderType;
  text?: string;
  mediaUrl?: string;
  mediaName?: string;
}

export type SmsButtonType =
  | "COUPON_CODE"
  | "URL"
  | "PHONE_NUMBER"
  | "QUICK_REPLY"
  | "BOOK_DEMO";

export interface SmsButton {
  id: string;
  type: SmsButtonType;
  text: string;
  url?: string;
  phoneNumber?: string;
  couponCode?: string;
}

export type SmsCtaType = "URL" | "PHONE" | "REPLY_KEYWORD";

export interface SmsCta {
  enabled: boolean;
  type: SmsCtaType;
  label?: string; // Optional label/prefix e.g. "Shop now", "Call support", "Opt-out"
  value: string; // URL, phone number, or keyword e.g. "https://example.com/sale", "+18005550199", "STOP"
}

export interface SmsTemplateData {
  name: string;
  category: SmsCategory;
  description?: string;
  header?: string; // Section B: Text header
  headerType?: SmsHeaderType; // Section B: Segmented header type (NONE, TEXT, IMAGE, VIDEO, DOCUMENT)
  mediaUrl?: string; // Section B: Uploaded/selected media asset URL
  mediaName?: string; // Section B: Media filename or label
  body: string; // Section C: Main message body (required)
  footer?: string; // Section C: Optional footer
  buttons?: SmsButton[]; // Optional action buttons
  cta?: SmsCta; // Section D: Supported CTA (URL / Phone)
}

export const DEFAULT_SMS_TEMPLATE: SmsTemplateData = {
  name: "",
  category: "PROMOTIONAL",
  description: "",
  header: "",
  headerType: "NONE",
  mediaUrl: "",
  mediaName: "",
  body: "",
  footer: "",
  buttons: [],
  cta: {
    enabled: false,
    type: "URL",
    label: "",
    value: "",
  },
};

export type SmsEncodingType = "GSM-7" | "UCS-2";

export interface SmsEncodingInfo {
  encoding: SmsEncodingType;
  charCount: number;
  gsmLength: number;
  segments: number;
  maxCharsPerSegment: number;
  charsRemainingInSegment: number;
  hasUnicode: boolean;
  unicodeChars: string[];
}

export interface SmsPresetExample {
  title: string;
  category: SmsCategory;
  description: string;
  body: string;
}

export const SMS_PRESET_EXAMPLES: SmsPresetExample[] = [
  {
    title: "Flash Sale Promo",
    category: "PROMOTIONAL",
    description: "Limited-time discount offer with promo code and link",
    body: "Hi {{first_name}}, our 48-hour Flash Sale is LIVE! ⚡ Get 25% off everything with code FLASH25. Shop now: https://example.com/flash Reply STOP to opt out.",
  },
  {
    title: "Order Shipped Update",
    category: "TRANSACTIONAL",
    description: "E-commerce order dispatch notification with tracking link",
    body: "Hello {{first_name}}, your order #84920 from {{company}} has shipped! Track your package here: https://example.com/track/84920. Thanks for shopping with us!",
  },
  {
    title: "Appointment Reminder",
    category: "REMINDER",
    description: "Friendly schedule reminder with confirmation options",
    body: "Hi {{first_name}}, this is a friendly reminder of your upcoming appointment with {{company}} tomorrow at 2:00 PM. Reply 1 to confirm or call {{phone}} to reschedule.",
  },
  {
    title: "Cart Abandonment",
    category: "PROMOTIONAL",
    description: "Encourage checkout completion with free shipping",
    body: "Hey {{first_name}}, you left some great items in your cart at {{company}}! 🛒 Complete your order today and get free shipping: https://example.com/cart",
  },
  {
    title: "Security Verification OTP",
    category: "OTP",
    description: "Time-sensitive one-time authentication code",
    body: "{{company}}: Your verification code is 492-108. It expires in 10 minutes. Do not share this code with anyone.",
  },
  {
    title: "Service Renewal Alert",
    category: "NOTIFICATION",
    description: "Subscription renewal reminder notice",
    body: "Hi {{first_name}}, your {{company}} plan renews in 3 days. Review your plan details or manage your billing here: https://example.com/billing. Questions? Contact support.",
  },
];
