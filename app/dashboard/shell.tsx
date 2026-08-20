"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Settings from "@/app/components/Settings"
import { useI18n } from "@/app/localization/client"
import type { Profile, Project } from "@/lib/supabase"
import type { CSSProperties as Properties } from "react"

type FullProfile = Profile & {
  avatar_url?: string | null
  roblox_user_id?: number | null
  display_name?: string | null
  username?: string | null
  credits?: number
}

function safeDisplayName(p: Profile): string {
  const fp = p as FullProfile
  return fp.display_name?.trim() || fp.username?.trim() || "User"
}

function UserAvatar({ profile, size = 32 }: { profile: Profile; size?: number }) {
  const fp = profile as FullProfile
  const avatarUrl = fp.avatar_url?.trim() || null
  const initial = safeDisplayName(profile).charAt(0).toUpperCase()

  return (
    <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: "1.5px solid rgba(255,255,255,0.11)" }}>
      {avatarUrl ? (
        <img src={avatarUrl} width={size} height={size} alt="" style={{ objectFit: "cover", width: "100%", height: "100%", display: "block" }} />
      ) : (
        <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,rgba(255,255,255,0.14) 0%,rgba(255,255,255,0.06) 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.4), fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>
          {initial}
        </div>
      )}
    </div>
  )
}

const SUGGESTIONS = [
  "Branching NPC dialogue tree with typewriter effect",
  "Cartoony Aura Shop with coin prices & equip states",
  "Active ragdoll on death with camera tracking",
  "Animated daily prize wheel with weighted drops",
]

