"use client";

import type { CSSProperties } from "react";

export default function InvalidLinkPage() {
  return (
    <div style={S.screen}>
      <div style={S.card}>
        <div style={S.iconWrap}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fc8181" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h1 style={S.title}>Link invalid or expired</h1>
        <p style={S.sub}>
          This sign-in link is no longer valid. Links expire after a few minutes for security.
        </p>

        <div style={S.divider} />

        <p style={S.hint}>To get a new link, go back to Roblox Studio and click <strong style={{ color: "#e2e2e2" }}>Connect</strong> in the Zorin plugin.</p>

        <a href="http://localhost:3000" style={S.btn}>
          Go to dashboard
        </a>
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
    background: "#0a0a0a",
    padding: "40px 16px",
  },
  card: {
    width: "100%",
    maxWidth: 400,
    background: "#111111",
    border: "1px solid #1e1e1e",
    borderRadius: 16,
    padding: "36px 32px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    background: "rgba(245,101,101,0.07)",
    border: "1px solid rgba(245,101,101,0.18)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 800,
    color: "#f0f0f0",
    letterSpacing: "-0.4px",
    marginBottom: 10,
  },
  sub: {
    fontSize: 13.5,
    color: "#888",
    lineHeight: 1.6,
    marginBottom: 0,
  },
  divider: {
    width: "100%",
    height: 1,
    background: "#1e1e1e",
    margin: "24px 0",
  },
  hint: {
    fontSize: 13,
    color: "#666",
    lineHeight: 1.6,
    marginBottom: 24,
  },
  btn: {
    display: "inline-block",
    padding: "11px 24px",
    background: "#fff",
    color: "#0a0a0a",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    textDecoration: "none",
    letterSpacing: "-0.1px",
  },
};