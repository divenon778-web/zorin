"use client";

import React from "react";

const ICONS: Record<string, React.ReactElement> = {
  roblox: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="3" width="8" height="8" rx="1" />
      <rect x="3" y="13" width="8" height="8" rx="1" />
      <rect x="13" y="13" width="8" height="8" rx="1" />
    </svg>
  ),
  plugin: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  ),
  free: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  models: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.07 4.93A10 10 0 0 0 2.93 19.07M4.93 4.93a10 10 0 0 0 14.14 14.14" />
    </svg>
  ),
  simple: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  ),
  code: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  ),
};

interface Feature {
  title: string;
  desc: string;
  color: string;
  glow: string;
  icon: string;
}

export function FeatureCards({ features }: { features: Feature[] }) {
  return (
    <div style={gridStyle}>
      {features.map((f, i) => (
        <div
          key={i}
          style={cardStyle}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLDivElement;
            el.style.borderColor = "var(--border-strong)";
            el.style.background = "rgba(26,26,26,0.60)";
            el.style.transform = "translateY(-3px)";
            el.style.boxShadow = "0 8px 32px rgba(0,0,0,0.35)";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLDivElement;
            el.style.borderColor = "var(--border-default)";
            el.style.background = "var(--surface-glass)";
            el.style.transform = "translateY(0)";
            el.style.boxShadow = "none";
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 11,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
              flexShrink: 0,
              color: f.color,
              background: f.glow,
              border: `1px solid ${f.color}30`,
            }}
          >
            {ICONS[f.icon] ?? ICONS.code}
          </div>
          <h3 style={titleStyle}>{f.title}</h3>
          <p style={descStyle}>{f.desc}</p>
        </div>
      ))}
    </div>
  );
}

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
  gap: 14,
  width: "100%",
  textAlign: "left",
};

const cardStyle: React.CSSProperties = {
  background: "var(--surface-glass)",
  border: "1px solid var(--border-default)",
  borderRadius: 14,
  padding: "clamp(20px, 4vw, 24px) clamp(18px, 4vw, 22px)",
  backdropFilter: "blur(var(--glass-blur))",
  WebkitBackdropFilter: "blur(var(--glass-blur))",
  boxShadow: "var(--card-shadow)",
  transition: "all 0.2s ease",
  cursor: "default",
  minWidth: 0,
  position: "relative",
  overflow: "hidden",
};

const titleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: "var(--text-primary)",
  letterSpacing: "-0.2px",
  marginBottom: 8,
};

const descStyle: React.CSSProperties = {
  fontSize: 13.5,
  color: "var(--text-secondary)",
  lineHeight: 1.6,
};