export default function DashboardShell({ profile, initialProjects }: { profile: Profile; initialProjects: Project[] }) {
  const router = useRouter()
  const { locale, setLocale } = useI18n()
  const [prompt, setPrompt] = useState("")
  const [inputFocused, setInputFocused] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [credits, setCredits] = useState<number | null>((profile as FullProfile).credits ?? null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [sidebarHovered, setSidebarHovered] = useState<number | null>(null)
  const [sendBounce, setSendBounce] = useState(false)

  const fp = profile as FullProfile
  const firstName = safeDisplayName(profile).split(" ")[0]

  useEffect(() => {
    if (fp.credits !== undefined && fp.credits !== null) setCredits(fp.credits)
  }, [profile])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "0px"
    el.style.height = Math.min(Math.max(el.scrollHeight, 44), 120) + "px"
  }, [prompt])

  const handleSubmit = useCallback(async () => {
    const text = prompt.trim()
    if (!text) return
    setSendBounce(true)
    setTimeout(() => setSendBounce(false), 500)
    const { data: proj } = await supabase.from("projects").insert({ user_id: profile.id, name: text.slice(0, 32) }).select().single()
    if (proj) router.push(`/project/${proj.id}`)
  }, [prompt, profile.id, router])

  const handleSuggestionClick = useCallback((text: string) => {
    setPrompt(text)
    textareaRef.current?.focus()
  }, [])

  const sidebarIcons = [
    { icon: "bi-chat-dots", label: "Chat", action: () => {} },
    { icon: "bi-clock-history", label: "History", action: () => {} },
    { icon: "bi-people", label: "Community", action: () => {} },
    { icon: "bi-shop", label: "Marketplace", action: () => {} },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0c; font-family: 'Inter', sans-serif; overflow: hidden; }
        ::placeholder { color: rgba(255,255,255,0.22); }
        textarea:focus { outline: none; }

        @keyframes dFadeIn      { from { opacity: 0 } to { opacity: 1 } }
        @keyframes dFadeOut     { from { opacity: 1 } to { opacity: 0 } }
        @keyframes dSlideUp     { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes dSlideDown   { from { opacity: 0; transform: translateY(-12px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes dScaleIn     { from { opacity: 0; transform: scale(0.95) } to { opacity: 1; transform: scale(1) } }
        @keyframes dSpin        { to { transform: rotate(360deg) } }
        @keyframes dPulse       { 0%,100% { opacity: 1 } 50% { opacity: 0.4 } }
        @keyframes dFloat       { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
        @keyframes dSendPop     { 0% { transform: scale(1) } 40% { transform: scale(0.85) translateY(2px) } 70% { transform: scale(1.08) translateY(-2px) } 100% { transform: scale(1) } }
        @keyframes dCardIn      { from { opacity: 0; transform: translateY(16px) scale(0.97) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes dIconPop     { from { transform: scale(0.8); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        @keyframes dInputIn     { from { opacity: 0; transform: translateY(24px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes dGlow        { 0%,100% { box-shadow: 0 0 20px rgba(255,165,0,0.05) } 50% { box-shadow: 0 0 30px rgba(255,165,0,0.1) } }

        .d-sidebar-btn { transition: all 0.2s cubic-bezier(.34,1.56,.64,1); }
        .d-sidebar-btn:hover { background: rgba(255,255,255,0.08) !important; transform: scale(1.1); }
        .d-sidebar-btn:active { transform: scale(0.95); }

        .d-suggestion-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px;
          padding: 18px 20px;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(.34,1.56,.64,1);
          animation: dCardIn 0.5s cubic-bezier(.16,1,.3,1) both;
        }
        .d-suggestion-card:hover {
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,255,255,0.14);
          transform: translateY(-3px);
          box-shadow: 0 12px 32px rgba(0,0,0,0.4);
        }
        .d-suggestion-card:active { transform: translateY(-1px) scale(0.98); }

        .d-tool-btn {
          width: 34px; height: 34px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
          color: rgba(255,255,255,0.4); cursor: pointer; transition: all 0.2s ease;
          flex-shrink: 0;
        }
        .d-tool-btn:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7); border-color: rgba(255,255,255,0.14); }

        .d-mode-btn {
          padding: 6px 14px; border-radius: 8px;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.5); font-size: 13px; font-weight: 600;
          cursor: pointer; transition: all 0.2s ease; font-family: inherit;
        }
        .d-mode-btn:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.8); border-color: rgba(255,255,255,0.15); }
        .d-mode-btn.active { background: rgba(255,255,255,0.1); color: #fff; border-color: rgba(255,255,255,0.2); }

        .d-send-btn {
          width: 36px; height: 36px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12);
          color: rgba(255,255,255,0.5); cursor: pointer; transition: all 0.25s cubic-bezier(.34,1.56,.64,1);
          flex-shrink: 0;
        }
        .d-send-btn:hover:not(:disabled) { background: #fff; color: #0a0a0c; border-color: #fff; transform: scale(1.08); box-shadow: 0 4px 20px rgba(255,255,255,0.15); }
        .d-send-btn:active:not(:disabled) { animation: dSendPop 0.3s ease; }
        .d-send-btn:disabled { opacity: 0.3; cursor: not-allowed; }

        .d-nav-item {
          position: relative; width: 42px; height: 42px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          background: transparent; border: none; color: rgba(255,255,255,0.3);
          cursor: pointer; transition: all 0.2s cubic-bezier(.34,1.56,.64,1);
          font-size: 18px;
        }
        .d-nav-item:hover { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.7); }
        .d-nav-item.active { color: #fff; background: rgba(255,255,255,0.08); }

        .d-nav-tooltip {
          position: absolute; left: calc(100% + 12px); top: 50%; transform: translateY(-50%);
          background: #1a1a1e; border: 1px solid rgba(255,255,255,0.1);
          padding: 5px 10px; border-radius: 8px; font-size: 12px; font-weight: 600;
          color: #fff; white-space: nowrap; pointer-events: none;
          box-shadow: 0 4px 16px rgba(0,0,0,0.4);
        }
      `}</style>

      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} profile={profile} locale={locale} setLocale={setLocale} />

      <div style={{ display: "flex", height: "100vh", background: "#0a0a0c", fontFamily: "'Inter', sans-serif", color: "#fff", overflow: "hidden" }}>

        {/* ── LEFT SIDEBAR ── */}
        <aside style={{
          width: 60, flexShrink: 0,
          display: "flex", flexDirection: "column", alignItems: "center",
          padding: "16px 0",
          background: "#0d0d0f",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          zIndex: 50,
        }}>
          {/* Logo */}
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, rgba(255,165,0,0.15) 0%, rgba(255,100,0,0.08) 100%)",
            border: "1px solid rgba(255,165,0,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 24, animation: "dFloat 5s ease-in-out infinite",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="rgba(255,165,0,0.7)" stroke="rgba(255,165,0,0.4)" strokeWidth="1.5" />
            </svg>
          </div>

          {/* Nav icons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
            {sidebarIcons.map((item, i) => (
              <div key={i} style={{ position: "relative" }}
                onMouseEnter={() => setSidebarHovered(i)}
                onMouseLeave={() => setSidebarHovered(null)}
              >
                <button
                  type="button"
                  className={`d-nav-item ${i === 0 ? "active" : ""}`}
                  onClick={item.action}
                  style={{ animation: `dIconPop 0.3s ${0.1 + i * 0.05}s cubic-bezier(.34,1.56,.64,1) both` }}
                >
                  <i className={`bi ${item.icon}`} />
                </button>
                {sidebarHovered === i && (
                  <div className="d-nav-tooltip" style={{ animation: "dFadeIn 0.15s ease" }}>
                    {item.label}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Bottom icons */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, marginTop: "auto" }}>
            <button
              type="button"
              className="d-nav-item"
              onClick={() => setSettingsOpen(true)}
              style={{ animation: "dIconPop 0.4s 0.4s cubic-bezier(.34,1.56,.64,1) both" }}
            >
              <i className="bi bi-gear" />
            </button>
            <div style={{ margin: "6px 0" }}>
              <UserAvatar profile={profile} size={32} />
            </div>
          </div>
        </aside>

        {/* ── MAIN AREA ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>

          {/* ── TOP BAR ── */}
          <header style={{
            height: 54, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0 24px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(10,10,12,0.9)",
            backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
            animation: "dSlideDown 0.4s cubic-bezier(.16,1,.3,1) both",
          }}>
            {/* Left: Logo + name + beta */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: "linear-gradient(135deg, rgba(255,165,0,0.12) 0%, rgba(255,100,0,0.06) 100%)",
                border: "1px solid rgba(255,165,0,0.18)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="rgba(255,165,0,0.7)" />
                </svg>
              </div>
              <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em" }}>Wisp</span>
              <span style={{
                fontSize: 10, fontWeight: 700, color: "rgba(255,165,0,0.8)",
                background: "rgba(255,165,0,0.1)", border: "1px solid rgba(255,165,0,0.2)",
                borderRadius: 6, padding: "2px 7px", letterSpacing: "0.04em",
              }}>Beta</span>
            </div>

            {/* Right: Credits */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "6px 14px", borderRadius: 10,
                background: "rgba(255,165,0,0.06)", border: "1px solid rgba(255,165,0,0.14)",
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="rgba(255,165,0,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="rgba(255,165,0,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,165,0,0.9)" }}>
                  {credits !== null ? credits.toLocaleString() : "—"}
                </span>
              </div>
            </div>
          </header>

          {/* ── CENTER CONTENT ── */}
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            padding: "0 24px 140px",
            overflow: "auto",
          }}>
            {/* Heading */}
            <div style={{ textAlign: "center", marginBottom: 16, animation: "dSlideUp 0.6s 0.1s cubic-bezier(.16,1,.3,1) both" }}>
              <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 8 }}>
                Whats up? <span style={{ color: "#ff9500", fontStyle: "italic" }}>Have an idea?</span>
              </h1>
              <p style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", lineHeight: 1.6, maxWidth: 440, margin: "0 auto" }}>
                Choose an idea below or describe any game mechanic, UI, script, or 3D asset.
              </p>
            </div>

            {/* Suggestion cards */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
              maxWidth: 620, width: "100%",
            }}>
              {SUGGESTIONS.map((text, i) => (
                <div
                  key={i}
                  className="d-suggestion-card"
                  onClick={() => handleSuggestionClick(text)}
                  style={{ animationDelay: `${0.2 + i * 0.08}s` }}
                >
                  <span style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.55, fontWeight: 500 }}>
                    {text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── BOTTOM INPUT BAR ── */}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            padding: "0 24px 24px",
            display: "flex", justifyContent: "center",
            animation: "dInputIn 0.6s 0.3s cubic-bezier(.16,1,.3,1) both",
          }}>
            <div style={{
              width: "100%", maxWidth: 680,
              background: "rgba(255,255,255,0.035)",
              border: `1px solid ${inputFocused ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: 20,
              padding: "14px 16px 12px",
              backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
              boxShadow: inputFocused
                ? "0 0 0 3px rgba(255,255,255,0.04), 0 12px 40px rgba(0,0,0,0.4)"
                : "0 8px 32px rgba(0,0,0,0.3)",
              transition: "border-color 0.25s ease, box-shadow 0.3s ease",
            }}>
              {/* Text input */}
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                placeholder="Describe what you want to build..."
                rows={1}
                style={{
                  width: "100%", background: "transparent", border: "none", outline: "none",
                  resize: "none", fontSize: 15, color: "#e8e9ec", lineHeight: 1.6,
                  fontFamily: "inherit", minHeight: 24, maxHeight: 120, overflowY: "auto",
                }}
              />

              {/* Bottom toolbar */}
              <div style={{
                display: "flex", alignItems: "center", gap: 8, marginTop: 10,
              }}>
                {/* Left tools */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button type="button" className="d-tool-btn" title="Mention">
                    <span style={{ fontSize: 16, fontWeight: 700, lineHeight: 1 }}>@</span>
                  </button>
                  <button type="button" className="d-tool-btn" title="Upload image">
                    <i className="bi bi-image" style={{ fontSize: 14 }} />
                  </button>
                </div>

                {/* Spacer */}
                <div style={{ flex: 1 }} />

                {/* Model selector */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "5px 12px", borderRadius: 10,
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                  cursor: "pointer", transition: "all 0.2s ease",
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
                    <path d="M12 6v6l4 2" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>Claude Opus 4.8</span>
                </div>

                {/* Mode buttons */}
                <button type="button" className="d-mode-btn active">Agent</button>
                <button type="button" className="d-mode-btn">Plan</button>

                {/* Send button */}
                <button
                  type="button"
                  className="d-send-btn"
                  onClick={handleSubmit}
                  disabled={!prompt.trim()}
                  style={sendBounce ? { animation: "dSendPop 0.3s ease" } : {}}
                >
                  <i className="bi bi-arrow-up" style={{ fontSize: 16 }} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
