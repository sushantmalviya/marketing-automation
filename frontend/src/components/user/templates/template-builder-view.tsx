"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Save,
  Eye,
  Mail,
  MessageCircle,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient, parseApiError } from "@/services/api-client";
import { EmailBlock } from "./types";
import { getDefaultBlocks, serializeBlocksToHtml, parseHtmlToBlocks } from "./html-serializer";
import { EmailBuilder } from "./email-builder";
import { EmailPreviewModal } from "./email-builder/email-preview-modal";
import { SMSEditor } from "./channel-editors/sms-editor";
import { VariableDropdown } from "./email-builder/variable-dropdown";
import { WhatsAppTemplateBuilder } from "./whatsapp-builder";
import {
  WhatsAppTemplateData,
  DEFAULT_WHATSAPP_TEMPLATE,
} from "./whatsapp-builder/whatsapp-types";
import {
  serializeWhatsAppMetadata,
  compileWhatsAppMessage,
  parseWhatsAppTemplate,
} from "./whatsapp-builder/whatsapp-serializer";

interface Channel {
  id: number;
  name: string;
}

interface TemplateData {
  id?: number;
  name: string;
  channel: number;
  channel_name?: string;
  subject?: string;
  body: string;
  status?: string;
}

interface TemplateBuilderViewProps {
  initialData?: TemplateData | null;
  channels: Channel[];
  onClose: () => void;
  onSuccess: () => void;
}

