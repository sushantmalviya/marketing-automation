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
  ShieldCheck,
  CheckCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient, parseApiError } from "@/services/api-client";
import { EmailBlock } from "./types";
import { getDefaultBlocks, serializeBlocksToHtml, parseHtmlToBlocks } from "./html-serializer";
import { EmailBuilder } from "./email-builder";
import { EmailPreviewModal } from "./email-builder/email-preview-modal";
import { WhatsAppTemplateBuilder } from "./whatsapp-builder";
import { WhatsAppPreviewModal } from "./whatsapp-builder/whatsapp-preview-modal";
import {
  WhatsAppTemplateData,
  DEFAULT_WHATSAPP_TEMPLATE,
} from "./whatsapp-builder/whatsapp-types";
import {
  serializeWhatsAppMetadata,
  compileWhatsAppMessage,
  parseWhatsAppTemplate,
} from "./whatsapp-builder/whatsapp-serializer";
import {
  SmsTemplateBuilder,
  SmsPreviewModal,
  SmsTemplateData,
  DEFAULT_SMS_TEMPLATE,
  serializeSmsMetadata,
  compileSmsMessage,
  parseSmsTemplate,
} from "./sms-builder";

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
  provider_data?: {
    waba_id?: string;
    meta_template_id?: string;
    meta_template_name?: string;
    meta_status?: string;
    meta_rejection_reason?: string;
    submitted_at?: string;
    [key: string]: any;
  };
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
  const [providerData, setProviderData] = useState<TemplateData["provider_data"]>(initialData?.provider_data || {});
  const [syncingMeta, setSyncingMeta] = useState(false);

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

  // Plain text body state for generic fallback
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

  // SMS structured template state
  const [smsData, setSmsData] = useState<SmsTemplateData>(() => {
    if (initialData) {
      const chName = (
        initialData.channel_name ||
        channels.find((c) => String(c.id) === String(initialData.channel))?.name ||
        ""
      ).toUpperCase();
      if (chName.includes("SMS")) {
        return parseSmsTemplate(initialData.subject, initialData.body, initialData.name);
      }
    }
    return { ...DEFAULT_SMS_TEMPLATE, name: initialData?.name || "" };
  });

  const handleWhatsAppChange = (updated: WhatsAppTemplateData) => {
    setWhatsappData(updated);
    if (updated.name !== name) {
      setName(updated.name);
    }
    setIsDirty(true);
  };

  const handleSmsChange = (updated: SmsTemplateData) => {
    setSmsData(updated);
    if (updated.name !== name) {
      setName(updated.name);
    }
    setIsDirty(true);
  };

  useEffect(() => {
    if (isWhatsApp) {
      setWhatsappData((prev) => (prev.name !== name ? { ...prev, name } : prev));
    } else if (isSMS) {
      setSmsData((prev) => (prev.name !== name ? { ...prev, name } : prev));
    }
  }, [name, isWhatsApp, isSMS]);

  // Track if dirty for unsaved warning
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setIsDirty(true);
  }, [name, subject, blocks, textBody, whatsappData, smsData]);

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
    } else if (isSMS) {
      if (!smsData.body?.trim()) {
        toast.error("Please enter SMS message body content");
        return;
      }
      finalSubject = serializeSmsMetadata(smsData);
      finalBody = compileSmsMessage(smsData);
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
        await apiClient.patch(`/api/templates/${initialData.id}/`, payload);
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

  const [verifying, setVerifying] = useState(false);

  const handleSendForVerification = async () => {
    if (!name.trim()) {
      toast.error("Please enter a template name before sending for verification");
      return;
    }
    if (!isWhatsApp) {
      toast.error("Meta verification is only available for WhatsApp templates");
      return;
    }
    if (!whatsappData.body?.trim()) {
      toast.error("Please enter WhatsApp message body content");
      return;
    }

    setVerifying(true);
    try {
      let targetId = initialData?.id;

      // 1. If unsaved or dirty, save the template first
      const finalSubject = serializeWhatsAppMetadata(whatsappData);
      const finalBody = compileWhatsAppMessage(whatsappData);
      const payload = {
        name: name.trim(),
        channel: Number(selectedChannelId),
        subject: finalSubject,
        body: finalBody,
        status: "ACTIVE",
      };

      if (targetId) {
        await apiClient.patch(`/api/templates/${targetId}/`, payload);
      } else {
        const createRes = await apiClient.post<TemplateData>("/api/templates/create/", payload);
        targetId = createRes.data?.id;
      }

      if (!targetId) {
        throw new Error("Unable to resolve template ID for submission.");
      }

      // 2. Submit to Meta for approval (allow up to 60s for media download + resumable upload + Meta approval)
      const res = await apiClient.post<{ message: string; meta_status?: string; provider_data?: any }>(
        `/api/templates/${targetId}/submit-to-provider/`,
        {},
        { timeout: 60000 }
      );

      const metaStatus = res.data?.meta_status || res.data?.provider_data?.meta_status || "PENDING";
      const updatedProviderData = res.data?.provider_data || { meta_status: metaStatus };
      setProviderData(updatedProviderData);
      toast.success(`Template submitted to Meta! Status: ${metaStatus}`);
      setIsDirty(false);
      onSuccess();
    } catch (err: any) {
      if (err?.response?.data?.is_ambiguous || err?.response?.status === 504) {
        toast.warning("Submission timed out waiting for Meta. The template may have been created; please check status in the templates list.");
        setIsDirty(false);
        onSuccess();
      } else {
        toast.error(parseApiError(err));
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleSyncMetaStatus = async () => {
    const targetId = initialData?.id;
    if (!targetId) {
      toast.error("Save the template before checking Meta status");
      return;
    }
    setSyncingMeta(true);
    try {
      const res = await apiClient.post<{ message: string; meta_status?: string; provider_data?: any }>(
        `/api/templates/${targetId}/sync-provider-status/`
      );
      const newStatus = res.data?.meta_status || res.data?.provider_data?.meta_status || "UPDATED";
      if (res.data?.provider_data) {
        setProviderData(res.data.provider_data);
      } else {
        setProviderData((prev) => ({ ...prev, meta_status: newStatus }));
      }
      toast.success(res.data?.message || `Meta Status: ${newStatus}`);
    } catch (err: any) {
      toast.error(parseApiError(err));
    } finally {
      setSyncingMeta(false);
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
              <span>{isEmail ? "Email Builder" : isWhatsApp ? "WhatsApp Builder" : isSMS ? "SMS Builder" : "Template Editor"}</span>
            </span>

            {/* Meta Approval Status Badge & Sync in Header */}
            {isWhatsApp && isEditing && (
              <div className="flex items-center gap-2">
                {providerData?.meta_status === "APPROVED" ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-xs" title="Approved by Meta for live campaigns">
                    <CheckCircle size={13} className="text-emerald-600" />
                    <span>Meta Approved</span>
                  </span>
                ) : providerData?.meta_status === "PENDING" ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200 shadow-xs" title="Pending Meta Review">
                    <Clock size={13} className="text-amber-600 animate-pulse" />
                    <span>Pending Meta Review</span>
                  </span>
                ) : providerData?.meta_status === "REJECTED" ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-red-100 text-red-800 border border-red-200 shadow-xs" title={providerData?.meta_rejection_reason || "Rejected by Meta"}>
                    <AlertTriangle size={13} className="text-red-600" />
                    <span>Meta Rejected</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                    <span>Unsubmitted</span>
                  </span>
                )}

                {providerData?.meta_template_id && (
                  <button
                    type="button"
                    onClick={handleSyncMetaStatus}
                    disabled={syncingMeta}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-xs disabled:opacity-50"
                    title="Refresh latest approval status directly from Meta"
                  >
                    <RefreshCw size={12} className={syncingMeta ? "animate-spin text-blue-600" : "text-slate-500"} />
                    <span>{syncingMeta ? "Checking..." : "Sync Status"}</span>
                  </button>
                )}
              </div>
            )}
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

            {/* Email / SMS / WhatsApp Preview Button */}
            {(isEmail || isSMS || isWhatsApp) && (
              <button
                type="button"
                id="template-full-preview-btn"
                onClick={() => setPreviewOpen(true)}
                className={`flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs ${
                  isSMS ? "hover:border-indigo-300" : "hover:border-blue-300"
                }`}
              >
                <Eye size={15} className={isSMS ? "text-indigo-600" : "text-blue-600"} />
                <span>Full Preview</span>
              </button>
            )}

            {/* Submit for Meta Approval (WhatsApp) */}
            {isWhatsApp && (
              <button
                type="button"
                onClick={handleSendForVerification}
                disabled={verifying || saving}
                className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 hover:border-emerald-400 transition shadow-xs disabled:opacity-50"
                title="Submit template to Meta for official WhatsApp approval"
              >
                <ShieldCheck size={15} className="text-emerald-600" />
                <span>{verifying ? "Submitting to Meta..." : "Submit for Meta Approval"}</span>
              </button>
            )}

            {/* Save Button */}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || verifying}
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
          <div className="w-full max-w-7xl 2xl:max-w-[1560px] mx-auto space-y-6">
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
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1 h-5">
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
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1 h-5">
                    <Mail size={13} className="text-blue-600" />
                    <span>Email Subject</span>
                    <span className="text-red-500">*</span>
                  </label>
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
          <div className="space-y-4">
            {/* Meta Approval Notification Banners */}
            {isEditing && providerData?.meta_status === "APPROVED" && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-center justify-between text-emerald-900 text-xs shadow-xs">
                <div className="flex items-center gap-2.5">
                  <CheckCircle size={18} className="text-emerald-600 shrink-0" />
                  <span>
                    <strong>Meta Approved:</strong> This template is verified and approved by Meta (ID: <code className="font-mono bg-emerald-100 px-1.5 py-0.5 rounded text-emerald-800">{providerData.meta_template_id}</code>). It is ready for WhatsApp campaigns.
                  </span>
                </div>
              </div>
            )}

            {isEditing && providerData?.meta_status === "PENDING" && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center justify-between text-amber-900 text-xs shadow-xs">
                <div className="flex items-center gap-2.5">
                  <Clock size={18} className="text-amber-600 animate-pulse shrink-0" />
                  <span>
                    <strong>Under Review by Meta:</strong> Submission registered with Meta (Template ID: <code className="font-mono bg-amber-100 px-1.5 py-0.5 rounded text-amber-800">{providerData.meta_template_id}</code>). Meta approval typically completes within a few minutes.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSyncMetaStatus}
                  disabled={syncingMeta}
                  className="flex items-center gap-1 font-bold text-amber-900 bg-amber-200/80 hover:bg-amber-300 px-3 py-1.5 rounded-lg transition shrink-0 ml-3"
                >
                  <RefreshCw size={13} className={syncingMeta ? "animate-spin" : ""} />
                  <span>{syncingMeta ? "Checking..." : "Check Status"}</span>
                </button>
              </div>
            )}

            {isEditing && providerData?.meta_status === "REJECTED" && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3 text-red-900 text-xs shadow-xs">
                <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold text-red-800">Template was Rejected by Meta</p>
                  <p className="mt-1 text-red-700">
                    {providerData.meta_rejection_reason || "Meta rejected this template. Please review variable formats and WhatsApp commerce/messaging policies before resubmitting."}
                  </p>
                </div>
              </div>
            )}

            <WhatsAppTemplateBuilder
              data={whatsappData}
              onChange={handleWhatsAppChange}
              isEditing={isEditing}
            />
          </div>
        ) : isSMS ? (
          <SmsTemplateBuilder
            data={smsData}
            onChange={handleSmsChange}
            isEditing={isEditing}
          />
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
      {previewOpen && isEmail && (
        <EmailPreviewModal
          subject={subject}
          blocks={blocks}
          onClose={() => setPreviewOpen(false)}
        />
      )}

      {/* Full WhatsApp Preview Modal */}
      {previewOpen && isWhatsApp && (
        <WhatsAppPreviewModal
          template={{
            name,
            subject: serializeWhatsAppMetadata(whatsappData),
            body: compileWhatsAppMessage(whatsappData),
          }}
          onClose={() => setPreviewOpen(false)}
        />
      )}

      {/* Full SMS Preview Modal */}
      {previewOpen && isSMS && (
        <SmsPreviewModal
          template={{
            name,
            subject: serializeSmsMetadata(smsData),
            body: compileSmsMessage(smsData),
          }}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </motion.div>
  );
}
