"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      const match = document.cookie.match(/(?:^|;\s*)cloudfs_token=([^;]+)/);
      if (match && match[1]) router.replace("/files");
    }, 100);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6" style={{
      backgroundImage: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99,211,135,0.06) 0%, transparent 60%)",
    }}>
      {/* Grid texture */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />

      <div className="relative z-10 w-full max-w-sm animate-fade-in">
        {/* Logo */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-lg bg-surface-2 border border-border mb-5" style={{ boxShadow: "0 0 0 4px rgba(99,211,135,0.06)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M3 15a4 4 0 004 4h10a3 3 0 000-6 5 5 0 00-9.9-1A4 4 0 003 15z" stroke="#63d387" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="font-mono text-xl font-semibold text-text-primary tracking-tight">CloudFS</h1>
          <p className="text-text-muted text-sm mt-1.5">Your Drive. Your interface.</p>
        </div>

        {/* Card */}
        <div className="bg-surface-1 border border-border rounded-xl overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03)" }}>
          <div className="p-6">
            <p className="text-text-secondary text-sm leading-relaxed mb-5">
              Connect your Google Drive for a faster, keyboard-native file management experience.
            </p>

            <a
              href={auth.loginUrl()}
              className="flex items-center justify-center gap-3 w-full py-2.5 px-4 rounded-lg font-medium text-sm transition-all duration-150"
              style={{
                background: "linear-gradient(180deg, rgba(99,211,135,0.15) 0%, rgba(99,211,135,0.08) 100%)",
                border: "1px solid rgba(99,211,135,0.25)",
                color: "#63d387",
                boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "linear-gradient(180deg, rgba(99,211,135,0.22) 0%, rgba(99,211,135,0.12) 100%)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "linear-gradient(180deg, rgba(99,211,135,0.15) 0%, rgba(99,211,135,0.08) 100%)"; }}
            >
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <path fillRule="evenodd" clipRule="evenodd" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#63d387" />
                <path fillRule="evenodd" clipRule="evenodd" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#63d387" opacity="0.7" />
                <path fillRule="evenodd" clipRule="evenodd" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#63d387" opacity="0.5" />
                <path fillRule="evenodd" clipRule="evenodd" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#63d387" opacity="0.6" />
              </svg>
              Continue with Google
            </a>
          </div>

          <div className="px-6 py-3 border-t border-border bg-surface-2/50">
            <p className="text-text-muted text-xs text-center">
              OAuth tokens are encrypted server-side. Your browser never holds credentials.
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-3">
          {[
            { icon: "⌨", label: "Keyboard-first" },
            { icon: "🔒", label: "Zero credential exposure" },
            { icon: "⚡", label: "Real-time sync" },
          ].map(({ icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-2 p-3 rounded-lg bg-surface-1/50 border border-border">
              <span className="text-lg">{icon}</span>
              <span className="text-xs text-text-muted text-center leading-tight">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
