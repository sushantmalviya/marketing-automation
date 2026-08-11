export type FieldType = 
  | "text" | "textarea" | "email" | "phone" | "number" | "date"
  | "radio" | "checkbox" | "dropdown"
  | "file" | "image" | "url" | "switch";

export type FieldWidth = "full" | "half" | "third";

export interface FormFieldData {
  id: string; // Unique identifier in the builder
  type: FieldType;
  label: string;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  defaultValue?: string;
  width: FieldWidth;
  options?: string[]; // for choice fields
}