export function TemplateBuilderView({
  initialData,
  channels,
  onClose,
  onSuccess,
}: TemplateBuilderViewProps) {
  const isEditing = !!initialData?.id;

  // Determine initial channel
  const [selectedChannelId, setSelectedChannelId] = useState<string>(() => {
    if (initialData?.channel) return String(initialData.channel);
    // Default to Email channel if available
    const emailCh = channels.find((c) => c.name.toUpperCase().includes("EMAIL"));
    return emailCh ? String(emailCh.id) : (channels[0]?.id ? String(channels[0].id) : "");
  });

  const [name, setName] = useState(initialData?.name || "");
  const [subject, setSubject] = useState(initialData?.subject || "");
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Email blocks state
  const [blocks, setBlocks] = useState<EmailBlock[]>(() => {
    if (initialData?.body && selectedChannelId) {
      const chName = channels.find((c) => String(c.id) === selectedChannelId)?.name || "";
      if (chName.toUpperCase().includes("EMAIL")) {
        return parseHtmlToBlocks(initialData.body);
      }
    }
    return getDefaultBlocks();
  });

  // Plain text body state for SMS
  const [textBody, setTextBody] = useState<string>(() => {
    if (initialData?.body) return initialData.body;
    return "";
  });

  const activeChannel = channels.find((c) => String(c.id) === selectedChannelId);
  const activeChannelName = (
    activeChannel?.name ||
    initialData?.channel_name ||
    ""
  ).toUpperCase();
  const isEmail = activeChannelName.includes("EMAIL");
  const isWhatsApp = activeChannelName.includes("WHATSAPP");
  const isSMS = activeChannelName.includes("SMS");

  // WhatsApp structured template state
  const [whatsappData, setWhatsappData] = useState<WhatsAppTemplateData>(() => {
    if (initialData) {
      const chName = (
        initialData.channel_name ||
        channels.find((c) => String(c.id) === String(initialData.channel))?.name ||
        ""
      ).toUpperCase();
      if (chName.includes("WHATSAPP")) {
        const parsed = parseWhatsAppTemplate(initialData.subject, initialData.body);
        return { ...parsed, name: initialData.name || "" };
      }
    }
    return { ...DEFAULT_WHATSAPP_TEMPLATE, name: initialData?.name || "" };
  });

  const handleWhatsAppChange = (updated: WhatsAppTemplateData) => {
    setWhatsappData(updated);
    if (updated.name !== name) {
      setName(updated.name);
    }
    setIsDirty(true);
  };

  useEffect(() => {
    if (isWhatsApp) {
      setWhatsappData((prev) => (prev.name !== name ? { ...prev, name } : prev));
    }
  }, [name, isWhatsApp]);

  // Track if dirty for unsaved warning
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setIsDirty(true);
  }, [name, subject, blocks, textBody, whatsappData]);

  const handleClose = () => {
    if (isDirty) {
      if (confirm("You have unsaved changes. Are you sure you want to leave?")) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Please enter a template name");
      return;
    }
    if (!selectedChannelId) {
      toast.error("Please select a communication channel");
      return;
    }
    if (isEmail && !subject.trim()) {
      toast.error("Email templates require a subject line");
      return;
    }

    let finalBody = "";
    let finalSubject = "";

    if (isEmail) {
      finalBody = serializeBlocksToHtml(blocks);
      finalSubject = subject.trim();
    } else if (isWhatsApp) {
      if (!whatsappData.body?.trim()) {
        toast.error("Please enter WhatsApp message body content");
        return;
      }
      finalSubject = serializeWhatsAppMetadata(whatsappData);
      finalBody = compileWhatsAppMessage(whatsappData);
    } else {
      if (!textBody.trim()) {
        toast.error("Please enter message body content");
        return;
      }
      finalBody = textBody.trim();
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        channel: Number(selectedChannelId),
        subject: finalSubject,
        body: finalBody,
        status: "ACTIVE",
      };

      if (isEditing && initialData?.id) {
        await apiClient.patch(`/api/templates/${initialData.id}`, payload);
        toast.success("Template updated successfully");
      } else {
        await apiClient.post("/api/templates/create/", payload);
        toast.success("Template created successfully");
      }

      setIsDirty(false);
      onSuccess();
    } catch (err) {
      toast.error(parseApiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="-m-4 sm:-m-6 lg:-m-8 flex flex-col min-h-[calc(100vh-64px)] bg-slate-50 text-slate-900"
    >
      {/* Top Navigation Bar */}
      <header className="sticky top-[64px] z-20 border-b border-slate-200 bg-white/95 px-6 py-3.5 backdrop-blur-md shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition shadow-xs"
            >
              <ArrowLeft size={15} />
              <span>Back to Templates</span>
            </button>

            <div className="h-6 w-px bg-slate-200"></div>

            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
              <Sparkles size={13} />
              <span>{isEmail ? "Email Builder" : isWhatsApp ? "WhatsApp Builder" : isSMS ? "SMS Editor" : "Template Editor"}</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Channel Switcher */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400">Channel:</span>
              <select
                value={selectedChannelId}
                disabled={isEditing}
                onChange={(e) => setSelectedChannelId(e.target.value)}
                className="sa-input py-1.5 text-xs font-semibold disabled:bg-slate-100 disabled:text-slate-500"
              >
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Email Preview Button */}
            {isEmail && (
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-blue-300 transition shadow-xs"
              >
                <Eye size={15} className="text-blue-600" />
                <span>Full Preview</span>
              </button>
            )}

            {/* Save Button */}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="primary-button flex items-center gap-2 px-5 py-2 text-xs font-bold shadow-md"
            >
              <Save size={15} />
              <span>{saving ? "Saving..." : isEditing ? "Save Changes" : "Save Template"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Area according to Channel */}
      <main className="flex-1 p-4 sm:p-6 w-full max-w-full">
        {isEmail ? (
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Clean Page Title & Subtitle */}
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {isEditing ? "Edit Email Template" : "Create Email Template"}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Create a professional marketing email template for your subscribers and campaigns
              </p>
            </div>

            {/* Clearly Separated Fields: Template Name & Email Subject */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Template Name Field */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
                    <span>Template Name</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Summer Sale Campaign"
                    className="sa-input w-full text-sm font-medium py-2 px-3.5"
                  />
                  <p className="text-[11px] text-slate-400">
                    Internal template name for organizing campaigns and workflows
                  </p>
                </div>

                {/* 2. Email Subject Field with Variable Tag Support */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
                      <Mail size={13} className="text-blue-600" />
                      <span>Email Subject</span>
                      <span className="text-red-500">*</span>
                    </label>
                    <VariableDropdown
                      size="sm"
                      onInsert={(tag) => setSubject((prev) => (prev ? `${prev} ${tag}` : tag))}
                    />
                  </div>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. {{first_name}}, Don't Miss Our Summer Sale!"
                    className="sa-input w-full text-sm font-medium py-2 px-3.5"
                  />
                  {/* Quick Personalization Chips */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Personalize:</span>
                    {[
                      { label: "+ First Name", val: "{{first_name}}" },
                      { label: "+ Last Name", val: "{{last_name}}" },
                      { label: "+ Company", val: "{{company}}" },
                      { label: "+ Email", val: "{{email}}" },
                    ].map((chip) => (
                      <button
                        key={chip.val}
                        type="button"
                        onClick={() => setSubject((prev) => (prev ? `${prev} ${chip.val}` : chip.val))}
                        className="text-[11px] font-medium text-slate-600 hover:text-blue-700 bg-slate-100 hover:bg-blue-50 px-2 py-0.5 rounded-md border border-slate-200 transition"
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Email Body Section Title */}
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Email Body
                  </h2>
                  <p className="text-xs text-slate-400">
                    Design your email visually using drag-and-drop content blocks below
                  </p>
                </div>
              </div>

              {/* The Visual Email Builder */}
              <EmailBuilder blocks={blocks} setBlocks={setBlocks} />
            </div>
          </div>
        ) : isWhatsApp ? (
          <WhatsAppTemplateBuilder
            data={whatsappData}
            onChange={handleWhatsAppChange}
            isEditing={isEditing}
          />
        ) : isSMS ? (
          <div className="sa-card p-6 sm:p-8 max-w-5xl mx-auto shadow-sm space-y-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-1">
                {isEditing ? "Edit SMS Template" : "Create SMS Template"}
              </h2>
              <p className="text-xs text-slate-500">Configure your SMS marketing message</p>
            </div>
            <div className="field">
              <label>Template Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Flash Sale SMS"
                className="sa-input"
              />
            </div>
            <SMSEditor value={textBody} onChange={setTextBody} />
          </div>
        ) : (
          <div className="sa-card p-8 max-w-3xl mx-auto space-y-4">
            <div className="field">
              <label>Template Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Template Name"
                className="sa-input"
              />
            </div>
            <div className="field">
              <label>Message Content</label>
              <textarea
                rows={8}
                value={textBody}
                onChange={(e) => setTextBody(e.target.value)}
                className="sa-input"
              />
            </div>
          </div>
        )}
      </main>

      {/* Full Email Preview Modal */}
      {previewOpen && (
        <EmailPreviewModal
          subject={subject}
          blocks={blocks}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </motion.div>
  );
}
