"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    // If token already exists in cookie, skip login and go straight to files
    const match = document.cookie.match(/(?:^|;\s*)cloudfs_token=([^;]+)/);
    if (match) {
      router.replace("/files");
    }
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-10 bg-surface">
      {/* Ambient glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 30%, rgba(74,222,128,0.06), transparent)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-8 max-w-sm w-full px-6">
        {/* Logo mark */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-accent-muted border border-accent/30 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 15a4 4 0 004 4h10a3 3 0 000-6 5 5 0 00-9.9-1A4 4 0 003 15z"
                stroke="#4ade80"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="text-center">
            <h1 className="font-mono text-2xl font-semibold text-text-primary tracking-tight">
              CloudFS
            </h1>
            <p className="text-text-secondary text-sm mt-1">
              Your Drive. Your interface.
            </p>
          </div>
        </div>

        {/* Auth card */}
        <div className="w-full bg-surface-1 border border-border rounded-2xl p-6 flex flex-col gap-4">
          <p className="text-text-secondary text-sm leading-relaxed">
            CloudFS connects to Google Drive while keeping you in full control
            of your workflow. Keyboard-first. API-transparent. No clutter.
          </p>

          <a
            href={auth.loginUrl()}
            className="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-xl
              bg-accent text-surface font-semibold text-sm hover:bg-accent-dim
              transition-colors duration-150 focus-visible:ring-2 ring-accent"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
                fill="#1a1a2e"
              />
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
                fill="#1a1a2e"
              />
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                fill="#1a1a2e"
              />
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
                fill="#1a1a2e"
              />
            </svg>
            Sign in with Google
          </a>
        </div>

        <p className="text-text-muted text-xs text-center">
          Tokens stay on the server. Your browser never touches OAuth credentials.
        </p>
      </div>
    </div>
  );
}
