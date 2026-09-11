"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, Globe2, Lock, Palette, Save, UserRound, Sparkles,
  User as UserIcon, Mail, Phone, Calendar, Building2,
  ShieldCheck, UserCircle2, Briefcase, UserPlus, Pencil,
  Eye, EyeOff, ChevronDown, ChevronUp,
  Instagram, Facebook, Linkedin, Twitter, Info, Loader2
} from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth-provider";
import { parseApiError, apiClient } from "@/services/api-client";
import { superAdminService } from "@/services/super-admin.service";
import { DarkModeToggle } from "@/components/ui/dark-mode-toggle";

import { ConnectEmailModal } from "@/components/admin/account/connect-email-modal";
import { MessageSquare, ExternalLink, ChevronRight, CheckCircle2 } from "lucide-react";

function ProfileField({ icon: Icon, label, value, isEditingMode, isEditable, onChange }: any) {
  return (
    <div className="flex items-center gap-4 py-4 border-b border-slate-100 last:border-0 dark:border-white/5">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50/80 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
        <Icon size={18} />
      </div>
      <div className="w-[160px] shrink-0 text-sm font-medium text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="flex flex-1 items-center gap-3">
        {isEditingMode && isEditable ? (
          <input
            className="w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            value={value}
            onChange={onChange}
            readOnly={!onChange}
          />
        ) : (
          <div className="font-medium text-slate-900 dark:text-white">{value}</div>
        )}
      </div>
    </div>
  );
}

