"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { FeatureCards } from "./feature-cards";
import { Footer } from "./components/footer";
import { Navbar } from "./components/navbar";
import config from "@/site.config.json";

const CDN = "";
const INTER = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const UTM_SOURCES: Record<string, { badge: string; title: string; sub: string }> = {
  "claude.ai":           { badge: "Coming from Claude",   title: "Hey! You found us through Claude.",  sub: "We've got Claude Sonnet 4 built right into Zeugo â€” try it on your next Roblox project." },
  "claude":              { badge: "Coming from Claude",   title: "Hey! You found us through Claude.",  sub: "We've got Claude Sonnet 4 built right into Zeugo â€” try it on your next Roblox project." },
  "chatgpt.com":         { badge: "Coming from ChatGPT",  title: "Hey! Came over from ChatGPT?",       sub: "Zeugo has GPT-5, GPT-4o, O3-Mini and more â€” all purpose-built for Roblox." },
  "chatgpt":             { badge: "Coming from ChatGPT",  title: "Hey! Came over from ChatGPT?",       sub: "Zeugo has GPT-5, GPT-4o, O3-Mini and more â€” all purpose-built for Roblox." },
  "grok.com":            { badge: "Coming from Grok",     title: "Hey! Found us via Grok?",            sub: "Grok-4-Fast is one of many models inside Zeugo â€” made for Roblox devs." },
  "x.com":               { badge: "Coming from Grok",     title: "Hey! Found us via Grok?",            sub: "Grok-4-Fast is one of many models inside Zeugo â€” made for Roblox devs." },
  "grok":                { badge: "Coming from Grok",     title: "Hey! Found us via Grok?",            sub: "Grok-4-Fast is one of many models inside Zeugo â€” made for Roblox devs." },
  "gemini.google.com":   { badge: "Coming from Gemini",   title: "Hey! Coming from Gemini?",           sub: "Gemini 2.5 Pro and Gemini 3 Flash are both available in Zeugo â€” built for Roblox." },
  "gemini":              { badge: "Coming from Gemini",   title: "Hey! Coming from Gemini?",           sub: "Gemini 2.5 Pro and Gemini 3 Flash are both available in Zeugo â€” built for Roblox." },
  "chat.deepseek.com":   { badge: "Coming from DeepSeek", title: "Hey! Came from DeepSeek?",           sub: "DeepSeek V3 and R1 are both inside Zeugo â€” wired specifically for Roblox dev." },
  "deepseek.com":        { badge: "Coming from DeepSeek", title: "Hey! Came from DeepSeek?",           sub: "DeepSeek V3 and R1 are both inside Zeugo â€” wired specifically for Roblox dev." },
  "deepseek":            { badge: "Coming from DeepSeek", title: "Hey! Came from DeepSeek?",           sub: "DeepSeek V3 and R1 are both inside Zeugo â€” wired specifically for Roblox dev." },
  "toolbaz.com":         { badge: "Coming from ToolBaz",  title: "Hey! Coming from ToolBaz?",          sub: "ToolBaz-v4.5-Fast is our default model in Zeugo â€” give it a try on Roblox." },
  "toolbaz":             { badge: "Coming from ToolBaz",  title: "Hey! Coming from ToolBaz?",          sub: "ToolBaz-v4.5-Fast is our default model in Zeugo â€” give it a try on Roblox." },
};

