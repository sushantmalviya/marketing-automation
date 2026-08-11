import React, { useState } from "react";
import { Globe, Shield, Bell } from "lucide-react";

export function FormSettings({ formId, isLive, setIsLive }: { formId: string, isLive: boolean, setIsLive: (v: boolean) => void }) {
  return (
    <div className="h-full overflow-y-auto p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-xl font-bold text-slate-800">Form Settings</h2>
        <p className="text-sm text-slate-500 mt-1">Configure publishing and behavior for this form.</p>
      </div>

      <div className="flex flex-col gap-6">
        
        {/* Visibility Setting */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                <Globe className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-800">Form Status</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Control whether this form is live and accepting responses from users.
                </p>
                <div className="mt-4">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                    isLive 
                      ? 'bg-green-50 border-green-200 text-green-700' 
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}>
                    <span className={`w-2 h-2 rounded-full mr-1.5 ${isLive ? 'bg-green-500' : 'bg-slate-400'}`}></span>
                    Currently {isLive ? 'Live' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => setIsLive(!isLive)}
              className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${isLive ? 'bg-blue-600' : 'bg-slate-200'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${isLive ? 'left-7' : 'left-1'}`}></div>
            </button>
          </div>
        </div>

        {/* Other settings placeholders */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm opacity-60">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-slate-500" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800">Spam Protection</h3>
              <p className="text-sm text-slate-500 mt-1">Enable CAPTCHA and IP restrictions.</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm opacity-60">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-slate-500" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800">Email Notifications</h3>
              <p className="text-sm text-slate-500 mt-1">Receive an email when someone submits this form.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
