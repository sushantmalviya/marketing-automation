"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MessageSquare, Loader2, ShieldCheck, ExternalLink, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { apiClient, parseApiError } from "@/services/api-client";

declare global {
  interface Window {
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

interface ConnectWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ConnectWhatsAppModal({ isOpen, onClose, onSuccess }: ConnectWhatsAppModalProps) {
  const [loading, setLoading] = useState(false);
  const [sdkLoaded, setSdkLoaded] = useState(false);

  // Captured IDs from Meta postMessage sessionInfoListener
  const [sessionData, setSessionData] = useState<{ waba_id?: string; phone_number_id?: string }>({});

  const appId = process.env.NEXT_PUBLIC_META_APP_ID || "968408089357113";
  const configId = process.env.NEXT_PUBLIC_META_CONFIG_ID || "";

  // Load Meta Facebook SDK
  useEffect(() => {
    if (!isOpen) return;

    if (window.FB) {
      setSdkLoaded(true);
      return;
    }

    window.fbAsyncInit = function () {
      window.FB.init({
        appId: appId,
        cookie: true,
        xfbml: true,
        version: "v19.0",
      });
      setSdkLoaded(true);
    };

    const id = "facebook-jssdk";
    if (!document.getElementById(id)) {
      const fjs = document.getElementsByTagName("script")[0];
      const js = document.createElement("script");
      js.id = id;
      js.src = "https://connect.facebook.net/en_US/sdk.js";
      js.async = true;
      js.defer = true;
      fjs.parentNode?.insertBefore(js, fjs);
    }
  }, [isOpen, appId]);

  // Listen for Meta Embedded Signup postMessage events
  useEffect(() => {
    if (!isOpen) return;

    function handleMetaMessage(event: MessageEvent) {
      if (event.origin !== "https://www.facebook.com" && event.origin !== "https://web.facebook.com") {
        return;
      }

      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data.type === "WA_EMBEDDED_SIGNUP" || data.event === "sessionInfoListener") {
          const wabaId = data.data?.waba_id || data.waba_id;
          const phoneId = data.data?.phone_number_id || data.phone_number_id;

          if (wabaId || phoneId) {
            setSessionData((prev) => ({
              waba_id: wabaId || prev.waba_id,
              phone_number_id: phoneId || prev.phone_number_id,
            }));
          }
        }
      } catch {
        // Non-JSON message from window, safely ignore
      }
    }

    window.addEventListener("message", handleMetaMessage);
    return () => window.removeEventListener("message", handleMetaMessage);
  }, [isOpen]);

  if (!isOpen) return null;

  // Launch Meta Embedded Signup Popup
  function launchEmbeddedSignup() {
    if (typeof window === "undefined" || !window.FB) {
      toast.error("Meta SDK is still loading. Please try again in a moment.");
      return;
    }

    if (window.location.protocol === "http:" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      toast.error("Meta requires HTTPS for FB.login. Please access your app via HTTPS (e.g. ngrok HTTPS).");
      return;
    }

    setLoading(true);

    const loginOptions: any = {
      scope: "whatsapp_business_messaging,whatsapp_business_management",
      response_type: "code",
      override_default_response_type: true,
      extras: {
        feature: "whatsapp_embedded_signup",
        setup: {},
      },
    };

    if (configId) {
      loginOptions.config_id = configId;
    }

    try {
      window.FB.login((response: any) => {
        (async () => {
          if (response && response.authResponse && response.authResponse.code) {
            const code = response.authResponse.code;
            const wabaId = sessionData.waba_id || response.authResponse.waba_id || "";
            const phoneId = sessionData.phone_number_id || response.authResponse.phone_number_id || "";

            try {
              toast.info("Completing WhatsApp onboarding with Meta...");
              await apiClient.post("/api/communications/whatsapp/embedded-signup/callback/", {
                code: code,
                waba_id: wabaId,
                phone_number_id: phoneId,
              });

              toast.success("WhatsApp Business Account connected successfully!");
              onSuccess();
              onClose();
            } catch (err) {
              toast.error(parseApiError(err));
            } finally {
              setLoading(false);
            }
          } else {
            setLoading(false);
            if (response && response.status !== "unknown") {
              toast.error("Meta Embedded Signup was cancelled or failed to authenticate.");
            }
          }
        })();
      }, loginOptions);
    } catch (err: any) {
      setLoading(false);
      toast.error(err?.message || "FB.login requires an HTTPS domain. Please access via HTTPS.");
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
                <p className="text-xs text-slate-500 dark:text-slate-400">Official Meta OAuth Embedded Signup</p>
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
            {typeof window !== "undefined" &&
            window.location.protocol === "http:" &&
            window.location.hostname !== "localhost" &&
            window.location.hostname !== "127.0.0.1" && (
              <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-300 border border-amber-200 dark:border-amber-500/20">
                <AlertTriangle size={20} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div>
                  <p className="font-semibold mb-1">HTTPS Connection Required by Meta</p>
                  <p className="text-amber-800 dark:text-amber-300 leading-relaxed">
                    Meta SDK blocks <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 rounded">FB.login</code> when loaded over non-localhost HTTP ({window.location.origin}). Please access your app via an HTTPS domain (e.g. ngrok HTTPS).
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3 rounded-xl bg-emerald-50/70 p-4 text-xs text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-500/20">
              <ShieldCheck size={20} className="shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">Instant Self-Serve Meta Signup</p>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  Connect your existing Meta WhatsApp Business Account or create a new one in seconds using Meta&apos;s OAuth popup dialog.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-850">
              <p className="font-medium text-slate-800 dark:text-slate-200">What happens next?</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Log in securely with your Meta Business Account.</li>
                <li>Select or verify your WhatsApp Phone Number.</li>
                <li>Permissions and webhooks will be configured automatically.</li>
              </ul>
            </div>

            <div className="pt-2">
              <button
                type="button"
                disabled={loading || !sdkLoaded}
                onClick={launchEmbeddedSignup}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-xs font-bold text-white shadow-lg hover:bg-emerald-700 transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={16} /> Connecting with Meta...
                  </>
                ) : (
                  <>
                    <MessageSquare size={16} /> Connect with Meta WhatsApp
                  </>
                )}
              </button>
            </div>

            {/* Footer Docs Link */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <a
                href="https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline dark:text-emerald-400"
              >
                Meta Developer Documentation <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
