"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";

function resolveRedirect(raw: string | null): string {
  if (!raw || !raw.startsWith("/")) return "https://zorinai.vercel.app/dashboard";
  return `https://zorinai.vercel.app${raw}`;
}

function clearAllAuthCookies() {
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  const baseNames = [
    projectRef ? `sb-${projectRef}-auth-token` : "",
    "supabase.auth.token",
  ].filter(Boolean);
  
  // Clear with all possible domains and paths
  const domains = ["zorinai.vercel.app", ".zorinai.vercel.app", ""];
  const paths = ["/", "/dashboard", "/auth"];
  
  for (const name of baseNames) {
    for (const domain of domains) {
      for (const path of paths) {
        const domainStr = domain ? `domain=${domain};` : "";
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}; ${domainStr} sameSite=lax`;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}; ${domainStr} sameSite=none; Secure`;
      }
    }
  }
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    clearAllAuthCookies();
    
    // Wait a tick for cookies to clear, then check for valid session
    setTimeout(() => {
      if (!mounted) return;
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (!mounted) return;
        if (session) {
          // Verify the session is actually valid by getting the user
          const { data: { user }, error } = await supabase.auth.getUser();
          if (!error && user) {
            const params = new URLSearchParams(window.location.search);
            window.location.href = resolveRedirect(params.get("redirect"));
            return;
          }
          // Session exists but invalid - sign out and clear cookies again
          await supabase.auth.signOut();
          clearAllAuthCookies();
        }
        setChecking(false);
      });
    }, 100);
  }, [mounted]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);

    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) { setError(err.message); setLoading(false); return; }

    const params = new URLSearchParams(window.location.search);
    window.location.href = resolveRedirect(params.get("redirect"));
  };

  if (!mounted || checking) return null;

  return (
    <div style={S.screen}>
      <header style={S.topbar}>
        <a href="https://zorinai.vercel.app" style={S.brand}>
          <Image src="/icons/logo-white.png" alt="Zorin AI" width={22} height={22} style={{ objectFit: "contain" }} />
          <span style={S.brandName}>Zorin AI</span>
        </a>
      </header>

      <div style={S.card}>
        <video autoPlay loop muted playsInline style={S.cardVideo}>
          <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260818_072341_50851634-bbc3-4c33-9acc-7647d4db44aa.mp4" type="video/mp4" />
        </video>

        <div style={S.cardContent}>
          <Image src="/icons/logo-white.png" alt="Zorin AI" width={44} height={44} style={{ objectFit: "contain", marginBottom: 20 }} />
          <h1 style={S.title}>Welcome back</h1>
          <p style={S.sub}>Sign in to your Zorin AI account</p>

          {error && (
            <div style={S.errBox}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} style={S.form}>
            <div style={S.field}>
              <label style={S.label}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required style={S.input} />
            </div>
            <div style={S.field}>
              <label style={S.label}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" required style={S.input} />
            </div>
            <button type="submit" disabled={loading} style={S.submitBtn}>
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p style={S.footer}>
            Don&apos;t have an account?{" "}
            <Link href="/auth/register" style={S.link}>Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  screen: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "clamp(72px,10vw,80px) clamp(16px,5vw,20px) clamp(32px,6vw,40px)",
  },
  topbar: {
    position: "fixed",
    top: 0, left: 0, right: 0,
    height: 60,
    display: "flex",
    alignItems: "center",
    padding: "0 clamp(16px,5vw,36px)",
    borderBottom: "1px solid var(--border-subtle)",
    background: "var(--topbar-bg)",
    backdropFilter: "blur(20px)",
    zIndex: 10,
  },
  brand: { display: "flex", alignItems: "center", gap: 10, textDecoration: "none" },
  brandName: { fontSize: 15, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.3px" },
  card: {
    position: "relative",
    overflow: "hidden",
    width: "100%",
    maxWidth: 400,
    background: "var(--surface-1)",
    border: "1px solid var(--border-default)",
    borderRadius: 16,
    backdropFilter: "blur(20px)",
    boxShadow: "0 1px 3px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.3)",
    padding: "clamp(28px,7vw,40px) clamp(22px,6vw,36px)",
  },
  cardVideo: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    opacity: 0.18,
    zIndex: 0,
    pointerEvents: "none",
  },
  cardContent: {
    position: "relative",
    zIndex: 1,
    width: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  title: {
    fontSize: "clamp(20px,5vw,22px)",
    fontWeight: 800,
    letterSpacing: "-0.5px",
    color: "var(--text-primary)",
    marginBottom: 6,
  },
  sub: { fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 },
  errBox: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "11px 14px",
    background: "rgba(245,101,101,0.07)",
    border: "1px solid rgba(245,101,101,0.20)",
    borderRadius: 8,
    color: "#fc8181",
    fontSize: 13,
    marginBottom: 16,
    width: "100%",
  },
  form: { width: "100%", display: "flex", flexDirection: "column", gap: 14 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text-tertiary)",
    letterSpacing: "0.6px",
    textTransform: "uppercase",
  },
  input: {
    padding: "11px 14px",
    background: "var(--surface-2)",
    border: "1px solid var(--border-default)",
    borderRadius: 10,
    color: "var(--text-primary)",
    fontFamily: "var(--font)",
    fontSize: 14,
    outline: "none",
    width: "100%",
    transition: "border-color 0.15s",
  },
  submitBtn: {
    marginTop: 6,
    padding: "12px",
    background: "var(--text-primary)",
    border: "none",
    borderRadius: 10,
    color: "var(--app-bg)",
    fontFamily: "var(--font)",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    width: "100%",
    transition: "opacity 0.15s",
  },
  footer: { marginTop: 20, fontSize: 13, color: "var(--text-tertiary)" },
  link: { color: "var(--text-secondary)", textDecoration: "none", fontWeight: 600 },
};