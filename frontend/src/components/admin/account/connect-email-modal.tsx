"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Mail, CheckCircle2, AlertCircle, Loader2, ArrowRight,
  ShieldCheck, Copy, Check, ChevronDown, ChevronUp, Globe, Send
} from "lucide-react";
import { toast } from "sonner";
import { apiClient, parseApiError } from "@/services/api-client";

type Step = 1 | 2 | 3 | 4 | 5 | 6;
type ProviderType = "GMAIL" | "MICROSOFT" | "CUSTOM_SMTP";

interface ConnectEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialDomain?: string;
}

interface DomainAuthRecord {
  id: string;
  domain: string;
  verification_token: string;
  dns_record_type: string;
  dns_record_name: string;
  dns_record_value: string;
  status: "PENDING" | "VERIFIED" | "FAILED";
  verified_at?: string;
}

interface ConnectedIdentity {
  id: string;
  email: string;
  display_name: string;
  provider: string;
  status: string;
  domain: string;
}

export function ConnectEmailModal({ isOpen, onClose, onSuccess, initialDomain = "" }: ConnectEmailModalProps) {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  // Step 1 & 2: Domain verification state
  const [domainInput, setDomainInput] = useState(initialDomain);
  const [domainAuth, setDomainAuth] = useState<DomainAuthRecord | null>(null);

  // Step 4 & 5: Sender details state
  const [senderName, setSenderName] = useState("Marketing Team");
  const [senderEmail, setSenderEmail] = useState("");
  const [provider, setProvider] = useState<ProviderType>("CUSTOM_SMTP");

  // Step 5: SMTP state
  const [smtpForm, setSmtpForm] = useState({
    host: "",
    port: 587,
    security: "STARTTLS",
    username: "",
    password: "",
  });

  // Step 6: Connected Identity state
  const [connectedIdentity, setConnectedIdentity] = useState<ConnectedIdentity | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setDomainInput(initialDomain);
      setDomainAuth(null);
      setSenderName("Marketing Team");
      setSenderEmail("");
      setProvider("CUSTOM_SMTP");
      setSmtpForm({ host: "", port: 587, security: "STARTTLS", username: "", password: "" });
      setConnectedIdentity(null);
    }
  }, [isOpen, initialDomain]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(`Copied ${fieldName} to clipboard`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Step 1 Action: Add Domain
  const handleAddDomain = async () => {
    if (!domainInput || !domainInput.includes(".")) {
      toast.error("Please enter a valid company domain (e.g. company.com)");
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.post<DomainAuthRecord>("/api/communications/sender-domains/", {
        domain: domainInput,
      });
      const record = res.data;
      setDomainAuth(record);
      setSenderEmail(`marketing@${record.domain}`);
      setSmtpForm((prev) => ({
        ...prev,
        host: `smtp.${record.domain}`,
        username: `marketing@${record.domain}`,
      }));

      if (record.status === "VERIFIED") {
        setStep(3); // Jump to Domain Verified!
      } else {
        setStep(2); // Go to Verify Domain TXT instructions
      }
    } catch (err) {
      toast.error(parseApiError(err));
    } finally {
      setLoading(false);
    }
  };

  // Step 2 Action: Trigger backend DNS check
  const handleVerifyDNS = async () => {
    if (!domainAuth) return;
    setLoading(true);
    try {
      const res = await apiClient.post(`/api/communications/sender-domains/${domainAuth.id}/verify/`);
      if (res.data?.success) {
        toast.success("Domain ownership verified successfully!");
        setDomainAuth(res.data.domain);
        setStep(3);
      } else {
        toast.error(res.data?.detail || "DNS verification failed. Record not found yet.");
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail || parseApiError(err);
      toast.error(detail);
    } finally {
      setLoading(false);
    }
  };

  // Step 4 Action: Continue to connection method (Google/Microsoft OAuth or SMTP config)
  const handleProceedSender = async () => {
    if (!senderEmail || !senderEmail.includes("@")) {
      toast.error("Please enter a valid sender email address.");
      return;
    }

    const emailDomain = senderEmail.split("@")[1].toLowerCase();
    if (domainAuth && emailDomain !== domainAuth.domain.toLowerCase()) {
      toast.error(`Sender email must belong to your verified domain @${domainAuth.domain}`);
      return;
    }

    if (provider === "GMAIL") {
      setLoading(true);
      try {
        const res = await apiClient.get("/api/communications/sender-identities/oauth/google/url/");
        if (res.data?.url) {
          window.location.href = res.data.url;
        }
      } catch (err) {
        toast.error(parseApiError(err));
        setLoading(false);
      }
    } else if (provider === "MICROSOFT") {
      setLoading(true);
      try {
        const res = await apiClient.get("/api/communications/sender-identities/oauth/microsoft/url/");
        if (res.data?.url) {
          window.location.href = res.data.url;
        }
      } catch (err) {
        toast.error(parseApiError(err));
        setLoading(false);
      }
    } else {
      setStep(5);
    }
  };

  // Step 5 Action: Test SMTP Connection
  const handleTestSMTP = async () => {
    if (!smtpForm.host || !smtpForm.username || !smtpForm.password) {
      toast.error("SMTP Host, Username, and Password are required to test connection.");
      return;
    }
    setTesting(true);
    try {
      const res = await apiClient.post("/api/communications/sender-identities/test-smtp/", {
        email: senderEmail,
        display_name: senderName,
        provider: "CUSTOM_SMTP",
        ...smtpForm,
      });
      if (res.data?.success) {
        toast.success(res.data.message || "SMTP connection verified!");
      } else {
        toast.error(res.data?.message || "SMTP connection test failed.");
      }
    } catch (err) {
      toast.error(parseApiError(err));
    } finally {
      setTesting(false);
    }
  };

  // Step 5 Action: Save Sender
  const handleSaveSender = async () => {
    if (!senderEmail || !smtpForm.host || !smtpForm.username || !smtpForm.password) {
      toast.error("Please fill out all required SMTP configuration fields.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.post("/api/communications/sender-identities/connect-smtp/", {
        email: senderEmail,
        display_name: senderName,
        provider: "CUSTOM_SMTP",
        ...smtpForm,
      });
      setConnectedIdentity(res.data);
      toast.success("Sender email connected successfully!");
      setStep(6);
      onSuccess();
    } catch (err) {
      toast.error(parseApiError(err));
    } finally {
      setLoading(false);
    }
  };

  // Step 6 Action: Send Test Email
  const handleSendTestEmail = async () => {
    if (!connectedIdentity) return;
    const recipient = testRecipient || senderEmail;
    setSendingTest(true);
    try {
      await apiClient.post(`/api/communications/sender-identities/${connectedIdentity.id}/test-email/`, {
        recipient,
      });
      toast.success(`Test email sent successfully to ${recipient}`);
      setShowTestModal(false);
    } catch (err) {
      toast.error(parseApiError(err));
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          className="relative w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
        >
          {/* Modal Header & Step Indicator */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
                <Mail size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Sender Email Setup Flow</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Step {step} of 6 — Domain verification & email connection</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Step indicator pills */}
              <div className="hidden sm:flex items-center gap-1.5">
                {([1, 2, 3, 4, 5, 6] as Step[]).map((s) => (
                  <span
                    key={s}
                    className={`h-2 w-2 rounded-full transition-all ${
                      s === step
                        ? "w-6 bg-blue-600 dark:bg-blue-500"
                        : s < step
                        ? "bg-emerald-500"
                        : "bg-slate-200 dark:bg-slate-800"
                    }`}
                  />
                ))}
              </div>
              <button
                onClick={onClose}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Modal Body: Animated Step Container */}
          <div className="p-6 sm:p-8">

            {/* STEP 1: ADD YOUR DOMAIN */}
            {step === 1 && (
              <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Add Domain</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Enter your domain to verify ownership. This allows you to send marketing emails from your domain.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Domain
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="company.com"
                      value={domainInput}
                      onChange={(e) => setDomainInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddDomain()}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white pr-10"
                    />
                    <Globe size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500">e.g. company.com (without www)</p>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleAddDomain}
                    className="flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="animate-spin" size={16} /> : null}
                    Continue <ArrowRight size={16} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 2: VERIFY DOMAIN (TXT Record Instructions) */}
            {step === 2 && domainAuth && (
              <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Verify Domain Ownership</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Add the following TXT record to your domain's DNS settings for <strong className="text-slate-900 dark:text-white">{domainAuth.domain}</strong>.
                  </p>
                </div>

                {/* TXT Record Copy Table */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-800/50 space-y-4">
                  <div className="flex items-center justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Type</span>
                    <div className="flex items-center gap-2 font-mono text-xs font-bold text-slate-900 dark:text-white">
                      <span>{domainAuth.dns_record_type}</span>
                      <button
                        onClick={() => copyToClipboard(domainAuth.dns_record_type, "Type")}
                        className="rounded p-1 text-slate-400 hover:text-blue-600 transition"
                      >
                        {copiedField === "Type" ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Host / Name</span>
                    <div className="flex items-center gap-2 font-mono text-xs font-bold text-slate-900 dark:text-white">
                      <span>{domainAuth.dns_record_name}</span>
                      <button
                        onClick={() => copyToClipboard(domainAuth.dns_record_name, "Host")}
                        className="rounded p-1 text-slate-400 hover:text-blue-600 transition"
                      >
                        {copiedField === "Host" ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Value</span>
                    <div className="flex items-center gap-2 font-mono text-xs font-bold text-blue-600 dark:text-blue-400 max-w-[280px] truncate">
                      <span className="truncate">{domainAuth.dns_record_value}</span>
                      <button
                        onClick={() => copyToClipboard(domainAuth.dns_record_value, "Value")}
                        className="rounded p-1 text-slate-400 hover:text-blue-600 transition shrink-0"
                      >
                        {copiedField === "Value" ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Collapsible Helper Guide */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowGuide(!showGuide)}
                    className="flex w-full items-center justify-between p-4 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
                  >
                    <span>How to add this record?</span>
                    {showGuide ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {showGuide && (
                    <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 text-xs text-slate-600 dark:text-slate-300 border-t border-slate-200 dark:border-slate-800 space-y-2">
                      <p>1. Log in to your DNS provider (e.g. GoDaddy, Cloudflare, Namecheap, Route 53).</p>
                      <p>2. Navigate to DNS Management for <strong>{domainAuth.domain}</strong>.</p>
                      <p>3. Add a new record of type <strong>TXT</strong> with Host <strong>@</strong> and paste the Value above.</p>
                      <p>4. Save the record and click "I have added the record" below.</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 transition"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleVerifyDNS}
                    className="flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="animate-spin" size={14} /> : null}
                    I have added the record
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 3: DOMAIN VERIFIED */}
            {step === 3 && domainAuth && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6 space-y-6">
                <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                  <CheckCircle2 size={48} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Domain Verified!</h2>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    You can now add and configure sender emails for <strong className="text-slate-900 dark:text-white">{domainAuth.domain}</strong>.
                  </p>
                </div>

                <div className="pt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="flex items-center gap-2 rounded-2xl bg-blue-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition"
                  >
                    Add Sender Email <ArrowRight size={16} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 4: ADD SENDER EMAIL */}
            {step === 4 && (
              <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Add Sender Email</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Enter the email address you want to send emails from.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                      Sender Name
                    </label>
                    <input
                      type="text"
                      placeholder="Marketing Team"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      placeholder={`marketing@${domainAuth?.domain || "company.com"}`}
                      value={senderEmail}
                      onChange={(e) => setSenderEmail(e.target.value)}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                {/* Connection Method Picker */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Connection Method
                  </label>
                  <div className="space-y-2.5">
                    {[
                      {
                        id: "GMAIL",
                        label: "Google Workspace",
                        sub: "Securely connect with Google OAuth 2.0",
                        icon: "🔴",
                      },
                      {
                        id: "MICROSOFT",
                        label: "Microsoft 365",
                        sub: "Connect with Microsoft Graph Mail.Send",
                        icon: "🔷",
                      },
                      {
                        id: "CUSTOM_SMTP",
                        label: "Custom SMTP",
                        sub: "Use your own SMTP server details",
                        icon: "⚙️",
                      },
                    ].map((m) => (
                      <label
                        key={m.id}
                        onClick={() => setProvider(m.id as ProviderType)}
                        className={`flex items-center justify-between rounded-2xl border p-4 cursor-pointer transition-all ${
                          provider === m.id
                            ? "border-blue-600 bg-blue-50/60 dark:border-blue-500 dark:bg-blue-500/10 shadow-sm"
                            : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/60"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{m.icon}</span>
                          <div>
                            <div className="text-sm font-bold text-slate-900 dark:text-white">{m.label}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{m.sub}</div>
                          </div>
                        </div>
                        <input
                          type="radio"
                          name="connection_method"
                          checked={provider === m.id}
                          onChange={() => setProvider(m.id as ProviderType)}
                          className="h-4 w-4 text-blue-600"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 transition"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleProceedSender}
                    className="flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="animate-spin" size={14} /> : null}
                    Continue <ArrowRight size={14} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 5: CONFIGURE SMTP */}
            {step === 5 && (
              <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">SMTP Configuration</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Enter the SMTP details provided by your IT team or email provider.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      SMTP Host *
                    </label>
                    <input
                      type="text"
                      placeholder={`smtp.${domainAuth?.domain || "company.com"}`}
                      value={smtpForm.host}
                      onChange={(e) => setSmtpForm({ ...smtpForm, host: e.target.value })}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Port *
                    </label>
                    <input
                      type="number"
                      value={smtpForm.port}
                      onChange={(e) => setSmtpForm({ ...smtpForm, port: parseInt(e.target.value) || 587 })}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Security / Encryption
                  </label>
                  <select
                    value={smtpForm.security}
                    onChange={(e) => setSmtpForm({ ...smtpForm, security: e.target.value })}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="STARTTLS">STARTTLS (Port 587)</option>
                    <option value="SSL/TLS">SSL / TLS (Port 465)</option>
                    <option value="NONE">None / Plain (Port 25)</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Username *
                    </label>
                    <input
                      type="text"
                      placeholder={senderEmail}
                      value={smtpForm.username}
                      onChange={(e) => setSmtpForm({ ...smtpForm, username: e.target.value })}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Password / App Password *
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••••••"
                      value={smtpForm.password}
                      onChange={(e) => setSmtpForm({ ...smtpForm, password: e.target.value })}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                {/* Test Connection Button */}
                <div className="pt-2 flex justify-center">
                  <button
                    type="button"
                    disabled={testing}
                    onClick={handleTestSMTP}
                    className="w-full sm:w-auto rounded-2xl border border-slate-200 bg-white px-6 py-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {testing ? <Loader2 className="animate-spin inline mr-2" size={14} /> : null}
                    Test Connection
                  </button>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 transition"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleSaveSender}
                    className="flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="animate-spin" size={14} /> : null}
                    Save Sender
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 6: SENDER EMAIL CONNECTED */}
            {step === 6 && connectedIdentity && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-4 space-y-6">
                <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                  <CheckCircle2 size={48} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Sender Email Connected!</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    <strong className="text-slate-900 dark:text-white">{connectedIdentity.email}</strong> has been configured and is ready to use for your campaigns.
                  </p>
                </div>

                {/* Identity Summary Card */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-800/40 text-left space-y-3">
                  <div className="flex items-center justify-between text-xs py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-500 dark:text-slate-400">Sender Name</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{connectedIdentity.display_name || senderName}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-500 dark:text-slate-400">Email Address</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{connectedIdentity.email}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-500 dark:text-slate-400">Provider</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{connectedIdentity.provider}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-500 dark:text-slate-400">Status</span>
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                      Active
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-1">
                    <span className="text-slate-500 dark:text-slate-400">Domain</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                      {connectedIdentity.domain || domainAuth?.domain} <ShieldCheck size={14} />
                    </span>
                  </div>
                </div>

                {/* Step 6 Action Buttons */}
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTestRecipient(connectedIdentity.email);
                      setShowTestModal(true);
                    }}
                    className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition"
                  >
                    <Send size={14} /> Send Test Email
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSuccess();
                      onClose();
                    }}
                    className="flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-blue-700 transition"
                  >
                    Go to Campaigns
                  </button>
                </div>
              </motion.div>
            )}

          </div>
        </motion.div>
      </div>

      {/* Test Email Sub-Dialog Modal */}
      {showTestModal && connectedIdentity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Send Test Email</h3>
              <button onClick={() => setShowTestModal(false)} className="rounded p-1 text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Send a test message from <strong>{connectedIdentity.email}</strong> to verify deliverability.
            </p>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                Recipient Email Address
              </label>
              <input
                type="email"
                placeholder={connectedIdentity.email}
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowTestModal(false)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sendingTest}
                onClick={handleSendTestEmail}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-md hover:bg-blue-700 disabled:opacity-50"
              >
                {sendingTest ? <Loader2 className="animate-spin" size={14} /> : null}
                Send Email
              </button>
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