export function SuperAdminAccount() {
  const { user } = useAuth();
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [form, setForm] = useState({
    first_name: user?.first_name ?? "",
    last_name: user?.last_name ?? ""
  });

  const save = useMutation({
    mutationFn: () => superAdminService.updateProfile(form),
    onSuccess: () => {
      toast.success("Profile updated. Refreshing session data on next load.");
      setIsEditingMode(false);
    },
    onError: e => toast.error(parseApiError(e))
  });

  if (!user) return null;

  const isAdminOrAbove = user.role === "ADMIN" || user.role === "SUPER_ADMIN";

  const tabs = [
    { id: "profile", label: "Profile", icon: UserRound },
    { id: "security", label: "Security", icon: Lock },
    { id: "notifications", label: "Notifications", icon: Bell },
    ...(isAdminOrAbove ? [
      { id: "brand-identity", label: "Brand Identity", icon: Sparkles },
      { id: "connect-socials", label: "Connect Socials", icon: Globe2 },
      { id: "connect-sender-ids", label: "Connect Sender IDs", icon: Mail }
    ] : []),
  ];

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />LIVE WORKSPACE</span>
          <h1 className="sa-title mt-2 normal-case">Account Settings</h1>
          <p className="sa-subtitle mt-1">{user.role.replaceAll("_", " ")} · {user.email}</p>
        </div>
        <DarkModeToggle />
      </div>

      <section className="sa-card mt-7 grid overflow-hidden md:grid-cols-[245px_1fr]">
        <aside className="border-b border-slate-200 p-4 md:border-b-0 md:border-r dark:border-white/10">
          {tabs.map(t => (
            <button
              onClick={() => setActiveTab(t.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left ${activeTab === t.id ? "bg-blue-50 font-semibold text-blue-600 dark:bg-blue-500/10 dark:text-blue-400" : "text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5"}`}
              key={t.id}
            >
              <t.icon size={20} />
              {t.label}
            </button>
          ))}
        </aside>

        {/* ── Right column: all tab content panels ── */}
        <div className="min-w-0 overflow-y-auto">

          {activeTab === "profile" && (
            <motion.form
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-6 sm:p-10"
              onSubmit={e => { e.preventDefault(); save.mutate(); }}
            >
              <div className="mb-6">
                <h2 className="text-xl font-bold">Profile information</h2>
              </div>

              <div className="border border-slate-200 dark:border-white/10 rounded-2xl px-5">
                <ProfileField
                  icon={UserIcon}
                  label="First Name"
                  value={form.first_name}
                  isEditingMode={isEditingMode}
                  isEditable
                  onChange={(e: any) => setForm({ ...form, first_name: e.target.value })}
                />
                <ProfileField
                  icon={UserIcon}
                  label="Last Name"
                  value={form.last_name}
                  isEditingMode={isEditingMode}
                  isEditable
                  onChange={(e: any) => setForm({ ...form, last_name: e.target.value })}
                />
                <ProfileField
                  icon={Mail}
                  label="Email Address"
                  value={user.email}
                  isEditingMode={isEditingMode}
                  isEditable={false}
                />
                <ProfileField
                  icon={Phone}
                  label="Mobile Number"
                  value="+91 98765 43210"
                  isEditingMode={isEditingMode}
                  isEditable
                />
                <ProfileField
                  icon={Calendar}
                  label="Date of Joining"
                  value="15 Apr 2024"
                  isEditingMode={isEditingMode}
                  isEditable={false}
                />
                <ProfileField
                  icon={Calendar}
                  label="Date of Birth"
                  value="12 Jan 1998"
                  isEditingMode={isEditingMode}
                  isEditable
                />
                <ProfileField
                  icon={Building2}
                  label="Department"
                  value="Marketing"
                  isEditingMode={isEditingMode}
                  isEditable
                />
                <ProfileField
                  icon={ShieldCheck}
                  label="Role"
                  value={user.role.replaceAll("_", " ")}
                  isEditingMode={isEditingMode}
                  isEditable={false}
                />
                <ProfileField
                  icon={UserCircle2}
                  label="Admin"
                  value="Rohit Sharma"
                  isEditingMode={isEditingMode}
                  isEditable={false}
                />
                <ProfileField
                  icon={Briefcase}
                  label="Position"
                  value="Marketing Executive"
                  isEditingMode={isEditingMode}
                  isEditable
                />
                <ProfileField
                  icon={UserPlus}
                  label="Gender"
                  value="Male"
                  isEditingMode={isEditingMode}
                  isEditable
                />
              </div>

              <div className="mt-8 flex items-center gap-4">
                {!isEditingMode ? (
                  <button
                    type="button"
                    onClick={() => setIsEditingMode(true)}
                    className="primary-button bg-blue-600 px-6 hover:bg-blue-700"
                  >
                    <Pencil size={18} className="mr-2 inline" />
                    Edit profile
                  </button>
                ) : (
                  <>
                    <button
                      type="submit"
                      className="primary-button bg-blue-600 px-6 hover:bg-blue-700"
                      disabled={save.isPending}
                    >
                      <Save size={18} className="mr-2 inline" />
                      Save changes
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingMode(false)}
                      className="rounded-xl px-5 py-2.5 font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </motion.form>
          )}

          {activeTab === "security" && (
            <motion.div
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-6 sm:p-10"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Security Settings</h2>
              </div>

              <div className="border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setIsPasswordOpen(!isPasswordOpen)}
                  className="flex w-full items-center justify-between p-5 text-left font-semibold text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                  <span>Change Password</span>
                  {isPasswordOpen ? <ChevronUp size={20} className="text-slate-500" /> : <ChevronDown size={20} className="text-slate-500" />}
                </button>

                <AnimatePresence>
                  {isPasswordOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-5 border-t border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-900/50">
                        <div className="space-y-5">
                          <div>
                            <label className="mb-2 block text-sm font-medium text-slate-900 dark:text-white">Current Password</label>
                            <div className="relative">
                              <input type={showCurrent ? "text" : "password"} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white pr-10" />
                              <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                                {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                            <div>
                              <label className="mb-2 block text-sm font-medium text-slate-900 dark:text-white">New Password</label>
                              <div className="relative">
                                <input type={showNew ? "text" : "password"} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white pr-10" />
                                <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                                  {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                              </div>
                            </div>
                            <div>
                              <label className="mb-2 block text-sm font-medium text-slate-900 dark:text-white">Confirm Password</label>
                              <div className="relative">
                                <input type={showConfirm ? "text" : "password"} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white pr-10" />
                                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-end mt-6">
                            <button type="button" className="rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-emerald-700 shadow-sm" onClick={() => { toast.success("Password updated successfully."); setIsPasswordOpen(false); }}>
                              Save changes
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {activeTab === "notifications" && (
            <motion.div
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-6 sm:p-10"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Notification Preferences</h2>
              </div>

              <div className="space-y-6">
                {user.role === "USER" ? (
                  <div className="border border-slate-200 dark:border-white/10 rounded-2xl p-5 space-y-5">
                    <h3 className="font-semibold text-slate-900 dark:text-white">Tasks & Assignments</h3>

                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input type="checkbox" defaultChecked className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600 bg-white" />
                      <div>
                        <div className="font-medium text-slate-900 dark:text-white text-sm group-hover:text-blue-600 transition-colors">New Task Assigned</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">Get notified when an admin gives you a new task.</div>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input type="checkbox" defaultChecked className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600 bg-white" />
                      <div>
                        <div className="font-medium text-slate-900 dark:text-white text-sm group-hover:text-blue-600 transition-colors">Task Approved or Rejected</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">Get notified when an admin approves or rejects your task submission.</div>
                      </div>
                    </label>
                  </div>
                ) : (
                  <div className="text-sm text-slate-500 dark:text-slate-400">No notification preferences available for your role.</div>
                )}
              </div>

              <div className="mt-8 flex items-center gap-4">
                <button
                  type="button"
                  className="primary-button bg-blue-600 px-6 hover:bg-blue-700"
                  onClick={() => toast.success("Notification preferences saved.")}
                >
                  <Save size={18} className="mr-2 inline" />
                  Save preferences
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === "brand-identity" && isAdminOrAbove && <BrandIdentityTab />}
          {activeTab === "connect-socials" && isAdminOrAbove && <ConnectSocialsTab />}
          {activeTab === "connect-sender-ids" && isAdminOrAbove && <ConnectSenderIDsPanel />}

        </div>{/* end right column */}
      </section>
    </div>
  );
}

// ─── Brand Identity Tab ───────────────────────────────────────────────────────

type BrandIdentity = {
  brand_description: string;
  target_audience: string;
  tone: string;
  content_pillars: string;
  unique_value: string;
  guidelines: string;
  call_to_action: string;
};

const TONE_OPTIONS = [
  "Friendly", "Professional", "Bold", "Luxury", "Playful",
  "Educational", "Inspirational", "Witty", "Technical",
  "Trustworthy", "Casual", "Premium"
];

const EMPTY_BI: BrandIdentity = {
  brand_description: "",
  target_audience: "",
  tone: "",
  content_pillars: "",
  unique_value: "",
  guidelines: "",
  call_to_action: "",
};

function QuestionBlock({ label, hint, value, isEditingMode, placeholder, onChange }: any) {
  return (
    <div className="bi-question">
      <label className="bi-label">{label}</label>
      <p className="bi-hint">{hint}</p>
      {isEditingMode ? (
        <textarea
          rows={3}
          className="bi-textarea"
          placeholder={placeholder}
          value={value}
          onChange={onChange}
        />
      ) : (
        <div className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-200">
          {value || <span className="text-slate-400 italic">Not provided</span>}
        </div>
      )}
    </div>
  );
}

function BrandIdentityTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState<BrandIdentity>(EMPTY_BI);
  const [selectedTones, setSelectedTones] = useState<string[]>([]);
  const [isEditingMode, setIsEditingMode] = useState(false);

  // Fetch existing brand identity on mount
  useQuery({
    queryKey: ["brand-identity"],
    queryFn: async () => {
      const res = await apiClient.get<BrandIdentity>("/api/auth/brand-identity/");
      setForm(res.data);
      setSelectedTones(res.data.tone ? res.data.tone.split(", ").filter(Boolean) : []);

      const hasData = Object.values(res.data).some(v => typeof v === "string" && v.trim().length > 0);
      setIsEditingMode(!hasData);

      return res.data;
    },
  });

  const save = useMutation({
    mutationFn: () =>
      apiClient.put("/api/auth/brand-identity/", { ...form, tone: selectedTones.join(", ") }),
    onSuccess: () => {
      toast.success("Brand identity saved! AI will now use this to generate content.");
      setIsEditingMode(false);
      void qc.invalidateQueries({ queryKey: ["brand-identity"] });
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const toggleTone = (t: string) =>
    setSelectedTones(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : prev.length < 5 ? [...prev, t] : prev
    );

  const field = (key: keyof BrandIdentity) => (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  return (
    <motion.div
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      className="mt-6"
    >
      <div className="sa-card p-6 sm:p-10">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold dark:text-white">Brand Identity</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              These answers shape how the AI generates content, images, and captions for your brand.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 dark:bg-purple-500/10 dark:text-purple-400">
            <Sparkles size={13} /> AI-Powered
          </span>
        </div>

        <div className="space-y-8">
          <QuestionBlock
            label="1. What does your brand do?"
            hint="Describe your business, products, or services in 1–2 sentences."
            value={form.brand_description}
            isEditingMode={isEditingMode}
            placeholder="e.g. We are a fintech startup that simplifies personal budgeting for millennials..."
            onChange={field("brand_description")}
          />

          <QuestionBlock
            label="2. Who is your target audience?"
            hint="Include age, profession, interests, or industry if relevant."
            value={form.target_audience}
            isEditingMode={isEditingMode}
            placeholder="e.g. Working professionals aged 25–40 who are interested in personal finance..."
            onChange={field("target_audience")}
          />

          {/* Q3 – Tone chips */}
          <div className="bi-question">
            <label className="bi-label">3. How do you want your brand to sound on social media?</label>
            <p className="bi-hint">Choose up to 5 tones that represent your brand voice.</p>
            {isEditingMode ? (
              <>
                <div className="mt-3 flex flex-wrap gap-2">
                  {TONE_OPTIONS.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleTone(t)}
                      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-all ${selectedTones.includes(t)
                          ? "border-purple-500 bg-purple-600 text-white shadow-sm"
                          : "border-slate-200 bg-white text-slate-600 hover:border-purple-300 hover:bg-purple-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                        }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {selectedTones.length > 0 && (
                  <p className="mt-2 text-xs text-slate-500">Selected: {selectedTones.join(", ")}</p>
                )}
              </>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedTones.length > 0 ? (
                  selectedTones.map(t => (
                    <span key={t} className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-sm font-medium text-purple-700 dark:border-purple-500/20 dark:bg-purple-500/10 dark:text-purple-400">
                      {t}
                    </span>
                  ))
                ) : (
                  <span className="text-sm font-medium text-slate-400 italic">Not provided</span>
                )}
              </div>
            )}
          </div>

          <QuestionBlock
            label="4. What topics should your content focus on?"
            hint="List 3–5 content pillars or themes your brand regularly talks about."
            value={form.content_pillars}
            isEditingMode={isEditingMode}
            placeholder="e.g. Personal finance tips, Investment basics, Financial freedom stories..."
            onChange={field("content_pillars")}
          />

          <QuestionBlock
            label="5. What makes your brand different from competitors?"
            hint="What is your unique value or key message?"
            value={form.unique_value}
            isEditingMode={isEditingMode}
            placeholder="e.g. We are the only app with AI-powered budgeting that works offline..."
            onChange={field("unique_value")}
          />

          <QuestionBlock
            label="6. Are there any words, phrases, or styles the AI should always use or avoid?"
            hint="e.g. Avoid jargon, use simple language, don't use emojis, always sound optimistic."
            value={form.guidelines}
            isEditingMode={isEditingMode}
            placeholder="e.g. Always use 'grow your wealth' instead of 'get rich'. Never use slang."
            onChange={field("guidelines")}
          />

          <QuestionBlock
            label="7. What action should your social media posts encourage?"
            hint="e.g. Follow, Comment, Share, Visit Website, Book a Demo, Buy Now, Save the Post."
            value={form.call_to_action}
            isEditingMode={isEditingMode}
            placeholder="e.g. Visit our website to start your free trial."
            onChange={field("call_to_action")}
          />
        </div>

        <div className="mt-10 flex items-center gap-4 border-t border-slate-100 pt-8 dark:border-white/10">
          {isEditingMode ? (
            <>
              <button
                type="button"
                onClick={() => save.mutate()}
                disabled={save.isPending}
                className="primary-button bg-purple-600 px-8 hover:bg-purple-700"
              >
                <Save size={18} className="mr-2 inline" />
                {save.isPending ? "Saving…" : "Save Brand Identity"}
              </button>
              <button
                type="button"
                onClick={() => setIsEditingMode(false)}
                className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setIsEditingMode(true)}
                className="primary-button bg-white text-slate-700 border border-slate-200 px-8 hover:bg-slate-50 dark:bg-slate-800 dark:text-white dark:border-white/10 dark:hover:bg-slate-700"
              >
                <Pencil size={18} className="mr-2 inline" />
                Edit Brand Identity
              </button>
              <p className="text-xs text-slate-400">
                These settings are used by the AI every time content is generated.
              </p>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Connect Socials Tab ──────────────────────────────────────────────────────

function ConnectSocialsTab() {
  const [loading, setLoading] = useState<string | null>(null);
  const client = useQueryClient();

  const { data: connections, isLoading: loadingConnections } = useQuery({
    queryKey: ["social-connections"],
    queryFn: async () => {
      const res = await apiClient.get<any[]>("/api/integrations/social/connections/");
      return Array.isArray(res.data) ? res.data : ((res.data as any).results ?? []);
    }
  });

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/integrations/social/connections/${id}/`),
    onSuccess: () => {
      toast.success("Disconnected successfully");
      void client.invalidateQueries({ queryKey: ["social-connections"] });
      setLoading(null);
    },
    onError: (e) => {
      toast.error(parseApiError(e));
      setLoading(null);
    }
  });

  const connect = async (provider: string) => {
    try {
      setLoading(provider);
      const res = await apiClient.get<{ authorization_url: string }>(`/api/integrations/social/connections/connect/${provider}/`, {
        headers: { Accept: "application/json" }
      });
      if (res.data.authorization_url) {
        window.location.href = res.data.authorization_url;
      }
    } catch (e) {
      toast.error("Failed to initiate connection");
      setLoading(null);
    }
  };

  const disconnect = (provider: string, connectionId: string) => {
    setLoading(provider);
    disconnectMutation.mutate(connectionId);
  };

  const platforms = [
    { id: "instagram", name: "Instagram", icon: Instagram, color: "text-pink-600", bg: "bg-pink-50 dark:bg-pink-500/10", scope: "Requires basic profile & publishing access." },
    { id: "facebook", name: "Facebook", icon: Facebook, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-500/10", scope: "Requires page management & publishing access." },
    { id: "linkedin", name: "LinkedIn", icon: Linkedin, color: "text-blue-700", bg: "bg-blue-50 dark:bg-blue-500/10", scope: "Requires organization page management access." },
    { id: "x", name: "X (Twitter)", icon: Twitter, color: "text-slate-900 dark:text-white", bg: "bg-slate-100 dark:bg-white/5", scope: "Requires tweet scheduling & publishing access." },
  ].map(p => {
    const conn = (connections || []).find((c: any) => c.platform.toLowerCase() === p.id.toLowerCase());
    return {
      ...p,
      connected: !!conn,
      connectionId: conn?.id,
      username: conn?.account_name || "",
    };
  });

  return (
    <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} className="p-6 sm:p-10">
      <div className="mb-6">
        <h2 className="text-xl font-bold">Connect Socials</h2>
        <p className="mt-1 text-sm text-slate-500">Connect your social media accounts to enable direct publishing and analytics.</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {platforms.map(p => (
          <div key={p.id} className="border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <span className={`grid h-12 w-12 place-items-center rounded-xl ${p.bg} ${p.color}`}>
                  <p.icon size={24} />
                </span>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{p.name}</h3>
                  {p.connected ? (
                    <p className="text-sm text-slate-500">Connected as <span className="font-medium text-slate-900 dark:text-white">{p.username}</span></p>
                  ) : (
                    <p className="text-sm text-slate-500">Not Connected</p>
                  )}
                </div>
              </div>
              <div className="group relative">
                <Info size={16} className="text-slate-400 hover:text-slate-600 cursor-help" />
                <div className="absolute right-0 top-full mt-2 w-48 rounded-lg bg-slate-800 p-2 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none z-10 shadow-lg">
                  {p.scope}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              {p.connected ? (
                <button
                  onClick={() => p.connectionId && disconnect(p.id, p.connectionId)}
                  disabled={loading === p.id || disconnectMutation.isPending}
                  className="rounded-lg border border-slate-200 dark:border-white/10 px-5 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-500/10 dark:hover:text-red-400 dark:hover:border-red-500/20 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {loading === p.id && <Loader2 size={16} className="animate-spin" />}
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={() => connect(p.id)}
                  disabled={loading === p.id}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {loading === p.id && <Loader2 size={16} className="animate-spin" />}
                  Connect
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Connect Sender IDs Tab ───────────────────────────────────────────────────

function ConnectSenderIDsPanel() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: senderIdentities = [], isLoading } = useQuery({
    queryKey: ["sender-identities"],
    queryFn: async () => {
      const res = await apiClient.get<any[]>("/api/communications/sender-identities/");
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/communications/sender-identities/${id}/`),
    onSuccess: () => {
      toast.success("Sender email disconnected");
      void qc.invalidateQueries({ queryKey: ["sender-identities"] });
      setDeletingId(null);
    },
    onError: (err) => {
      toast.error(parseApiError(err));
      setDeletingId(null);
    },
  });

  const sendTestEmail = async (id: string, email: string) => {
    try {
      setTestingId(id);
      await apiClient.post(`/api/communications/sender-identities/${id}/test-email/`);
      toast.success(`Test email sent successfully from ${email}`);
      void qc.invalidateQueries({ queryKey: ["sender-identities"] });
    } catch (err) {
      toast.error(parseApiError(err));
    } finally {
      setTestingId(null);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} className="p-6 sm:p-10">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Connect Sender Email</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Connect your personal or Google Workspace / Outlook / SMTP email to send emails from your own domain.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-blue-700 transition"
        >
          <Mail size={16} /> + Connect Sender ID
        </button>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="animate-spin text-blue-600" size={24} />
        </div>
      ) : senderIdentities.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-800">
          <Mail className="mx-auto h-10 w-10 text-slate-400" />
          <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">No Sender IDs Connected</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Connect your Gmail, Outlook, Yahoo, or Custom SMTP account to start sending campaign and automation emails.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-sm transition"
          >
            Connect Sender ID
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {senderIdentities.map((item: any) => (
            <div
              key={item.id}
              className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center gap-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                  <Mail size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {item.display_name ? `${item.display_name} (${item.email})` : item.email}
                    </h4>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        item.status === "CONNECTED"
                          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                          : "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Provider: <span className="font-medium text-slate-700 dark:text-slate-300">{item.provider}</span> • Connection:{" "}
                    <span className="font-medium text-slate-700 dark:text-slate-300">{item.connection_type}</span>
                    {item.last_verified_at && (
                      <span> • Verified: {new Date(item.last_verified_at).toLocaleDateString()}</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3 sm:border-t-0 sm:pt-0 dark:border-slate-800">
                <button
                  disabled={testingId === item.id}
                  onClick={() => sendTestEmail(item.id, item.email)}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 flex items-center gap-1.5"
                >
                  {testingId === item.id ? <Loader2 size={14} className="animate-spin" /> : null}
                  Send Test Email
                </button>
                <button
                  disabled={deletingId === item.id || deleteMutation.isPending}
                  onClick={() => {
                    setDeletingId(item.id);
                    deleteMutation.mutate(item.id);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-rose-600 shadow-sm hover:bg-rose-50 hover:border-rose-200 transition disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-rose-400 dark:hover:bg-rose-500/10 flex items-center gap-1.5"
                >
                  {deletingId === item.id ? <Loader2 size={14} className="animate-spin" /> : null}
                  Disconnect
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConnectEmailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => void qc.invalidateQueries({ queryKey: ["sender-identities"] })}
      />
    </motion.div>
  );
}