function UtmReferralCard() {
  const [source, setSource] = useState<typeof UTM_SOURCES[string] | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const utm = (params.get("utm_source") || "").toLowerCase();
    const match = UTM_SOURCES[utm];
    if (match) {
      setSource(match);
      setTimeout(() => setVisible(true), 600);
    }
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => setDismissed(true), 300);
  };

  if (!source || dismissed) return null;

  return (
    <>
      <style>{`
        @keyframes utmBdIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes utmBdOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes utmIn    { from { opacity: 0; transform: scale(0.95) translateY(18px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes utmOut   { from { opacity: 1; transform: scale(1) translateY(0); } to { opacity: 0; transform: scale(0.95) translateY(18px); } }
        .utm-dismiss:hover  { color: rgba(255,255,255,0.7) !important; }
        .utm-btn:hover      { opacity: 0.88; }
      `}</style>

      <div
        onClick={handleDismiss}
        style={{
          position: "fixed", inset: 0, zIndex: 998,
          background: "rgba(0,0,0,0.72)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          animation: `${visible ? "utmBdIn" : "utmBdOut"} 0.3s ease forwards`,
        }}
      />

      <div style={{
        position: "fixed", inset: 0, zIndex: 999,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "clamp(16px,5vw,20px)", pointerEvents: "none",
      }}>
        <div style={{
          pointerEvents: "auto", position: "relative", overflow: "hidden",
          borderRadius: 16, width: "100%", maxWidth: 400,
          background: "rgba(10,10,14,0.92)", border: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.4), 0 32px 80px rgba(0,0,0,0.5)",
          backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
          padding: "clamp(28px,7vw,40px) clamp(22px,6vw,36px)", fontFamily: INTER,
          animation: `${visible ? "utmIn" : "utmOut"} 0.32s cubic-bezier(0.16,1,0.3,1) forwards`,
        }}>
          <video autoPlay loop muted playsInline aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.18, zIndex: 0, pointerEvents: "none" }}>
            <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260818_072341_50851634-bbc3-4c33-9acc-7647d4db44aa.mp4" type="video/mp4" />
          </video>
          <div aria-hidden style={{ position: "absolute", top: -40, left: "50%", transform: "translateX(-50%)", width: 300, height: 160, background: "radial-gradient(ellipse, rgba(167,139,250,0.10) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
          <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <button className="utm-dismiss" onClick={handleDismiss} aria-label="Dismiss" style={{ position: "absolute", top: -8, right: -8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", color: "rgba(255,255,255,0.35)", fontSize: 16, fontWeight: 300, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", transition: "color 0.15s, background 0.15s" }}>Ã—</button>
            <Image src={`${CDN}/icons/logo-white.png`} alt="Zeugo AI" width={44} height={44} style={{ objectFit: "contain", marginBottom: 20 }} />
            <h2 style={{ fontSize: "clamp(18px,4vw,22px)", fontWeight: 800, letterSpacing: "-0.5px", color: "#fff", marginBottom: 8, lineHeight: 1.25 }}>{source.title}</h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, marginBottom: 24, maxWidth: 300 }}>{source.sub}</p>
            <a href="https://zorinai.vercel.app" className="utm-btn" style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#fff", color: "#08080e", fontSize: 14, fontWeight: 700, padding: "12px 24px", borderRadius: 10, textDecoration: "none", letterSpacing: "-0.2px", transition: "opacity 0.15s", width: "100%", justifyContent: "center" }}>
              Try it in Zeugo
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
            </a>
          </div>
        </div>
      </div>
  </>);
}

function studioIcon(type: string) {
  const base = `${CDN}/assistant/StudioIcons`;
  const t = (type || "").toLowerCase().replace(/\s+/g, "");
  if (t.includes("localscript"))    return `${base}/LocalScript.png`;
  if (t.includes("modulescript"))   return `${base}/ModuleScript.png`;
  if (t.includes("remoteevent"))    return `${base}/RemoteEvent.png`;
  if (t.includes("screengui"))      return `${base}/ScreenGui.png`;
  if (t.includes("folder"))         return `${base}/Folder.png`;
  if (t.includes("remotefunction")) return `${base}/RemoteFunction.png`;
  return `${base}/Script.png`;
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "14px 22px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, minWidth: 100, fontFamily: INTER }}>
      <span style={{ fontSize: "clamp(20px,4vw,26px)", fontWeight: 800, letterSpacing: "-1px", lineHeight: 1, color: "#fff" }}>{value}</span>
      <span style={{ fontSize: 11, color: "#fff", fontWeight: 500, textAlign: "center", lineHeight: 1.4 }}>{label}</span>
    </div>
  );
}

