export type EmailBlockType =
  | "heading"
  | "text"
  | "image"
  | "button"
  | "link"
  | "divider"
  | "spacer"
  | "list"
  | "html";

export type FontFamilyType =
  | "system"
  | "sans"
  | "serif"
  | "mono";

export interface HeadingBlock {
  id: string;
  type: "heading";
  text: string;
  level: 1 | 2 | 3;
  align: "left" | "center" | "right";
  color: string;
  fontSize?: number;
  fontFamily?: FontFamilyType;
  fontWeight?: "normal" | "medium" | "semibold" | "bold";
  bold?: boolean;
  marginY?: number;
}

export interface TextBlock {
  id: string;
  type: "text";
  content: string;
  align: "left" | "center" | "right";
  color: string;
  fontSize?: number;
  fontFamily?: FontFamilyType;
  lineHeight?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export interface ImageBlock {
  id: string;
  type: "image";
  src: string;
  alt: string;
  linkUrl?: string;
  align: "left" | "center" | "right";
  width: number; // percentage (20 to 100)
  maxWidth?: number; // optional px constraint e.g. for logos
  borderRadius?: number;
  isLogo?: boolean;
  objectFit?: "contain" | "cover";
}

export interface ButtonBlock {
  id: string;
  type: "button";
  text: string;
  url: string;
  actionType?: "url" | "phone" | "email";
  phoneNumber?: string;
  emailAddress?: string;
  align: "left" | "center" | "right";
  bgColor: string;
  textColor: string;
  borderRadius?: number;
  fontSize?: number;
  fullWidth?: boolean;
  paddingY?: number;
  paddingX?: number;
}

export interface LinkBlock {
  id: string;
  type: "link";
  text: string;
  url: string;
  actionType?: "url" | "phone" | "email";
  phoneNumber?: string;
  emailAddress?: string;
  align: "left" | "center" | "right";
  color: string;
  fontSize?: number;
  fontFamily?: FontFamilyType;
  bold?: boolean;
  underline?: boolean;
}

export interface DividerBlock {
  id: string;
  type: "divider";
  style: "solid" | "dashed" | "dotted";
  color: string;
  thickness: number;
  marginY: number;
}

export interface SpacerBlock {
  id: string;
  type: "spacer";
  height: number;
}

export interface ListBlock {
  id: string;
  type: "list";
  listType: "bullet" | "number";
  items: string[];
  color: string;
  fontSize?: number;
  fontFamily?: FontFamilyType;
}

export interface HtmlBlock {
  id: string;
  type: "html";
  content: string;
}

export type EmailBlock =
  | HeadingBlock
  | TextBlock
  | ImageBlock
  | ButtonBlock
  | LinkBlock
  | DividerBlock
  | SpacerBlock
  | ListBlock
  | HtmlBlock;

export interface PersonalizationVariable {
  label: string;
  value: string;
  description?: string;
}

export const PERSONALIZATION_VARIABLES: PersonalizationVariable[] = [
  { label: "First Name", value: "{{first_name}}", description: "Customer's first name" },
  { label: "Last Name", value: "{{last_name}}", description: "Customer's last name" },
  { label: "Full Name", value: "{{name}}", description: "Full customer name" },
  { label: "Email", value: "{{email}}", description: "Customer email address" },
  { label: "Phone", value: "{{phone}}", description: "Customer phone number" },
  { label: "Company", value: "{{company}}", description: "Customer company name" },
  { label: "City", value: "{{city}}", description: "Customer location city" },
];
