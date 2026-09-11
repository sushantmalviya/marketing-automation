"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, CheckCircle2, AlertCircle, Loader2, ArrowRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { apiClient, parseApiError } from "@/services/api-client";

type ProviderType = "GMAIL" | "MICROSOFT" | "YAHOO" | "CUSTOM_SMTP";

interface ConnectEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ConnectEmailModal({ isOpen, onClose, onSuccess }: ConnectEmailModalProps) {
  const [provider, setProvider] = useState<ProviderType>("GMAIL");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states
  const [form, setForm] = useState({
    email: "",
    display_name: "",
    host: "",
    port: 587,
    security: "STARTTLS",
    username: "",
    password: "",
  });

  if (!isOpen) return null;

  function selectProvider(p: ProviderType) {
    setProvider(p);
    if (p === "YAHOO") {
      setForm((prev) => ({
        ...prev,
        host: "smtp.mail.yahoo.com",
        port: 465,
        security: "SSL/TLS",
      }));
    } else if (p === "CUSTOM_SMTP") {
      setForm((prev) => ({
        ...prev,
        host: "",
        port: 587,
        security: "STARTTLS",
      }));
    }
  }

  async function handleGoogleConnect() {
    try {
      setSaving(true);
      const res = await apiClient.get("/api/communications/sender-identities/oauth/google/url/");
      if (res.data?.url) {
        window.location.href = res.data.url;
      }
    } catch (err) {
      toast.error(parseApiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleMicrosoftConnect() {
    try {
      setSaving(true);
      const res = await apiClient.get("/api/communications/sender-identities/oauth/microsoft/url/");
      if (res.data?.url) {
        window.location.href = res.data.url;
      }
    } catch (err) {
      toast.error(parseApiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleTestSMTP() {
    if (!form.host || !form.username || !form.password) {
      toast.error("Host, Username, and Password are required to test connection.");
      return;
    }
    setTesting(true);
    try {
      const res = await apiClient.post("/api/communications/sender-identities/test-smtp/", {
        ...form,
        provider,
      });
      if (res.data?.success) {
        toast.success("Connection test successful!");
      } else {
        toast.error(res.data?.message || "Connection test failed.");
      }
    } catch (err) {
      toast.error(parseApiError(err));
    } finally {
      setTesting(false);
    }
  }

  async function handleConnectSMTP() {
    if (!form.email || !form.host || !form.username || !form.password) {
      toast.error("Please fill out all required fields.");
      return;
    }
    setSaving(true);
    try {
      await apiClient.post("/api/communications/sender-identities/connect-smtp/", {
        ...form,
        provider,
      });
      toast.success("Email account connected successfully!");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(parseApiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                <Mail size={18} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">Connect Sender Email</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Choose provider & configure credentials</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5">
            {/* Provider Tabs */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Connection Method
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { id: "GMAIL", label: "Gmail", icon: "🔴" },
                  { id: "MICROSOFT", label: "Outlook", icon: "🔷" },
                  { id: "YAHOO", label: "Yahoo", icon: "🟣" },
                  { id: "CUSTOM_SMTP", label: "Custom SMTP", icon: "⚙️" },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => selectProvider(p.id as ProviderType)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-semibold transition-all ${
                      provider === p.id
                        ? "border-blue-600 bg-blue-50/50 text-blue-600 dark:border-blue-500 dark:bg-blue-500/10 dark:text-blue-400"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span className="text-base">{p.icon}</span>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Provider Views */}
            {provider === "GMAIL" && (
              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  Connect your Google Workspace or personal Gmail account securely using Google OAuth 2.0.
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <ShieldCheck size={16} className="text-emerald-500" /> Minimum required permissions (`gmail.send`) requested.
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleGoogleConnect}
                  className="flex w-full items-center justify-center gap-3 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {saving ? <Loader2 className="animate-spin" size={18} /> : null}
                  Connect with Google <ArrowRight size={16} />
                </button>
              </div>
            )}

            {provider === "MICROSOFT" && (
              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  Connect your Microsoft 365 or Outlook.com account using Microsoft Graph OAuth 2.0.
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <ShieldCheck size={16} className="text-emerald-500" /> Uses Microsoft Graph `Mail.Send` permission.
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleMicrosoftConnect}
                  className="flex w-full items-center justify-center gap-3 rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-blue-800 transition disabled:opacity-50"
                >
                  {saving ? <Loader2 className="animate-spin" size={18} /> : null}
                  Connect with Microsoft <ArrowRight size={16} />
                </button>
              </div>
            )}

            {(provider === "YAHOO" || provider === "CUSTOM_SMTP") && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Sender Email *
                    </label>
                    <input
                      type="email"
                      placeholder="user@example.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      placeholder="John Smith"
                      value={form.display_name}
                      onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      SMTP Host *
                    </label>
                    <input
                      type="text"
                      placeholder="smtp.example.com"
                      value={form.host}
                      onChange={(e) => setForm({ ...form, host: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Port *
                    </label>
                    <input
                      type="number"
                      value={form.port}
                      onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 587 })}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Username / Email *
                    </label>
                    <input
                      type="text"
                      placeholder="user@example.com"
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {provider === "YAHOO" ? "App Password *" : "Password / App Password *"}
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••••••"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Security / Encryption
                  </label>
                  <select
                    value={form.security}
                    onChange={(e) => setForm({ ...form, security: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="STARTTLS">STARTTLS (Port 587)</option>
                    <option value="SSL/TLS">SSL / TLS (Port 465)</option>
                    <option value="NONE">None / Plain (Port 25)</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    disabled={testing}
                    onClick={handleTestSMTP}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    {testing ? <Loader2 className="animate-spin" size={14} /> : null}
                    Test Connection
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleConnectSMTP}
                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="animate-spin" size={14} /> : null}
                    Connect
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