const PREVIEW_ITEMS = [
  { name: "CombatController",   type: "LocalScript",  parent: "StarterPlayerScripts" },
  { name: "CombatService",      type: "Script",        parent: "ServerScriptService"  },
  { name: "UIHandler",          type: "LocalScript",  parent: "StarterPlayerScripts" },
  { name: "AdminPanel",         type: "LocalScript",  parent: "StarterGui"           },
  { name: "LeaderboardService", type: "Script",        parent: "ServerScriptService"  },
  { name: "TweenHelper",        type: "ModuleScript", parent: "ReplicatedStorage"    },
  { name: "EventBridge",        type: "ModuleScript", parent: "ReplicatedStorage"    },
  { name: "InventoryService",   type: "Script",        parent: "ServerScriptService"  },
  { name: "ItemsFolder",        type: "Folder",        parent: "ReplicatedStorage"    },
  { name: "ShopService",        type: "Script",        parent: "ServerScriptService"  },
  { name: "ShopHandler",        type: "LocalScript",  parent: "StarterPlayerScripts" },
  { name: "DataManager",        type: "ModuleScript", parent: "ReplicatedStorage"    },
  { name: "PlayerManager",      type: "Script",        parent: "ServerScriptService"  },
  { name: "AnimationHandler",   type: "LocalScript",  parent: "StarterCharacterScripts" },
  { name: "RemoteEvents",       type: "Folder",        parent: "ReplicatedStorage"    },
  { name: "GameConfig",         type: "ModuleScript", parent: "ReplicatedStorage"    },
  { name: "SpawnHandler",       type: "Script",        parent: "ServerScriptService"  },
  { name: "HUDController",      type: "LocalScript",  parent: "StarterGui"           },
];

function chunkItems<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function typeColor(type: string) {
  const t = type.toLowerCase();
  if (t.includes("local"))  return "rgba(167,139,250,0.9)";
  if (t.includes("module")) return "rgba(62,207,142,0.9)";
  if (t.includes("folder")) return "rgba(255,200,80,0.9)";
  return "rgba(91,150,247,0.9)";
}

function typeLabel(type: string) {
  const t = type.toLowerCase().replace(/\s+/g, "");
  if (t.includes("localscript"))  return "Local";
  if (t.includes("modulescript")) return "Module";
  if (t.includes("folder"))       return "Folder";
  return "Script";
}

