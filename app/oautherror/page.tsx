"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";

const ERRORS: Record<string, { title: string; desc: string }> = {
  access_denied:   { title: "Access Denied",         desc: "You cancelled the Roblox login. You can try again whenever you're ready." },
  missing_params:  { title: "Invalid Request",       desc: "Something went wrong with the OAuth redirect. Please try connecting again." },
  invalid_state:   { title: "Security Check Failed", desc: "The CSRF state token didn't match. This can happen if you have multiple tabs open. Please try again." },
  token_exchange:  { title: "Authentication Failed", desc: "We couldn't exchange the authorization code with Roblox. Please try again." },
  userinfo_failed: { title: "Profile Fetch Failed",  desc: "You authenticated successfully but we couldn't fetch your Roblox profile. Please try again." },
  server_error:    { title: "Server Error",          desc: "An unexpected error occurred on our end. Please try again in a moment." },
};

const FALLBACK = {
  title: "Something Went Wrong",
  desc:  "An unknown error occurred during authentication. Please try again.",
};

function OAuthErrorContent() {
  const params = useSearchParams();
  const code   = params.get("error") ?? "";
  const info   = ERRORS[code] ?? FALLBACK;

  return (
    <div style={S.screen}>

      <header style={S.topbar}>
        <a href="https://zorinai.vercel.app" style={S.brand}>
          <Image src="/icons/logo-white.png" alt="Zorin AI" width={26} height={26} style={{ objectFit: "contain" }} />
          <span style={S.brandName}>Zorin AI</span>
        </a>
      </header>


      <div style={S.card}>
        <div style={S.topGlow} aria-hidden />

        <div style={S.iconWrap}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f56565" strokeWidth="1.8">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8"   x2="12"    y2="12"/>
            <line x1="12" y1="16"  x2="12.01" y2="16"/>
          </svg>
        </div>

        {code && (
          <div style={S.codeBadge}>
            <span style={S.codeText}>error: {code}</span>
          </div>
        )}

        <h1 style={S.title}>{info.title}</h1>
        <p  style={S.desc}>{info.desc}</p>

        <div style={S.actions}>
          <a href="https://zorinai.vercel.app" style={S.btnPrimary}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Try Again
          </a>
          <a href="https://zorinai.vercel.app" style={S.btnGhost}>
            Go Home
          </a>
        </div>

        <p style={S.helpText}>
          Still having issues? Contact us through our Roblox group or Discord.
        </p>
      </div>
    </div>
  );
}

export default function OAuthErrorPage() {
  return (
    <Suspense>
      <OAuthErrorContent />
    </Suspense>
  );
}

const S: Record<string, React.CSSProperties> = {
  screen:    { position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 20px 40px" },
  topbar:    { position: "fixed", top: 0, left: 0, right: 0, height: 58, display: "flex", alignItems: "center", padding: "0 32px", borderBottom: "1px solid var(--border-subtle)", background: "transparent" },
  brand:     { display: "flex", alignItems: "center", gap: 10, textDecoration: "none" },
  brandName: { fontSize: 14.5, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.3px" },
  card:      { width: "100%", maxWidth: 420, background: "rgba(11,14,28,0.92)", border: "1px solid rgba(245,101,101,0.2)", borderRadius: 20, backdropFilter: "blur(28px)", boxShadow: "0 32px 80px rgba(0,0,0,0.65), 0 0 40px rgba(245,101,101,0.05)", padding: "40px 36px 36px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", position: "relative", overflow: "hidden", animation: "scaleIn 0.5s cubic-bezier(0.16,1,0.3,1) both" },
  topGlow:   { position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "100%", height: 160, background: "radial-gradient(ellipse at 50% -10%, rgba(245,101,101,0.15), transparent 70%)", pointerEvents: "none" },
  iconWrap:  { width: 60, height: 60, background: "rgba(245,101,101,0.08)", border: "1px solid rgba(245,101,101,0.2)", borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, position: "relative", boxShadow: "0 0 0 8px rgba(245,101,101,0.04)" },
  codeBadge: { padding: "3px 10px", background: "rgba(245,101,101,0.08)", border: "1px solid rgba(245,101,101,0.15)", borderRadius: 100, marginBottom: 14 },
  codeText:  { fontFamily: "var(--mono)", fontSize: 11, color: "#fc8181", letterSpacing: "0.3px" },
  title:     { fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px", color: "var(--text-primary)", marginBottom: 10 },
  desc:      { fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.65, marginBottom: 28, maxWidth: 320 },
  actions:   { display: "flex", flexDirection: "column", gap: 10, width: "100%", marginBottom: 20 },
  btnPrimary:{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px 20px", background: "linear-gradient(135deg, var(--purple-600) 0%, #4060e8 55%, var(--blue-600) 100%)", border: "none", borderRadius: 10, color: "#fff", fontSize: 14, fontWeight: 700, textDecoration: "none", boxShadow: "0 4px 18px rgba(108,93,211,0.38)", transition: "all 0.2s" },
  btnGhost:  { display: "flex", alignItems: "center", justifyContent: "center", padding: "11px 20px", background: "var(--surface-1)", border: "1px solid var(--border-default)", borderRadius: 10, color: "var(--text-secondary)", fontSize: 14, fontWeight: 500, textDecoration: "none", transition: "all 0.2s" },
  helpText:  { fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.6 },
};