"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MessageSquare, Loader2, ShieldCheck, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { apiClient, parseApiError } from "@/services/api-client";

interface ConnectSMSModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ConnectSMSModal({ isOpen, onClose, onSuccess }: ConnectSMSModalProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    phone_number: "",
    display_name: "",
    provider: "TWILIO_SMS",
    account_sid: "",
    auth_token: "",
  });

  if (!isOpen) return null;

  async function handleConnect() {
    if (!form.phone_number || !form.auth_token) {
      toast.error("Sender Phone/ID and Auth Token are required.");
      return;
    }
    setSaving(true);
    try {
      await apiClient.post("/api/communications/sender-identities/connect-sms/", form);
      toast.success("SMS Sender ID connected successfully!");
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
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400">
                <MessageSquare size={18} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">Connect SMS Sender ID</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Twilio or Custom SMS Gateway</p>
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
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-2 rounded-xl bg-purple-50/60 p-3 text-xs text-purple-800 dark:bg-purple-500/10 dark:text-purple-300">
              <ShieldCheck size={16} className="shrink-0 text-purple-600" />
              <span>Connect Twilio or custom SMS provider to send SMS alerts and notifications.</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                SMS Provider
              </label>
              <select
                value={form.provider}
                onChange={(e) => setForm({ ...form, provider: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-purple-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="TWILIO_SMS">Twilio SMS</option>
                <option value="CUSTOM_SMS">Custom SMS Gateway</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Sender Phone / Sender ID *
                </label>
                <input
                  type="text"
                  placeholder="+18005550199"
                  value={form.phone_number}
                  onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-purple-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  placeholder="Marketing SMS"
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-purple-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Account SID / API Key
              </label>
              <input
                type="text"
                placeholder="AC..."
                value={form.account_sid}
                onChange={(e) => setForm({ ...form, account_sid: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 shadow-sm focus:border-purple-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Auth Token / API Secret *
              </label>
              <input
                type="password"
                placeholder="••••••••••••••••••••••••"
                value={form.auth_token}
                onChange={(e) => setForm({ ...form, auth_token: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 shadow-sm focus:border-purple-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={saving}
                onClick={handleConnect}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-blue-700 transition disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin" size={14} /> : null}
                Connect SMS
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