function PreviewItem({ name, type, parent }: { name: string; type: string; parent: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 13, fontFamily: INTER, cursor: "default", minWidth: 0 }}>
      <img src={studioIcon(type)} width={22} height={22} alt="" style={{ imageRendering: "pixelated", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.90)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "-0.01em" }}>{name}</div>
        <div style={{ fontSize: 11, marginTop: 2, display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ color: typeColor(type), fontWeight: 600 }}>{typeLabel(type)}</span>
          {parent && <span style={{ color: "rgba(255,255,255,0.18)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Â· {parent}</span>}
        </div>
      </div>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" style={{ flexShrink: 0 }}>
        <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
      </svg>
    </div>
  );
}

function DashboardPreview() {
  const rows = chunkItems(PREVIEW_ITEMS, 3);
  const doubled = [...rows, ...rows];
  return (
    <div style={{ width: "100%", maxWidth: 860, margin: "56px auto 0", position: "relative" }}>
      <style>{`
        @keyframes scrollDown { from { transform: translateY(0); } to { transform: translateY(-50%); } }
        .preview-scroll-track { animation: scrollDown 22s linear infinite; display: flex; flex-direction: column; gap: 10px; }
      `}</style>
      <div style={{ height: 320, overflow: "hidden", padding: "0 4px", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 80, background: "linear-gradient(to bottom, #0a0a0c 0%, transparent 100%)", zIndex: 2, pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 80, background: "linear-gradient(to top, #0a0a0c 0%, transparent 100%)", zIndex: 2, pointerEvents: "none" }} />
        <div className="preview-scroll-track">
          {doubled.map((row, ri) => (
            <div key={ri} style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {row.map((item, ci) => <PreviewItem key={ci} {...item} />)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const COMP_ROWS = [
  { label: "Works outside Roblox Studio",     zeugo: true,  roblox: false },
  { label: "Full multi-script architectures", zeugo: true,  roblox: false },
  { label: "Typed, idiomatic Luau output",    zeugo: true,  roblox: false },
  { label: "Context-aware generation",        zeugo: true,  roblox: false },
  { label: "Studio plugin integration",       zeugo: true,  roblox: true  },
];

function Check({ yes }: { yes: boolean }) {
  return yes
    ? <span style={{ color: "#fff", fontSize: 15, lineHeight: 1, fontWeight: 600 }}>âœ“</span>
    : <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 15, lineHeight: 1 }}>âœ•</span>;
}

function Comparison() {
  return (
    <section style={{ padding: "80px clamp(18px,5vw,24px)", fontFamily: INTER }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <h2 style={H2_STYLE}>Why developers choose <span className="grad-text">Zeugo.</span></h2>
        <p style={SUB_STYLE}>Roblox Assistant is limited to Studio. Zeugo works anywhere, generates complete systems, and produces better code.</p>
        <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.01)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 110px", padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.025)" }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "rgba(255,255,255,0.25)" }}>Feature</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", textAlign: "center" }}>Zeugo AI</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.3)", textAlign: "center" }}>Roblox Asst.</span>
          </div>
          {COMP_ROWS.map((row, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 110px 110px", padding: "12px 20px", borderBottom: i < COMP_ROWS.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)", alignItems: "center" }}>
              <span style={{ fontSize: 13.5, color: "#fff", fontWeight: 400 }}>{row.label}</span>
              <span style={{ textAlign: "center" }}><Check yes={row.zeugo} /></span>
              <span style={{ textAlign: "center" }}><Check yes={row.roblox} /></span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const FAQS = [
  { q: "Why use Zeugo instead of Roblox Assistant?", a: "Roblox Assistant is limited to Studio and basic snippet suggestions. Zeugo runs anywhere, generates full multi-script systems, and produces typed Luau code that's ready to use in real projects â€” not just quick snippets." },
  { q: "How does Zeugo generate code?", a: "You describe the feature you want in plain English. Zeugo generates Luau scripts with proper service structure and Roblox-specific conventions built in. The output is designed to land in your project without cleanup." },
  { q: "Do I need to know how to code?", a: "Not at all. Describe what you want â€” a shop system, a leaderboard, a custom character controller â€” and Zeugo builds it. If you do know Luau, Fix and Explain modes let you debug and understand existing scripts." },
  { q: "Is there a free plan?", a: "Yes. Sign up and start generating immediately, no credit card needed. Zeugo is fully free for every developer right now." },
  { q: "Can I use generated scripts in games I monetize?", a: "Yes. All code generated by Zeugo is yours â€” personal projects, commercial games, client work, all of it." },
  { q: "How is this different from just asking ChatGPT?", a: "General-purpose AI tools don't know Roblox's service architecture, instance hierarchy, or Luau conventions. Zeugo does. The output is structured for Studio, not adapted from generic programming knowledge." },
];

function FAQ() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section style={{ padding: "clamp(64px,8vw,96px) clamp(18px,5vw,24px)", fontFamily: INTER }}>
      <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <h2 style={{ ...H2_STYLE, textAlign: "center" }}>Common questions.</h2>
        <p style={{ ...SUB_STYLE, textAlign: "center", marginBottom: 40 }}>Everything you'd want to know before switching.</p>
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 6 }}>
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={i} style={{ border: `1px solid ${isOpen ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.06)"}`, borderRadius: 12, overflow: "hidden", background: isOpen ? "rgba(255,255,255,0.025)" : "transparent", transition: "border-color 0.2s, background 0.2s" }}>
                <button type="button" onClick={() => setOpen(isOpen ? null : i)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "16px 18px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: INTER }} aria-expanded={isOpen}>
                  <span style={{ fontSize: "clamp(13.5px,2.5vw,14px)", fontWeight: 500, color: "#fff", lineHeight: 1.4 }}>{f.q}</span>
                  <span style={{ fontSize: 18, fontWeight: 300, color: "rgba(255,255,255,0.25)", flexShrink: 0, transition: "transform 0.2s", transform: isOpen ? "rotate(45deg)" : "none", display: "inline-block", lineHeight: 1 }}>+</span>
                </button>
                <div style={{ maxHeight: isOpen ? 300 : 0, overflow: "hidden", opacity: isOpen ? 1 : 0, transition: "max-height 0.28s ease, opacity 0.2s ease", paddingLeft: 18, paddingRight: 18, paddingBottom: isOpen ? 16 : 0 }}>
                  <p style={{ fontSize: "clamp(13px,2.5vw,13.5px)", color: "#fff", lineHeight: 1.75, margin: 0 }}>{f.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const H2_STYLE: CSSProperties = {
  fontSize: "clamp(26px,5vw,40px)", fontWeight: 800,
  letterSpacing: "-1.2px", lineHeight: 1.1, marginBottom: 12,
  fontFamily: INTER,
};

const SUB_STYLE: CSSProperties = {
  fontSize: "clamp(14px,2.8vw,15px)",
  color: "#fff", lineHeight: 1.72, marginBottom: 48,
  fontFamily: INTER,
};

export default function HomePage() {
  const { links, hero, features, cta, stats } = config;

  return (
    <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", background: "#0a0a0c", fontFamily: INTER, color: "#fff" }}>
      <Navbar activePage="home" />
      <UtmReferralCard />

      <section style={{ position: "relative", padding: "clamp(96px,12vw,130px) clamp(18px,5vw,24px) clamp(40px,6vw,60px)", textAlign: "center", overflow: "hidden", zIndex: 1 }}>
        <div style={{ position: "relative", zIndex: 1, maxWidth: 680, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <h1 className="anim-fade-up delay-1" style={{ fontSize: "clamp(38px,7vw,68px)", fontWeight: 900, lineHeight: 1.04, letterSpacing: "-2.5px", marginBottom: 18, color: "#fff", fontFamily: INTER }}>
            {hero.heading}<br />
            <span style={{ color: "#fff" }}>{hero.headingGradient}</span>
          </h1>
          <p className="anim-fade-up delay-2" style={{ fontSize: "clamp(15px,3vw,17px)", color: "#fff", lineHeight: 1.7, marginBottom: 36, maxWidth: 500, fontFamily: INTER }}>
            {hero.sub}
          </p>
<div className="anim-fade-up delay-3 hero-ctas-mobile" style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginBottom: 48 }}>
            <a href={links.getStarted} style={{ background: "#fff", color: "#08080e", fontWeight: 700, fontSize: 14, borderRadius: 10, padding: "12px 24px", border: "none", display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none", letterSpacing: "-0.2px", fontFamily: INTER }}>
              Get Started
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
            </a>
            <a href={links.dashboard} style={{ border: "1px solid rgba(255,255,255,0.10)", color: "#fff", fontWeight: 500, fontSize: 14, borderRadius: 10, padding: "12px 24px", background: "rgba(255,255,255,0.03)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8, fontFamily: INTER }}>
              Open Dashboard
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
            </a>
            {links.roblox && (
              <a href={links.roblox} target="_blank" rel="noreferrer" style={{ border: "1px solid rgba(255,255,255,0.10)", color: "#fff", fontWeight: 500, fontSize: 14, borderRadius: 10, padding: "12px 24px", background: "rgba(255,255,255,0.03)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8, fontFamily: INTER }}>
                Studio Plugin
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
              </a>
            )}
          </div>
          <div className="anim-fade-up delay-4 hero-stats-mobile" style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            {stats.map((s: { value: string; label: string }, i: number) => <StatCard key={i} value={s.value} label={s.label} />)}
          </div>
          <div className="anim-fade-up delay-4" style={{ width: "100%" }}>
            <DashboardPreview />
          </div>
        </div>
      </section>

      <Comparison />

      <section style={{ padding: "0 clamp(18px,5vw,24px) 80px", zIndex: 1, position: "relative" }} className="feature-section-mobile">
        <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <h2 className="anim-fade-up delay-1" style={H2_STYLE}>Everything to build faster on Roblox.</h2>
          <p className="anim-fade-up delay-2" style={SUB_STYLE}>Just describe what you need. Zeugo handles the rest.</p>
          <FeatureCards features={features as any} />
        </div>
      </section>

      <FAQ />

      <section style={{ padding: "0 clamp(18px,5vw,24px) 96px", display: "flex", justifyContent: "center" }}>
        <div className="cta-card-mobile" style={{ position: "relative", maxWidth: 720, width: "100%", padding: "clamp(40px,6vw,64px) clamp(28px,5vw,52px)", borderRadius: 20, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", textAlign: "center", isolation: "isolate", fontFamily: INTER }}>
          <video autoPlay muted loop playsInline aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0, opacity: 0.35 }}>
            <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260818_072341_50851634-bbc3-4c33-9acc-7647d4db44aa.mp4" type="video/mp4" />
          </video>
          <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 1, background: "rgba(0,0,0,0.55)" }} />
          <div aria-hidden style={{ position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)", width: 300, height: 200, background: "radial-gradient(ellipse, rgba(255,255,255,0.06), transparent 70%)", filter: "blur(30px)", pointerEvents: "none", zIndex: 2 }} />
          <div style={{ position: "relative", zIndex: 3 }}>
            <h2 style={{ ...H2_STYLE, marginBottom: 10, letterSpacing: "-1.5px" }}>{cta.heading}</h2>
            <p style={{ fontSize: 15, color: "#fff", lineHeight: 1.65, marginBottom: 28, fontFamily: INTER }}>{cta.sub}</p>
            <a href={links.dashboard} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 28px", background: "#fff", color: "#08080e", borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: "none", letterSpacing: "-0.2px", border: "none", fontFamily: INTER }}>
              Open Dashboard
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
            </a>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}