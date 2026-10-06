"use client";

import React from "react";
import { SmsTemplateBuilder } from "../sms-builder";
import { SmsTemplateData } from "../sms-builder/sms-types";

interface SMSEditorProps {
  value: string;
  onChange: (val: string) => void;
  name?: string;
}

export function SMSEditor({ value, onChange, name = "SMS Template" }: SMSEditorProps) {
  const data: SmsTemplateData = {
    name,
    category: "PROMOTIONAL",
    description: "",
    body: value,
  };

  return (
    <SmsTemplateBuilder
      data={data}
      onChange={(updated) => onChange(updated.body)}
    />
  );
}

export { SmsTemplateBuilder };
