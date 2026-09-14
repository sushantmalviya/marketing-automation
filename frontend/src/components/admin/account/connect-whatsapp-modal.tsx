"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MessageSquare, Loader2, ShieldCheck, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { apiClient, parseApiError } from "@/services/api-client";

interface ConnectWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ConnectWhatsAppModal({ isOpen, onClose, onSuccess }: ConnectWhatsAppModalProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    phone_number: "",
    display_name: "",
    phone_number_id: "",
    waba_id: "",
    access_token: "",
  });

  if (!isOpen) return null;

  async function handleConnect() {
    if (!form.phone_number || !form.phone_number_id || !form.access_token) {
      toast.error("Phone number, Phone Number ID, and Access Token are required.");
      return;
    }
    setSaving(true);
    try {
      await apiClient.post("/api/communications/sender-identities/connect-whatsapp/", form);
      toast.success("WhatsApp Business Account connected successfully!");
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
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                <MessageSquare size={18} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">Connect WhatsApp Account</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Meta WhatsApp Cloud API setup</p>
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
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50/60 p-3 text-xs text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
              <ShieldCheck size={16} className="shrink-0 text-emerald-600" />
              <span>Connect your official WhatsApp Business Cloud API to send automated messages.</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  WhatsApp Phone Number *
                </label>
                <input
                  type="text"
                  placeholder="+15551234567"
                  value={form.phone_number}
                  onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  placeholder="Customer Support"
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Phone Number ID *
                </label>
                <input
                  type="text"
                  placeholder="1092837465019"
                  value={form.phone_number_id}
                  onChange={(e) => setForm({ ...form, phone_number_id: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  WhatsApp Business Account ID (WABA ID)
                </label>
                <input
                  type="text"
                  placeholder="9823471092834"
                  value={form.waba_id}
                  onChange={(e) => setForm({ ...form, waba_id: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Permanent Access Token *
              </label>
              <textarea
                rows={3}
                placeholder="EAAG..."
                value={form.access_token}
                onChange={(e) => setForm({ ...form, access_token: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <a
                href="https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline dark:text-emerald-400"
              >
                Meta Developer Docs <ExternalLink size={12} />
              </a>
              <button
                type="button"
                disabled={saving}
                onClick={handleConnect}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-blue-700 transition disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin" size={14} /> : null}
                Connect WhatsApp
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
