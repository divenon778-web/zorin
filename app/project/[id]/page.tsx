"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Image from "next/image"
import { supabase } from "@/lib/supabase"
import { LOCALES, useI18n } from "@/app/localization/client"
import type { Profile, Project, Message } from "@/lib/supabase"
import type { CSSProperties as Properties } from "react"
import Settings from "@/app/components/Settings"
import AdminPanel from "@/app/components/AdminPanel"

interface PieResponse {
  ok?: boolean
  type?: "generation" | "clarification" | "chat"
  data?: {
    title: string; summary: string
    scripts: { name: string; type: string; parent: string; code: string }[]
    instances: { name: string; class: string; className: string; parent: string }[]
    notes: string[]; warnings: string[]; suggestions?: string[]; thoughts?: string[]; plan?: string[]
    thinking_steps?: string[]
  }
  title?: string; summary?: string
  scripts?: { name: string; type: string; parent: string; code: string }[]
  instances?: { name: string; class: string; className: string; parent: string }[]
  notes?: string[]; warnings?: string[]; suggestions?: string[]; thoughts?: string[]; plan?: string[]
  thinking_steps?: string[]
  question?: string
  options?: string[]
  message?: string
  __model: string
}

type QAPair = { question: string; answer: string }
type GenerationStep = { id: string; label: string; status: "pending" | "running" | "done" | "error" }
type ModelData = { label: string; provider: string; speed?: number; quality?: number }
type ModelMap = Record<string, ModelData>
type FeedbackRow = { id: string; user_id: string; message_id: string | null; feedback_text: string; created_at: string }

const STORAGE_KEY_REDUCE_MOTION  = "zorin_reduce_motion"
const STORAGE_KEY_SEND_ON_ENTER  = "zorin_send_on_enter"
const STORAGE_KEY_COMPACT_MODE   = "zorin_compact_mode"

const PROMPT_LIMIT_UNCONNECTED = 3

const MODES = [
  { id: "generate", label: "Instant", icon: "bi-lightning-charge-fill" },
  { id: "thinking", label: "Expert", icon: "bi-brain" },
] as const
type ModeId = typeof MODES[number]["id"]

const PROJECT_TYPES = [
  { id: "scripting", label: "Scripting", icon: "bi-code-slash" },
  { id: "plan",      label: "Plan",      icon: "bi-list-check" },
] as const
type ProjectTypeId = typeof PROJECT_TYPES[number]["id"]

const BUILDING_PROMPTS = [
  "What are we building today?", "what we cooking?", "What's the move?", "Drop the idea.",
  "Let's get to work.", "What's on the agenda?", "What are we shipping?", "What's the vision?",
  "What do you need?", "Ready when you are.", "Let's build something.", "What's the play?",
  "Got an idea? let's go.", "What are we scripting today?", "What's on your mind?",
]

const CDN = ""

function getGreeting(name: string): string {
  const h = new Date().getHours(); const f = name.split(" ")[0]
  if (h >= 5  && h < 12) return "Good morning, " + f + "."
  if (h >= 12 && h < 17) return "Good afternoon, " + f + "."
  if (h >= 17 && h < 21) return "Good evening, " + f + "."
  return "It's late, " + f + ". Get some rest!"
}
function isLateHour(): boolean { const h = new Date().getHours(); return h >= 21 || h < 5 }
function getRandomPrompt() { return BUILDING_PROMPTS[Math.floor(Math.random() * BUILDING_PROMPTS.length)] }
function getRandomN<T>(arr: T[], n: number): T[] { if (arr.length <= n) return arr; return [...arr].sort(() => Math.random() - 0.5).slice(0, n) }
function stripTicks(t: string) { if (!t) return t; return t.replace(/```[\w]*/g, "").replace(/`/g, "").trim() }
function safeDisplayName(p: Profile) { return (p as FullProfile).display_name?.trim() || (p as FullProfile).username?.trim() || "User" }

function parseQA(content: string): QAPair[] | null {
  const lines = content.trim().split("\n").filter(l => l.trim())
  if (lines.length < 2 || lines.length % 2 !== 0) return null
  const pairs: QAPair[] = []
  for (let i = 0; i < lines.length; i += 2) {
    if (!lines[i].startsWith("Q: ") || !lines[i + 1]?.startsWith("A: ")) return null
    pairs.push({ question: lines[i].slice(3).trim(), answer: lines[i + 1].slice(3).trim() })
  }
  return pairs.length > 0 ? pairs : null
}

function buildQAChain(messages: Message[], beforeIndex: number): QAPair[] {
  const pairs: QAPair[] = []
  let i = beforeIndex - 1
  while (i >= 0) {
    const msg = messages[i]
    if (msg.role === "user") {
      const qa = parseQA(msg.content)
      if (qa) { pairs.unshift(...qa); i--; continue }
    } else if (msg.role === "assistant") {
      try {
        const d = JSON.parse(msg.content)
        if (d.type === "clarification") { i--; continue }
      } catch {}
    }
    break
  }
  return pairs
}

type FullProfile = Profile & {
  avatar_url?: string | null; roblox_user_id?: number | null
  display_name?: string | null; username?: string | null
  discord_id?: string | null; discord_username?: string | null; discord_avatar?: string | null
  is_admin?: boolean
}

function getAvatarUrl(p: Profile): string | null { return (p as FullProfile).avatar_url?.trim() || null }

function RobloxAvatar({ userId, size = 32 }: { userId: number; size?: number }) {
  const [url, setUrl] = useState<string | null>(null)
  const initial = String(userId).charAt(0).toUpperCase()
  useEffect(() => {
    fetch(`/api/roblox-avatar?userId=${userId}`).then(r => r.json()).then(d => { if (d.url) setUrl(d.url) }).catch(() => {})
  }, [userId])
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: "1.5px solid rgba(255,255,255,0.11)" }}>
      {url ? <img src={url} width={size} height={size} alt="" style={{ objectFit: "cover", width: "100%", height: "100%", display: "block" }} />
        : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,rgba(255,255,255,0.14) 0%,rgba(255,255,255,0.06) 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.4), fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>{initial}</div>}
    </div>
  )
}

function UserAvatar({ profile, size = 32 }: { profile: Profile; size?: number }) {
  const fp = profile as FullProfile
  const avatarUrl = getAvatarUrl(profile)
  const initial = safeDisplayName(profile).charAt(0).toUpperCase()
  if (fp.roblox_user_id && !avatarUrl) return <RobloxAvatar userId={fp.roblox_user_id} size={size} />
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: "1.5px solid rgba(255,255,255,0.11)", position: "relative" }}>
      {avatarUrl ? <img src={avatarUrl} width={size} height={size} alt="" style={{ objectFit: "cover", width: "100%", height: "100%", display: "block" }} />
        : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,rgba(255,255,255,0.14) 0%,rgba(255,255,255,0.06) 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.4), fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>{initial}</div>}
    </div>
  )
}

function toCdnAsset(path: string) { return path.startsWith("/") ? `${CDN}${path}` : path }

function getStudioIcon(type: string, size: 16 | 32 = 16) {
  const base = toCdnAsset(size === 32 ? "/assistant/StudioIcons/32" : "/assistant/StudioIcons")
  if (!type) return `${base}/Script.png`
  const t = type.toLowerCase().replace(/\s+/g, "")
  if (t.includes("localscript"))    return `${base}/LocalScript.png`
  if (t.includes("modulescript"))   return `${base}/ModuleScript.png`
  if (t.includes("script"))         return `${base}/Script.png`
  if (t.includes("folder"))         return `${base}/Folder.png`
  if (t.includes("remoteevent"))    return `${base}/RemoteEvent.png`
  if (t.includes("remotefunction")) return `${base}/RemoteFunction.png`
  if (t.includes("screengui"))      return `${base}/ScreenGui.png`
  if (t.includes("frame"))          return `${base}/Frame.png`
  return `${base}/Script.png`
}

function prettyScriptType(type: string) {
  if (!type) return "Script"
  const t = type.toLowerCase().replace(/\s+/g, "")
  if (t.includes("localscript"))  return "LocalScript"
  if (t.includes("modulescript")) return "ModuleScript"
  return "Script"
}

const LUA_KEYWORDS = new Set(["local","function","if","then","else","elseif","end","for","while","do","repeat","until","return","break","and","or","not","in","true","false","nil","self"])
const LUA_BUILTINS = new Set(["game","workspace","script","_G","print","warn","error","pairs","ipairs","tostring","tonumber","typeof","type","table","math","string","task","wait","pcall","xpcall","setmetatable","getmetatable","require","Instance","Color3","Vector3","Vector2","UDim2","UDim","CFrame","TweenInfo","Enum","BrickColor"])
const LUA_COLORS = { keyword: "#eb7973", builtin: "#8fb4ff", string: "#8ee9b6", comment: "#6a6f81", number: "#f2ba2a", operator: "#bcbec8", identifier: "#bcbec8", text: "#bcbec8", property: "#70a0ff" }
type LuaToken = { type: keyof typeof LUA_COLORS; value: string }
function tokenizeLua(code: string): LuaToken[] {
  const tokens: LuaToken[] = []; let i = 0
  while (i < code.length) {
    if (code.slice(i, i + 2) === "--") { const end = code.indexOf("\n", i); const val = end === -1 ? code.slice(i) : code.slice(i, end); tokens.push({ type: "comment", value: val }); i += val.length; continue }
    if (code.slice(i, i + 2) === "[[") { const end = code.indexOf("]]", i + 2); const val = end === -1 ? code.slice(i) : code.slice(i, end + 2); tokens.push({ type: "string", value: val }); i += val.length; continue }
    if (code[i] === '"' || code[i] === "'") { const q = code[i]; let j = i + 1; while (j < code.length) { if (code[j] === "\\") { j += 2; continue } if (code[j] === q) { j++; break } if (code[j] === "\n") break; j++ }; tokens.push({ type: "string", value: code.slice(i, j) }); i = j; continue }
    if (/[0-9]/.test(code[i])) { let j = i; while (j < code.length && /[0-9.]/.test(code[j])) j++; tokens.push({ type: "number", value: code.slice(i, j) }); i = j; continue }
    if (/[a-zA-Z_]/.test(code[i])) { let j = i; while (j < code.length && /[a-zA-Z0-9_]/.test(code[j])) j++; const word = code.slice(i, j); const prev = tokens.slice().reverse().find(t => t.value.trim()); const isProp = prev?.value === "."; if (LUA_KEYWORDS.has(word)) tokens.push({ type: "keyword", value: word }); else if (LUA_BUILTINS.has(word)) tokens.push({ type: "builtin", value: word }); else if (isProp) tokens.push({ type: "property", value: word }); else tokens.push({ type: "identifier", value: word }); i = j; continue }
    if (/[+\-*/%^#=<>~&|(){}:;,./\[\]]/.test(code[i])) { tokens.push({ type: "operator", value: code[i] }); i++; continue }
    tokens.push({ type: "text", value: code[i] }); i++
  }
  return tokens
}
function highlightLua(code: string) {
  return tokenizeLua(code).map(({ type, value }) => {
    const esc = value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    const color = LUA_COLORS[type]
    return color ? `<span style="color:${color}${type === "comment" ? ";font-style:italic" : ""}">${esc}</span>` : esc
  }).join("")
}

const G = {
  fill: "rgba(255,255,255,0.04)", fillHover: "rgba(255,255,255,0.08)",
  border: "rgba(255,255,255,0.09)", borderHover: "rgba(255,255,255,0.18)",
  blur: "blur(20px) saturate(1.5)", blurHeavy: "blur(40px) saturate(1.8)",
  shadow: "0 4px 24px rgba(0,0,0,0.35)", shadowModal: "0 24px 80px rgba(0,0,0,0.7)",
}
const glassPill: Properties = { background: G.fill, backdropFilter: G.blur, WebkitBackdropFilter: G.blur, border: "1px solid " + G.border, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07)" }
const glassModal: Properties = { background: "rgba(12,12,14,0.98)", backdropFilter: G.blurHeavy, WebkitBackdropFilter: G.blurHeavy, border: "1px solid rgba(255,255,255,0.10)", boxShadow: ["inset 0 1px 0 rgba(255,255,255,0.08)", G.shadowModal].join(", ") }

type ScriptPreviewScript = { name: string; type: string; parent: string; code: string }

function ScriptPreviewModal({ script, onClose, isMobile }: { script: ScriptPreviewScript | null; onClose: () => void; isMobile: boolean }) {
  const [copied, setCopied] = useState(false)
  const [closing, setClosing] = useState(false)
  const close = useCallback(() => { setClosing(true); setTimeout(() => { setClosing(false); onClose() }, 260) }, [onClose])
  useEffect(() => { if (!script) return; setClosing(false); const h = (e: KeyboardEvent) => { if (e.key === "Escape") close() }; document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h) }, [script, close])
  if (!script && !closing) return null
  if (!script) return null
  const copy = () => { navigator.clipboard.writeText(script.code || "").then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) }) }
  const highlighted = highlightLua(script.code || "-- (empty script)")
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: closing ? "fadeOut .26s ease forwards" : "fadeIn .18s ease forwards" }}>
      <button type="button" onClick={close} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: "none", cursor: "default" }} />
      <div style={{ position: "relative", width: isMobile ? "calc(100vw - 20px)" : "min(860px, calc(100vw - 40px))", maxHeight: isMobile ? "90vh" : "85vh", background: "#1a1c22", border: "1px solid #2a2d38", borderRadius: 22, boxShadow: "0 40px 80px rgba(0,0,0,0.7)", display: "flex", flexDirection: "column", overflow: "hidden", animation: closing ? "scaleOut .26s ease forwards" : "scaleIn .32s cubic-bezier(.16,1,.3,1) forwards" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 16px 14px", borderBottom: "1px solid #2a2d38", background: "#1a1c22", flexShrink: 0 }}>
          <img src={getStudioIcon(script.type, 32)} width={32} height={32} alt="" style={{ imageRendering: "pixelated", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#c9cbd4", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{script.name || "Unnamed"}</div>
            <div style={{ fontSize: 12, color: "#5a5e6e", marginTop: 1 }}>{prettyScriptType(script.type)}{script.parent ? " · " + script.parent : ""}</div>
          </div>
          <button type="button" onClick={copy} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", background: copied ? "rgba(78,205,196,0.12)" : "#23262f", border: copied ? "1px solid rgba(78,205,196,0.3)" : "1px solid #343945", borderRadius: 10, color: copied ? "#4ecdc4" : "#c9cbd4", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all .2s ease" }}>
            <i className={"bi " + (copied ? "bi-check-lg" : "bi-clipboard")} style={{ fontSize: 13, transition: "transform .2s cubic-bezier(.34,1.56,.64,1)", transform: copied ? "scale(1.2)" : "scale(1)" }} />{copied ? "Copied!" : "Copy"}
          </button>
          <button type="button" onClick={close} style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "#23262f", border: "1px solid #343945", borderRadius: 10, color: "#5a5e6e", cursor: "pointer", transition: "all .15s ease" }}>
            <i className="bi bi-x-lg" style={{ fontSize: 13 }} />
          </button>
        </div>
        <div style={{ display: "flex", flex: 1, overflow: "auto", fontFamily: "'Fira Mono', 'JetBrains Mono', monospace", fontSize: 13, lineHeight: 1.65, background: "#1a1c22" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", padding: "16px 12px 16px 16px", color: "#3e4252", userSelect: "none", flexShrink: 0, borderRight: "1px solid #2a2d38", minWidth: 48 }}>
            {(script.code || "").split("\n").map((_, idx) => <div key={idx} style={{ fontSize: 12, lineHeight: "1.65", color: "#3e4252" }}>{idx + 1}</div>)}
          </div>
          <pre style={{ flex: 1, padding: "16px 20px", margin: 0, whiteSpace: "pre", color: "#c9cbd4", overflow: "visible", background: "transparent" }} dangerouslySetInnerHTML={{ __html: highlighted }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: "1px solid #2a2d38", flexShrink: 0, background: "#1a1c22" }}>
          <span style={{ fontSize: 12, color: "#5a5e6e", fontFamily: "monospace" }}>{(script.code || "").split("\n").length} lines</span>
        </div>
      </div>
    </div>
  )
}

function ThinkingPill({ steps }: { steps: GenerationStep[] }) {
  const running = steps.find(s => s.status === "running")
  const allDone = steps.length > 0 && steps.every(s => s.status === "done" || s.status === "error")
  const label = allDone ? "Done" : running?.label ?? steps[0]?.label ?? "Thinking…"
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 15px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 100, animation: "pillAppear .35s cubic-bezier(.16,1,.3,1) both" }}>
      {allDone
        ? <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0, animation: "checkPop .3s cubic-bezier(.34,1.56,.64,1) both" }}><circle cx="7.5" cy="7.5" r="6.5" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" /><path d="M4.5 7.5l2 2 4-4" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        : <div style={{ width: 15, height: 15, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.10)", borderTopColor: "rgba(255,255,255,0.75)", animation: "spin .65s linear infinite", flexShrink: 0 }} />
      }
      <span style={{ fontSize: 13, fontWeight: 500, color: allDone ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.72)", whiteSpace: "nowrap", transition: "color .3s ease" }}>{label}</span>
    </div>
  )
}

function ReactionBar({ thumbsUp, thumbsDown, onThumbsUp, onThumbsDown, onRetry }: { thumbsUp: boolean; thumbsDown: boolean; onThumbsUp: () => void; onThumbsDown: () => void; onRetry: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.05)", animation: "fadeSlideUp .3s .1s cubic-bezier(.16,1,.3,1) both" }}>
      <button type="button" onClick={onThumbsUp} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", background: thumbsUp ? "rgba(255,255,255,0.07)" : "transparent", border: thumbsUp ? "1px solid rgba(255,255,255,0.14)" : "1px solid transparent", borderRadius: 8, cursor: "pointer", color: thumbsUp ? "#e8e9ec" : "rgba(255,255,255,0.32)", fontSize: 12, fontFamily: "inherit", transition: "all .18s ease" }} className="reaction-btn">
        <i className={"bi " + (thumbsUp ? "bi-hand-thumbs-up-fill" : "bi-hand-thumbs-up")} style={{ fontSize: 13, transition: "transform .2s cubic-bezier(.34,1.56,.64,1)", transform: thumbsUp ? "scale(1.2)" : "scale(1)" }} />Good
      </button>
      <button type="button" onClick={onThumbsDown} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", background: thumbsDown ? "rgba(252,100,100,0.07)" : "transparent", border: thumbsDown ? "1px solid rgba(252,100,100,0.18)" : "1px solid transparent", borderRadius: 8, cursor: "pointer", color: thumbsDown ? "#fc8181" : "rgba(255,255,255,0.32)", fontSize: 12, fontFamily: "inherit", transition: "all .18s ease" }} className="reaction-btn">
        <i className={"bi " + (thumbsDown ? "bi-hand-thumbs-down-fill" : "bi-hand-thumbs-down")} style={{ fontSize: 13, transition: "transform .2s cubic-bezier(.34,1.56,.64,1)", transform: thumbsDown ? "scale(1.15)" : "scale(1)" }} />Bad
      </button>
      <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.07)", margin: "0 3px" }} />
      <button type="button" onClick={onRetry} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", background: "transparent", border: "1px solid transparent", borderRadius: 8, cursor: "pointer", color: "rgba(255,255,255,0.32)", fontSize: 12, fontFamily: "inherit", transition: "all .18s ease" }} className="reaction-btn">
        <i className="bi bi-arrow-clockwise" style={{ fontSize: 13 }} />Retry
      </button>
    </div>
  )
}

/* ──────────────── REASONING BLOCK — borderless, clean ──────────────── */

function ReasoningBlock({ thoughts, plan }: { thoughts: string[]; plan: string[] }) {
  const [open, setOpen] = useState(false)
  const hasThoughts = thoughts.length > 0
  const hasPlan     = plan.length > 0
  if (!hasThoughts && !hasPlan) return null

  const totalSteps = thoughts.length + plan.length

  return (
    <div style={{ marginBottom: 16, animation: "expandDown .38s cubic-bezier(.16,1,.3,1) both" }}>
      {/* collapsed toggle row — no box, just a subtle text button */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="reasoning-toggle"
        style={{
          display: "flex", alignItems: "center", gap: 7, width: "100%",
          padding: "6px 0", background: "transparent", border: "none",
          borderRadius: 8,
          cursor: "pointer", fontFamily: "inherit", textAlign: "left",
          outline: "none",
        }}
      >
        <i
          className={open ? "bi bi-chevron-down" : "bi bi-chevron-right"}
          style={{ fontSize: 10, color: "rgba(255,255,255,0.22)", transition: "transform .22s cubic-bezier(.34,1.56,.64,1)", flexShrink: 0 }}
        />
        <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.28)", letterSpacing: "0.01em" }}>
          {open ? "Reasoning trace" : `Thought for ${totalSteps} step${totalSteps !== 1 ? "s" : ""}`}
        </span>
      </button>

      {/* expanded body — no box/border, just indented content */}
      {open && (
        <div style={{
          paddingLeft: 16,
          paddingTop: 8,
          animation: "expandDown .26s cubic-bezier(.16,1,.3,1) both",
        }}>
          {hasThoughts && (
            <>
              {hasPlan && (
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.18)", textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 7 }}>Reasoning</div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {thoughts.map((t, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex", gap: 10, alignItems: "flex-start",
                      padding: "4px 6px", borderRadius: 6,
                      animation: `fadeSlideUp .22s ${i * 0.04}s cubic-bezier(.16,1,.3,1) both`,
                    }}
                    className="reasoning-row"
                  >
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, paddingTop: 6 }}>
                      <div style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(255,255,255,0.14)", flexShrink: 0 }} />
                      {i < thoughts.length - 1 && (
                        <div style={{ width: 1, flex: 1, background: "rgba(255,255,255,0.05)", marginTop: 4, minHeight: 12 }} />
                      )}
                    </div>
                    <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.38)", lineHeight: 1.65, paddingBottom: i < thoughts.length - 1 ? 8 : 0 }}>{stripTicks(t)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {hasPlan && (
            <>
              {hasThoughts && <div style={{ height: 10 }} />}
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.18)", textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 8 }}>Plan</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {plan.map((p, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex", gap: 9, alignItems: "flex-start",
                      animation: `fadeSlideUp .22s ${(thoughts.length + i) * 0.04}s cubic-bezier(.16,1,.3,1) both`,
                    }}
                  >
                    {/* plain number, no box */}
                    <span style={{
                      fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.22)",
                      flexShrink: 0, minWidth: 16, paddingTop: 1, fontVariantNumeric: "tabular-nums",
                    }}>{i + 1}.</span>
                    <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.44)", lineHeight: 1.65 }}>{stripTicks(p)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/* ──────────────── CLARIFICATION CARD ──────────────── */

function ClarificationCard({
  question,
  options,
  onAnswer,
}: {
  question: string
  options: string[]
  onAnswer: (question: string, answer: string) => void
}) {
  const [selected, setSelected] = useState<string | null>(null)

  const pick = (opt: string) => {
    if (selected) return
    setSelected(opt)
    onAnswer(question, opt)
  }

  return (
    <div style={{
      background: "rgba(255,255,255,0.025)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 16,
      overflow: "hidden",
      animation: "expandDown .32s cubic-bezier(.16,1,.3,1) both",
    }}>
      {/* header strip */}
      <div style={{
        display: "flex", alignItems: "center", gap: 7,
        padding: "11px 15px 10px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{
          width: 20, height: 20, borderRadius: 6,
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.09)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <i className="bi bi-patch-question" style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Quick question
        </span>
      </div>

      {/* question text */}
      <div style={{ padding: "13px 15px 0" }}>
        <p style={{ fontSize: 14, color: "#e8e9ec", lineHeight: 1.65, margin: 0, fontWeight: 500 }}>
          {question}
        </p>
      </div>

      {/* option pills — clicking sends the message directly */}
      {options.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, padding: "12px 15px 15px" }}>
          {options.map((opt, i) => {
            const isSelected = selected === opt
            const isDisabled = selected !== null && !isSelected
            return (
              <button
                key={i}
                type="button"
                onClick={() => pick(opt)}
                disabled={!!selected}
                className={!selected ? "clarif-opt" : ""}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 7,
                  padding: "7px 14px",
                  background: isSelected
                    ? "rgba(255,255,255,0.10)"
                    : "rgba(255,255,255,0.04)",
                  border: isSelected
                    ? "1px solid rgba(255,255,255,0.22)"
                    : "1px solid rgba(255,255,255,0.09)",
                  borderRadius: 100,
                  fontSize: 13, fontWeight: 500,
                  color: isDisabled ? "rgba(255,255,255,0.22)" : isSelected ? "#fff" : "rgba(255,255,255,0.65)",
                  cursor: selected ? "default" : "pointer",
                  fontFamily: "inherit",
                  opacity: isDisabled ? 0.45 : 1,
                  transition: "all .18s ease",
                  animation: `chipPop .28s ${i * 0.06}s cubic-bezier(.34,1.56,.64,1) both`,
                }}
              >
                {isSelected && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ animation: "checkPop .22s cubic-bezier(.34,1.56,.64,1) both", flexShrink: 0 }}>
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {opt}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ──────────────── PROMPT LIMIT BANNER ──────────────── */

function PromptLimitBanner({ used, limit }: { used: number; limit: number }) {
  const remaining = limit - used
  const isOut = remaining <= 0
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 15px",
      background: isOut ? "rgba(252,100,100,0.06)" : "rgba(255,184,0,0.045)",
      border: `1px solid ${isOut ? "rgba(252,100,100,0.18)" : "rgba(255,184,0,0.14)"}`,
      borderRadius: 12,
      marginBottom: 12,
      animation: "fadeSlideUp .3s cubic-bezier(.16,1,.3,1) both",
    }}>
      <i className={`bi ${isOut ? "bi-plug-fill" : "bi-lightning-charge-fill"}`} style={{ fontSize: 13, color: isOut ? "#fc8181" : "#ffc048", flexShrink: 0 }} />
      <span style={{ fontSize: 13, color: isOut ? "#fc8181" : "#ffc048", flex: 1, lineHeight: 1.5 }}>
        {isOut
          ? "Connect Studio to keep generating — you've used your 3 free prompts."
          : `${remaining} free prompt${remaining !== 1 ? "s" : ""} left. Connect Studio to unlock unlimited.`}
      </span>
    </div>
  )
}

/* ──────────────── MESSAGE BUBBLE ──────────────── */

function MessageBubble({ msg, isMobile, qaHistory = [], onSuggestionClick, onClarificationAnswer, onRetry, onFeedback, pluginConnected, index = 0 }: {
  msg: Message; isMobile: boolean; qaHistory?: QAPair[]
  onSuggestionClick?: (s: string) => void
  onClarificationAnswer?: (question: string, answer: string) => void
  onRetry?: () => void; onFeedback?: (id: string) => void; pluginConnected?: boolean | null
  index?: number
}) {
  const [previewScript, setPreviewScript] = useState<ScriptPreviewScript | null>(null)
  const [thumbsUp, setThumbsUp] = useState(false)
  const [thumbsDown, setThumbsDown] = useState(false)
  const handleThumbsUp = () => { if (thumbsDown) setThumbsDown(false); setThumbsUp(v => !v) }
  const handleThumbsDown = () => { if (thumbsDown) return; if (thumbsUp) setThumbsUp(false); setThumbsDown(true); onFeedback?.(msg.id) }
  const staggerDelay = Math.min(index * 0.035, 0.25)

  if (msg.role === "user") {
    const qa = parseQA(msg.content)
    if (qa) {
      return (
        <div style={{ display: "flex", justifyContent: "flex-end", animation: `msgInRight .4s ${staggerDelay}s cubic-bezier(.16,1,.3,1) both` }}>
          <div style={{ maxWidth: isMobile ? "88%" : "72%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: "20px 20px 5px 20px", padding: "12px 16px" }}>
            {qa.map((pair, i) => (
              <div key={i} style={{ marginBottom: i < qa.length - 1 ? 12 : 0 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.25)", flexShrink: 0, letterSpacing: "0.06em" }}>Q</span>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>{pair.question}</span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginTop: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.55)", flexShrink: 0, letterSpacing: "0.06em" }}>A</span>
                  <span style={{ fontSize: 14, color: "#e8e9ec", lineHeight: 1.6, fontWeight: 500 }}>{pair.answer}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    }
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", animation: `msgInRight .4s ${staggerDelay}s cubic-bezier(.16,1,.3,1) both` }}>
        <div style={{ maxWidth: isMobile ? "88%" : "72%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: "20px 20px 5px 20px", padding: "11px 16px", fontSize: 14, lineHeight: 1.65, color: "#e8e9ec", wordBreak: "break-word" }}>
          {msg.content}
        </div>
      </div>
    )
  }

  let data: PieResponse = { __model: "" }
  try {
    const parsed = JSON.parse(msg.content)
    data = parsed.data ? { ...parsed.data, __model: parsed.__model, type: parsed.type, thinking_steps: parsed.data.thinking_steps || parsed.thinking_steps } : parsed
  } catch {
    data = { type: "chat", message: msg.content, __model: "" }
  }

  const responseType = data.type || "generation"

  /* ── CLARIFICATION ── */
  if (responseType === "clarification") {
    return (
      <div style={{ display: "flex", alignItems: "flex-start", animation: `msgInLeft .4s ${staggerDelay}s cubic-bezier(.16,1,.3,1) both` }}>
        <div style={{ flex: 1, minWidth: 0, maxWidth: isMobile ? "100%" : "82%" }}>
          <ClarificationCard
            question={data.question || ""}
            options={data.options || []}
            onAnswer={(q, a) => onClarificationAnswer?.(q, a)}
          />
          <ReactionBar thumbsUp={thumbsUp} thumbsDown={thumbsDown} onThumbsUp={handleThumbsUp} onThumbsDown={handleThumbsDown} onRetry={() => onRetry?.()} />
        </div>
      </div>
    )
  }

  /* ── CHAT ── */
  if (responseType === "chat") {
    return (
      <div style={{ display: "flex", alignItems: "flex-start", animation: `msgInLeft .4s ${staggerDelay}s cubic-bezier(.16,1,.3,1) both` }}>
        <div style={{ flex: 1, minWidth: 0, maxWidth: isMobile ? "100%" : "82%" }}>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.72)", lineHeight: 1.8, margin: "0 0 4px", whiteSpace: "pre-wrap" }}>{data.message || ""}</p>
          <ReactionBar thumbsUp={thumbsUp} thumbsDown={thumbsDown} onThumbsUp={handleThumbsUp} onThumbsDown={handleThumbsDown} onRetry={() => onRetry?.()} />
        </div>
      </div>
    )
  }

  /* ── GENERATION ── */
  const scripts     = data.scripts     || []
  const instances   = data.instances   || []
  const notes       = data.notes       || []
  const warnings    = data.warnings    || []
  const suggestions = data.suggestions || []
  const thoughts    = data.thoughts    || []
  const plan        = data.plan        || []
  const [displayedNotes]       = useState(() => getRandomN(notes, 3))
  const [displayedSuggestions] = useState(() => getRandomN(suggestions, 3))
  const isNotConnected = pluginConnected === false && scripts.length > 0
  const hasQA = qaHistory.length > 0
  const connectedBorder = "1px solid rgba(255,255,255,0.07)"

  return (
    <>
      <ScriptPreviewModal script={previewScript} onClose={() => setPreviewScript(null)} isMobile={isMobile} />
      <div style={{ display: "flex", alignItems: "flex-start", animation: `msgInLeft .4s ${staggerDelay}s cubic-bezier(.16,1,.3,1) both` }}>
        <div style={{ flex: 1, minWidth: 0, maxWidth: "100%" }}>
          {hasQA && (
            <div style={{ padding: "11px 15px", background: "rgba(255,255,255,0.02)", border: connectedBorder, borderBottom: "none", borderRadius: "14px 14px 0 0" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.20)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Context</div>
              {qaHistory.map((pair, i) => (
                <div key={i} style={{ marginBottom: i < qaHistory.length - 1 ? 9 : 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.20)", flexShrink: 0, letterSpacing: "0.05em" }}>Q</span>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.36)", lineHeight: 1.55 }}>{pair.question}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginTop: 2 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.46)", flexShrink: 0, letterSpacing: "0.05em" }}>A</span>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.60)", lineHeight: 1.55, fontWeight: 500 }}>{pair.answer}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={hasQA ? { border: connectedBorder, borderTop: "none", borderRadius: "0 0 14px 14px", padding: "14px 15px 0" } : {}}>
            {isNotConnected && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 13px", marginBottom: 12, ...glassPill, borderRadius: 11, animation: "fadeSlideUp .3s cubic-bezier(.16,1,.3,1) both" }}>
                <i className="bi bi-plug" style={{ fontSize: 12, color: "rgba(255,255,255,0.32)" }} />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.42)" }}>plugin not connected — scripts generated but won't auto-insert. <a href="http://localhost:3000" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,0.42)", textDecoration: "underline" }}>get help</a></span>
              </div>
            )}

            <ReasoningBlock thoughts={thoughts} plan={plan} />

            {data.title   && <h3 style={{ fontSize: 16, fontWeight: 700, color: "#e8e9ec", margin: "0 0 7px", letterSpacing: "-0.018em", animation: "fadeSlideUp .3s cubic-bezier(.16,1,.3,1) both" }}>{stripTicks(data.title)}</h3>}
            {data.summary && <p  style={{ fontSize: 14, color: "rgba(255,255,255,0.62)", lineHeight: 1.75, margin: "0 0 15px", animation: "fadeSlideUp .3s .05s cubic-bezier(.16,1,.3,1) both" }}>{stripTicks(data.summary)}</p>}
            {!!warnings.length && (
              <div style={{ padding: "11px 14px", background: "rgba(255,184,0,0.045)", border: "1px solid rgba(255,184,0,0.14)", borderRadius: 11, marginBottom: 13, animation: "fadeSlideUp .3s cubic-bezier(.16,1,.3,1) both" }}>
                {warnings.map((w, i) => <p key={i} style={{ fontSize: 13, color: "#ffc048", margin: 0 }}><i className="bi bi-exclamation-triangle" style={{ marginRight: 7 }} />{stripTicks(w)}</p>)}
              </div>
            )}
            {!!instances.length && (
              <div style={{ marginBottom: 14, animation: "fadeSlideUp .3s .08s cubic-bezier(.16,1,.3,1) both" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 9 }}>Instances ({instances.length})</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {instances.map((inst, i) => (
                    <div key={i} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 11px", ...glassPill, borderRadius: 9, fontSize: 12, animation: `chipPop .3s ${i * 0.05}s cubic-bezier(.34,1.56,.64,1) both` }}>
                      <img src={getStudioIcon(inst.class || inst.className)} width={14} height={14} alt="" style={{ imageRendering: "pixelated", flexShrink: 0 }} />
                      <span style={{ color: "#c9cbd4" }}>{inst.name || "Unnamed"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!!scripts.length && (
              <div style={{ marginBottom: 14, animation: "fadeSlideUp .3s .10s cubic-bezier(.16,1,.3,1) both" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 9 }}>Scripts ({scripts.length})</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {scripts.map((s, i) => (
                    <button key={i} type="button" onClick={() => setPreviewScript(s)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 11px", ...glassPill, borderRadius: 9, fontSize: 12, cursor: "pointer", border: "1px solid rgba(255,255,255,0.09)", animation: `chipPop .32s ${i * 0.06}s cubic-bezier(.34,1.56,.64,1) both` }} className="script-chip">
                      <img src={getStudioIcon(s.type)} width={14} height={14} alt="" style={{ imageRendering: "pixelated", flexShrink: 0 }} />
                      <span style={{ color: "#c9cbd4" }}>{s.name || "Unnamed"}</span>
                      <span style={{ color: "rgba(255,255,255,0.28)", fontSize: 11 }}>{prettyScriptType(s.type)}</span>
                      <i className="bi bi-code-slash" style={{ fontSize: 11, opacity: 0.35 }} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {!!displayedNotes.length && (
              <div style={{ marginBottom: 14, animation: "fadeSlideUp .3s .12s cubic-bezier(.16,1,.3,1) both" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 9 }}>Notes</div>
                {displayedNotes.map((n, i) => <div key={i} style={{ fontSize: 13, color: "rgba(255,255,255,0.52)", lineHeight: 1.65, padding: "9px 13px", background: "rgba(255,255,255,0.025)", borderRadius: 10, marginBottom: 5, display: "flex", alignItems: "flex-start", gap: 9, animation: `fadeSlideUp .28s ${i * 0.07}s cubic-bezier(.16,1,.3,1) both` }}><i className="bi bi-journal-text" style={{ flexShrink: 0, marginTop: 1 }} />{stripTicks(n)}</div>)}
              </div>
            )}
            {!!displayedSuggestions.length && (
              <div style={{ marginBottom: 14, animation: "fadeSlideUp .3s .15s cubic-bezier(.16,1,.3,1) both" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 9 }}>Try next</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {displayedSuggestions.map((s, i) => (
                    <button key={i} type="button" onClick={() => onSuggestionClick?.(s)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px", ...glassPill, borderRadius: 9, fontSize: 12, cursor: "pointer", color: "rgba(255,255,255,0.52)", border: "1px solid rgba(255,255,255,0.09)", animation: `chipPop .3s ${i * 0.06}s cubic-bezier(.34,1.56,.64,1) both` }} className="suggestion-chip">
                      <i className="bi bi-arrow-right" style={{ fontSize: 11, opacity: 0.45 }} />{stripTicks(s)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {hasQA && <div style={{ height: 14 }} />}
          </div>
          <ReactionBar thumbsUp={thumbsUp} thumbsDown={thumbsDown} onThumbsUp={handleThumbsUp} onThumbsDown={handleThumbsDown} onRetry={() => onRetry?.()} />
        </div>
      </div>
    </>
  )
}

/* ──────────────── FEEDBACK MODAL ──────────────── */

function FeedbackModal({ open, onClose, onSubmit, sending, isMobile }: { open: boolean; onClose: () => void; onSubmit: (text: string) => Promise<boolean>; sending: boolean; isMobile: boolean }) {
  const [text, setText] = useState(""); const [submitted, setSubmitted] = useState(false); const [closing, setClosing] = useState(false)
  const close = () => { setClosing(true); setTimeout(() => { setClosing(false); onClose() }, 220) }
  useEffect(() => { if (!open) { setText(""); setSubmitted(false); setClosing(false) } }, [open])
  if (!open && !closing) return null
  const submit = async () => { if (!text.trim() || sending) return; const ok = await onSubmit(text.trim()); if (ok) { setSubmitted(true); setTimeout(close, 1800) } }
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: closing ? "fadeOut .22s ease forwards" : "fadeIn .18s ease forwards" }}>
      <button type="button" onClick={close} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.68)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: "none", cursor: "default" }} />
      <div style={{ position: "relative", width: isMobile ? "calc(100vw - 24px)" : "min(420px, calc(100vw - 40px))", ...glassModal, borderRadius: 22, overflow: "hidden", animation: closing ? "scaleOut .22s ease forwards" : "scaleIn .28s cubic-bezier(.16,1,.3,1) forwards" }}>
        {submitted ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", ...glassPill, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", animation: "checkPop .4s cubic-bezier(.34,1.56,.64,1) both" }}><i className="bi bi-check-lg" style={{ fontSize: 24 }} /></div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", animation: "fadeSlideUp .3s .1s cubic-bezier(.16,1,.3,1) both" }}>Feedback sent</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", marginTop: 4, animation: "fadeSlideUp .3s .15s cubic-bezier(.16,1,.3,1) both" }}>thanks, we'll look into it.</div>
          </div>
        ) : (
          <>
            <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div><div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Leave feedback</div><div style={{ fontSize: 13, color: "rgba(255,255,255,0.32)", marginTop: 2 }}>What went wrong?</div></div>
              <button type="button" onClick={close} style={{ width: 28, height: 28, borderRadius: 8, ...glassPill, border: "1px solid rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.38)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, transition: "all .18s ease" }}><i className="bi bi-x-lg" /></button>
            </div>
            <div style={{ padding: 20 }}>
              <textarea value={text} onChange={e => setText(e.target.value.slice(0, 500))} placeholder="The response was off because…" rows={4} autoFocus style={{ width: "100%", background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 11, padding: "10px 13px", fontSize: 14, color: "#e8e9ec", outline: "none", resize: "none", fontFamily: "inherit", lineHeight: 1.55, boxSizing: "border-box" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.28)" }}>{text.length}/500</span>
                <button type="button" onClick={submit} disabled={sending || !text.trim()} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: text.trim() && !sending ? "#fff" : "rgba(255,255,255,0.07)", color: text.trim() && !sending ? "#09090b" : "rgba(255,255,255,0.25)", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: text.trim() && !sending ? "pointer" : "not-allowed", fontFamily: "inherit", transition: "all .18s ease" }}>
                  {sending ? <div style={{ width: 13, height: 13, borderRadius: "50%", border: "2px solid rgba(0,0,0,0.2)", borderTopColor: "#09090b", animation: "spin .7s linear infinite" }} /> : <><i className="bi bi-send" style={{ fontSize: 12 }} />Send</>}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", alignItems: "center", paddingTop: 4, animation: "fadeSlideUp .28s cubic-bezier(.16,1,.3,1) both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "9px 13px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 100 }}>
        {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.32)", animation: "typingDot 1.2s ease-in-out infinite", animationDelay: i * 0.18 + "s" }} />)}
      </div>
    </div>
  )
}

/* ──────────────── MAIN PAGE ──────────────── */

export default function ProjectChatPage() {
  const { locale, setLocale } = useI18n()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const projectId = params?.id

  const [profile,           setProfile]           = useState<Profile | null>(null)
  const [project,           setProject]           = useState<Project | null>(null)
  const [messages,          setMessages]          = useState<Message[]>([])
  const [prompt,            setPrompt]            = useState("")
  const [loading,           setLoading]           = useState(false)
  const [loadingMsgs,       setLoadingMsgs]       = useState(true)
  const [isMobile,          setIsMobile]          = useState(false)
  const [generationSteps,   setGenerationSteps]   = useState<GenerationStep[]>([])
  const [mode,              setMode]              = useState<ModeId>("generate")
  const [modeMenuOpen,      setModeMenuOpen]      = useState(false)
  const [projectType,       setProjectType]       = useState<ProjectTypeId>("scripting")
  const [typeMenuOpen,      setTypeMenuOpen]      = useState(false)
  const [feedbackOpen,      setFeedbackOpen]      = useState(false)
  const [feedbackMsgId,     setFeedbackMsgId]     = useState<string | null>(null)
  const [feedbackSending,   setFeedbackSending]   = useState(false)
  const [profileMenuOpen,   setProfileMenuOpen]   = useState(false)
  const [settingsOpen,      setSettingsOpen]      = useState(false)
  const [adminOpen,         setAdminOpen]         = useState(false)
  const [pluginConnected,   setPluginConnected]   = useState<boolean | null>(null)
  const [pluginToken,       setPluginToken]       = useState(() => typeof window !== "undefined" ? window.localStorage.getItem("zorin_plugin_token") || "" : "")
  const [datamodelSnapshot, setDatamodelSnapshot] = useState<Record<string, string[]>>({})
  const [gameModelJson,     setGameModelJson]     = useState<string | null>(null)
  const [stopping,          setStopping]          = useState(false)
  const [lastUserPrompt,    setLastUserPrompt]    = useState("")
  const [sendBtnBounce,     setSendBtnBounce]     = useState(false)
  const [inputFocused,      setInputFocused]      = useState(false)
  const [planHovered,       setPlanHovered]       = useState(false)
  const [promptUsed,        setPromptUsed]        = useState(0)

  const [reduceMotion, setReduceMotion] = useState(() => typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY_REDUCE_MOTION) === "true" : false)
  const [sendOnEnter,  setSendOnEnter]  = useState(() => { if (typeof window === "undefined") return true; const s = window.localStorage.getItem(STORAGE_KEY_SEND_ON_ENTER); return s !== null ? s === "true" : true })
  const [compactMode,  setCompactMode]  = useState(() => typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY_COMPACT_MODE) === "true" : false)
  const [buildingPrompt] = useState(() => getRandomPrompt())

  const lateHour = useMemo(() => isLateHour(), [])

  const [showScrollBtn,     setShowScrollBtn]     = useState(false)
  const [unreadCount,       setUnreadCount]       = useState(0)
  const [copiedMsgId,       setCopiedMsgId]       = useState<string | null>(null)
  const [shakeSend,         setShakeSend]         = useState(false)
  const [pluginJustChanged, setPluginJustChanged] = useState<"connected" | "disconnected" | null>(null)
  const [sidebarOpen,      setSidebarOpen]      = useState(false)

  const bottomRef      = useRef<HTMLDivElement>(null)
  const scrollRef       = useRef<HTMLDivElement>(null)
  const textareaRef    = useRef<HTMLTextAreaElement>(null)
  const abortRef       = useRef<AbortController | null>(null)
  const modeMenuRef    = useRef<HTMLDivElement>(null)
  const typeMenuRef    = useRef<HTMLDivElement>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const prevMsgCountRef = useRef(0)
  const prevPluginRef   = useRef<boolean | null>(null)

  // Derived: is this user over the free prompt limit?
  const isUnlimited = profile?.unlimited_prompts === true
  const isOverLimit = !isUnlimited && pluginConnected === false && promptUsed >= PROMPT_LIMIT_UNCONNECTED
  const showLimitBanner = !isUnlimited && pluginConnected === false && promptUsed > 0

  useEffect(() => {
    if (!projectId) return
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace("/auth/login"); return }
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", session.user.id).single()
      if (!prof) { router.replace("/auth/login"); return }
      setProfile(prof as Profile)
      const { data: proj } = await supabase.from("projects").select("*").eq("id", projectId).eq("user_id", session.user.id).single()
      if (!proj) { router.replace("/"); return }
      setProject(proj as Project)
      const { data: msgs } = await supabase.from("messages").select("*").eq("project_id", projectId).order("created_at", { ascending: true })
      setMessages((msgs || []) as Message[])
      setLoadingMsgs(false)

      // Load prompt usage for this user
      const { data: usage } = await supabase
        .from("prompt_usage")
        .select("used_count")
        .eq("user_id", session.user.id)
        .single()
      if (usage) setPromptUsed(usage.used_count || 0)
    })
  }, [projectId])

  const greetingText = useMemo(() => profile ? getGreeting(safeDisplayName(profile)) : getGreeting("there"), [profile])
  const isAdmin = !!(profile as FullProfile | null)?.is_admin

  useEffect(() => { const sync = () => setIsMobile(window.innerWidth < 768); sync(); window.addEventListener("resize", sync); return () => window.removeEventListener("resize", sync) }, [])
  useEffect(() => { if (typeof window === "undefined") return; window.localStorage.setItem(STORAGE_KEY_REDUCE_MOTION, String(reduceMotion)); document.documentElement.style.setProperty("--motion-duration", reduceMotion ? "0ms" : "200ms") }, [reduceMotion])
  useEffect(() => { if (typeof window === "undefined") return; window.localStorage.setItem(STORAGE_KEY_SEND_ON_ENTER, String(sendOnEnter)) }, [sendOnEnter])
  useEffect(() => { if (typeof window === "undefined") return; window.localStorage.setItem(STORAGE_KEY_COMPACT_MODE, String(compactMode)); document.documentElement.style.setProperty("--compact-gap", compactMode ? "14px" : "28px") }, [compactMode])
  const isNearBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120
  }, [])

  useEffect(() => {
    const grew = messages.length > prevMsgCountRef.current
    prevMsgCountRef.current = messages.length
    if (isNearBottom() || !grew) {
      bottomRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" })
      setUnreadCount(0)
    } else if (grew) {
      setUnreadCount(c => c + 1)
      setShowScrollBtn(true)
    }
  }, [messages, loading, generationSteps, isNearBottom, reduceMotion])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120
      setShowScrollBtn(!near)
      if (near) setUnreadCount(0)
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => el.removeEventListener("scroll", onScroll)
  }, [])

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" })
    setUnreadCount(0); setShowScrollBtn(false)
  }, [reduceMotion])

  useEffect(() => { const el = textareaRef.current; if (!el) return; el.style.height = "0px"; el.style.height = Math.min(Math.max(el.scrollHeight, isMobile ? 40 : 44), isMobile ? 110 : 160) + "px" }, [prompt, isMobile])

  useEffect(() => {
    if (pluginConnected === null) return
    if (prevPluginRef.current === null) { prevPluginRef.current = pluginConnected; return }
    if (prevPluginRef.current !== pluginConnected) {
      setPluginJustChanged(pluginConnected ? "connected" : "disconnected")
      const t = setTimeout(() => setPluginJustChanged(null), 3600)
      prevPluginRef.current = pluginConnected
      return () => clearTimeout(t)
    }
  }, [pluginConnected])

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const res = await fetch("/api/plugin/status", { cache: "no-store", signal: AbortSignal.timeout(6000) })
        if (!res.ok) throw new Error()
        const data = await res.json()
        if (!cancelled) {
          setPluginConnected(data.connected === true)
          if (data.datamodel && Object.keys(data.datamodel).length > 0) setDatamodelSnapshot(data.datamodel)
          if (data.token) { setPluginToken(data.token); window.localStorage.setItem("zorin_plugin_token", data.token) }
        }
      } catch { if (!cancelled && pluginConnected === null) setPluginConnected(false) }
    }
    check(); const iv = setInterval(check, 30000); return () => { cancelled = true; clearInterval(iv) }
  }, [])

  useEffect(() => {
    if (!pluginToken) return
    fetch("/api/plugin/game-model", { headers: { Authorization: `Bearer ${pluginToken}` }, cache: "no-store" })
      .then(r => r.ok ? r.json() : null).then(d => { if (d?.model) setGameModelJson(d.model) }).catch(() => {})
  }, [pluginToken])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (modeMenuRef.current    && !modeMenuRef.current.contains(e.target as Node))    setModeMenuOpen(false)
      if (typeMenuRef.current    && !typeMenuRef.current.contains(e.target as Node))    setTypeMenuOpen(false)
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) setProfileMenuOpen(false)
    }
    if (modeMenuOpen || typeMenuOpen || profileMenuOpen) document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [modeMenuOpen, typeMenuOpen, profileMenuOpen])

  const hiddenIndices = useMemo(() => {
    const hidden = new Set<number>()
    messages.forEach((msg, idx) => {
      if (msg.role !== "assistant") return
      try {
        const d = JSON.parse(msg.content)
        if (d.type && d.type !== "generation") return
        let i = idx - 1
        while (i >= 0) {
          const prev = messages[i]
          if (prev.role === "user" && parseQA(prev.content)) { hidden.add(i); i--; continue }
          if (prev.role === "assistant") {
            try { const pd = JSON.parse(prev.content); if (pd.type === "clarification") { hidden.add(i); i--; continue } } catch {}
          }
          break
        }
      } catch {}
    })
    return hidden
  }, [messages])

  const animateSteps = (steps: GenerationStep[]): { finish: () => void } => {
    const stepMs = Math.max(600, Math.min(1600, 4000 / steps.length))
    let i = 0; let finished = false
    const tick = () => {
      if (finished || i >= steps.length) return
      setGenerationSteps(prev => prev.map((s, idx) => idx === i ? { ...s, status: "running" } : s))
      if (i < steps.length - 1) setTimeout(() => {
        if (finished) return
        setGenerationSteps(prev => prev.map((s, idx) => idx === i ? { ...s, status: "done" } : s))
        i++; tick()
      }, stepMs)
    }
    tick()
    return { finish: () => { finished = true; setGenerationSteps(prev => prev.map(s => ({ ...s, status: "done" as const }))) } }
  }

  const handleClarificationAnswer = useCallback((question: string, answer: string) => {
    if (loading) return
    generate(`Q: ${question}\nA: ${answer}`)
  }, [loading])

  // Increment prompt_usage in Supabase
  const incrementPromptUsage = async () => {
    if (!profile) return
    const newCount = promptUsed + 1
    setPromptUsed(newCount)
    await supabase.from("prompt_usage").upsert(
      { user_id: profile.id, used_count: newCount, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )
  }

  const generate = async (overridePrompt?: string) => {
    if (!profile || !project) return
    const userPrompt = (overridePrompt ?? prompt).trim()
    if (!userPrompt || loading) {
      if (!userPrompt && !overridePrompt) { setShakeSend(true); setTimeout(() => setShakeSend(false), 420); textareaRef.current?.focus() }
      return
    }

    // Enforce prompt limit when plugin is not connected
    if (!isUnlimited && pluginConnected === false && promptUsed >= PROMPT_LIMIT_UNCONNECTED) {
      return
    }

    const currentProjectId   = projectId   ?? ""
    const currentProjectName = project.name ?? ""

    setModeMenuOpen(false); setTypeMenuOpen(false)
    setLastUserPrompt(userPrompt); setPrompt("")
    setLoading(true); setSendBtnBounce(true); setTimeout(() => setSendBtnBounce(false), 500)
    setGenerationSteps([{ id: "init", label: "Thinking…", status: "running" }])

    const tempMsg: Message = { id: "temp-" + Date.now(), project_id: project.id, user_id: profile.id, role: "user", content: userPrompt, created_at: new Date().toString() }
    setMessages(prev => [...prev, tempMsg])

    let stepControl = { finish: () => {} }

    const historyForBackend = messages
      .filter(m => !m.id.startsWith("temp-") && !m.id.startsWith("err-"))
      .slice(-10)
      .map(m => {
        if (m.role === "user") return { role: "user" as const, content: m.content }
        try {
          const d = JSON.parse(m.content)
          if (d.type === "clarification") return { role: "assistant" as const, content: d.question || "" }
          if (d.type === "chat")          return { role: "assistant" as const, content: d.message  || "" }
          return { role: "assistant" as const, content: [d.title, d.summary].filter(Boolean).join(". ") }
        } catch { return { role: "assistant" as const, content: m.content.slice(0, 200) } }
      })
      .filter(m => m.content.trim())

    try {
      await supabase.from("messages").insert({ project_id: project.id, user_id: profile.id, role: "user", content: userPrompt })

      // Increment usage only when plugin is not connected (unlimited users are exempt)
      if (!isUnlimited && pluginConnected === false) {
        await incrementPromptUsage()
      }

      const aiBase = process.env.NEXT_PUBLIC_AI_API_URL ?? "http://localhost:3000"
      const endpoint = mode === "thinking"
        ? `${aiBase}/generate/thinking`
        : `${aiBase}/generate`

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setStopping(false)

      const fetchStepsEarly = async (): Promise<string[]> => {
        try {
          const res = await fetch(`${aiBase}/thinking-steps`, {
            method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
            body: JSON.stringify({ prompt: userPrompt, projectId: currentProjectId, projectName: currentProjectName, locale, language: LOCALES.find(l => l.code === locale)?.label || "English" }),
          })
          if (!res.ok) return []
          const data = await res.json()
          return data.steps || []
        } catch { return [] }
      }

      const makeReq = async () => {
        const timeout = setTimeout(() => controller.abort(), 150000)
        try {
          const res = await fetch(endpoint, {
            method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
            body: JSON.stringify({
              prompt: userPrompt,
              locale, language: LOCALES.find(l => l.code === locale)?.label || "English",
              mode: mode === "thinking" ? "generate" : mode,
              type: projectType,
              projectId: currentProjectId, projectName: currentProjectName,
              history: historyForBackend.length > 0 ? historyForBackend : undefined,
              datamodel: Object.keys(datamodelSnapshot).length > 0 ? datamodelSnapshot : undefined,
              gameModel: gameModelJson || undefined,
              pluginToken: pluginToken || undefined,
            }),
          })
          if (!res.ok) throw new Error("server error")
          return await res.json()
        } finally { clearTimeout(timeout) }
      }

      const stepsPromise = fetchStepsEarly().then(earlySteps => {
        if (earlySteps.length > 0) {
          const realSteps: GenerationStep[] = earlySteps.map((label, i) => ({ id: "step-" + i, label, status: "pending" as const }))
          setGenerationSteps(realSteps)
          stepControl = animateSteps(realSteps)
        }
        return earlySteps
      })

      const payloadPromise = makeReq()
      const [earlySteps, payload] = await Promise.all([stepsPromise, payloadPromise])

      if (earlySteps.length === 0) {
        const fallbackSteps = payload.thinking_steps || []
        if (fallbackSteps.length > 0) {
          const realSteps: GenerationStep[] = fallbackSteps.map((label: string, i: number) => ({ id: "step-" + i, label, status: "pending" as const }))
          setGenerationSteps(realSteps)
          stepControl = animateSteps(realSteps)
        }
      }

      stepControl.finish()

      await supabase.from("messages").insert({
        project_id: project.id, user_id: profile.id, role: "assistant",
        content: JSON.stringify({ ...payload, __model: payload.__model || "" }),
      })
      await supabase.from("projects").update({ updated_at: new Date().toISOString() }).eq("id", project.id)

      const { data: allMsgs } = await supabase.from("messages").select("*").eq("project_id", project.id).order("created_at", { ascending: true })
      setMessages((allMsgs as Message[]) || [])

    } catch {
      stepControl.finish()
      setGenerationSteps(prev => prev.map(s => ({ ...s, status: "error" as const })))
      setMessages(prev => [
        ...prev.filter(m => m.id !== tempMsg.id),
        {
          id: "err-" + Date.now(), project_id: project.id, user_id: profile.id, role: "assistant",
          content: JSON.stringify({ type: "chat", message: "Something went wrong. Check your connection and try again.", __model: "" }),
          created_at: new Date().toString(),
        },
      ])
    } finally {
      setLoading(false); abortRef.current = null; setStopping(false)
      setTimeout(() => setGenerationSteps([]), 2400)
      requestAnimationFrame(() => textareaRef.current?.focus())
    }
  }

  const submitFeedback = async (text: string): Promise<boolean> => {
    setFeedbackSending(true)
    try {
      const payload: { user_id: string; feedback_text: string; message_id?: string } = { user_id: profile!.id, feedback_text: text }
      if (feedbackMsgId) payload.message_id = feedbackMsgId
      const { error } = await supabase.from("feedback").insert([payload])
      return !error
    } catch { return false } finally { setFeedbackSending(false) }
  }

  const copyMessageText = useCallback((id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedMsgId(id)
      setTimeout(() => setCopiedMsgId(null), 1600)
    }).catch(() => {})
  }, [])

  // Static dot color — no animation
  const pluginDot = pluginConnected === true ? "#4ade80" : pluginConnected === null ? "#f59e0b" : "#3f3f46"
  const currentMode = MODES.find(m => m.id === mode) || MODES[0]
  const currentType = PROJECT_TYPES.find(t => t.id === projectType) || PROJECT_TYPES[0]

  if (!profile || !project) {
    return (
      <div style={{ minHeight: "100vh", background: "#09090b", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.08)", borderTopColor: "rgba(255,255,255,0.55)", animation: "spin .7s linear infinite" }} />
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.25)" }}>Loading…</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #09090b; font-family: 'Inter', sans-serif; }
        ::placeholder { color: rgba(255,255,255,0.32); }
        textarea::placeholder { color: rgba(255,255,255,0.32); }
        input:focus, textarea:focus { outline: none; box-shadow: none; }

        @keyframes spin            { to { transform: rotate(360deg) } }
        @keyframes fadeIn          { from { opacity: 0 } to { opacity: 1 } }
        @keyframes fadeOut         { from { opacity: 1 } to { opacity: 0 } }
        @keyframes scaleIn         { from { opacity: 0; transform: scale(0.94) translateY(10px) } to { opacity: 1; transform: scale(1) translateY(0) } }
        @keyframes scaleOut        { from { opacity: 1; transform: scale(1) translateY(0) } to { opacity: 0; transform: scale(0.94) translateY(8px) } }
        @keyframes menuIn          { from { opacity: 0; transform: translateY(-8px) scale(0.96) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes menuUp          { from { opacity: 0; transform: translateY(8px) scale(0.96) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes msgInLeft       { from { opacity: 0; transform: translateX(-16px) translateY(10px) } to { opacity: 1; transform: translateX(0) translateY(0) } }
        @keyframes msgInRight      { from { opacity: 0; transform: translateX(16px) translateY(10px) } to { opacity: 1; transform: translateX(0) translateY(0) } }
        @keyframes pillAppear      { from { opacity: 0; transform: translateY(8px) scale(0.93) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes inputAreaIn     { from { opacity: 0; transform: translateY(24px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes headerSlide     { from { opacity: 0; transform: translateY(-12px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes typingDot       { 0%,60%,100%{transform:translateY(0);opacity:.32} 30%{transform:translateY(-6px);opacity:1} }
        @keyframes lateGreetIn     { from { opacity: 0; transform: translateY(26px) scale(0.96) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes fadeSlideUp     { from { opacity: 0; transform: translateY(9px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes chipPop         { from { opacity: 0; transform: scale(0.80) } to { opacity: 1; transform: scale(1) } }
        @keyframes checkPop        { from { opacity: 0; transform: scale(0.50) rotate(-18deg) } to { opacity: 1; transform: scale(1) rotate(0deg) } }
        @keyframes expandDown      { from { opacity: 0; max-height: 0; transform: scaleY(0.88); transform-origin: top } to { opacity: 1; max-height: 600px; transform: scaleY(1) } }
        @keyframes logoFloat       { 0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-8px) rotate(1deg)} }
        @keyframes pulse           { 0%,100%{opacity:1} 50%{opacity:0.42} }
        @keyframes sendPop         { 0%{transform:scale(1)} 40%{transform:scale(0.83) translateY(2px)} 70%{transform:scale(1.10) translateY(-2px)} 100%{transform:scale(1)} }
        @keyframes headerFadeIn    { from{opacity:0;transform:translateX(-4px)} to{opacity:1;transform:translateX(0)} }
        @keyframes tooltipDown     { from { opacity: 0; transform: translateX(-50%) translateY(-4px) scale(0.92) } to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1) } }
        @keyframes centerFadeIn    { from { opacity: 0; transform: scale(0.97) translateY(10px) } to { opacity: 1; transform: scale(1) translateY(0) } }
        @keyframes inputShift      { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: translateY(0) } }

        .script-chip:hover       { background: rgba(255,255,255,0.08) !important; transform: translateY(-2px) !important; box-shadow: 0 6px 18px rgba(0,0,0,0.35) !important; transition: all .24s cubic-bezier(.34,1.56,.64,1) !important; }
        .suggestion-chip:hover   { background: rgba(255,255,255,0.08) !important; color: #e8e9ec !important; transform: translateY(-1px) !important; transition: all .18s ease !important; }
        .reaction-btn:hover      { background: rgba(255,255,255,0.055) !important; color: rgba(255,255,255,0.62) !important; transform: translateY(-1px) !important; transition: all .15s ease !important; }
        .clarif-opt:hover        { background: rgba(255,255,255,0.09) !important; color: #e8e9ec !important; border-color: rgba(255,255,255,0.18) !important; transform: translateY(-1px) !important; transition: all .2s cubic-bezier(.34,1.56,.64,1) !important; }
        .g-menu-item:hover       { background: rgba(255,255,255,0.07) !important; color: #fff !important; }
        .g-signout:hover         { color: #fc8181 !important; }
        .nav-btn:hover           { background: rgba(255,255,255,0.07) !important; color: rgba(255,255,255,0.7) !important; transition: all .15s ease !important; }
        .send-btn:hover:not(:disabled) { transform: scale(1.06) !important; box-shadow: 0 4px 20px rgba(255,255,255,0.12) !important; transition: all .2s cubic-bezier(.34,1.56,.64,1) !important; }
        .send-btn:active:not(:disabled) { animation: sendPop .3s ease !important; }
        .reasoning-toggle:hover  { opacity: 0.75; }
        .reasoning-row:hover     { background: rgba(255,255,255,0.018) !important; }
        .sidebar-item:hover      { background: rgba(255,255,255,0.06) !important; color: rgba(255,255,255,0.7) !important; }
        .mode-tab:hover          { color: rgba(255,255,255,0.82) !important; }
        .mode-tab.active:hover   { color: #fff !important; }
        .pill-btn:hover          { background: rgba(255,255,255,0.08) !important; border-color: rgba(255,255,255,0.16) !important; color: rgba(255,255,255,0.62) !important; }
        .pill-btn.active:hover   { background: rgba(255,255,255,0.12) !important; border-color: rgba(255,255,255,0.18) !important; color: #fff !important; }
        .sidebarNewChat:hover    { background: rgba(255,255,255,0.09) !important; border-color: rgba(255,255,255,0.13) !important; }
      `}</style>

      <FeedbackModal open={feedbackOpen} onClose={() => { setFeedbackOpen(false); setFeedbackMsgId(null) }} onSubmit={submitFeedback} sending={feedbackSending} isMobile={isMobile} />
      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} profile={profile} locale={locale} setLocale={setLocale} />
      {isAdmin && <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} />}

      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", zIndex: 48, animation: "fadeIn .2s ease" }}
        />
      )}

      <div style={{ display: "flex", height: "100vh", background: "#0a0a0a", fontFamily: "'Inter', sans-serif", color: "#e8e9ec", overflow: "hidden" }}>

        {/* ── SIDEBAR ── */}
        <aside
          style={{
            width: isMobile ? 280 : 260,
            height: "100vh",
            background: "#121214",
            borderRight: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            ...(isMobile
              ? {
                  position: "fixed" as const,
                  left: 0,
                  top: 0,
                  zIndex: 49,
                  transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
                  transition: "transform .32s cubic-bezier(.16,1,.3,1)",
                  boxShadow: sidebarOpen ? "8px 0 40px rgba(0,0,0,0.5)" : "none",
                }
              : {}),
          }}
        >
          {/* Sidebar header */}
          <div style={{ height: 52, display: "flex", alignItems: "center", padding: "0 10px 0 14px", gap: 4, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, flex: 1, minWidth: 0 }}>
              <div style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M7.5 13.8C6.2 13.2 5.2 11.9 5 10.4C4.8 8.6 5.7 6.9 7.2 6.1C8.7 5.3 10.6 5.4 12 6.5L12.6 7L13.2 6.5C14.6 5.4 16.5 5.3 18 6.1C19.5 6.9 20.4 8.6 20.2 10.4C20 11.9 19 13.2 17.7 13.8L12.6 16.2L7.5 13.8Z" fill="rgba(255,255,255,0.85)" />
                  <path d="M12.6 7L17.2 4.6L18.2 5.7L13.6 8.6L12.6 7Z" fill="rgba(255,255,255,0.5)" />
                </svg>
              </div>
              <span style={{ fontSize: 15.5, fontWeight: 700, color: "#e8e9ec", letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>Zorin</span>
            </div>
            <button
              type="button"
              className="nav-btn"
              aria-label="Search"
              style={{ width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.38)", background: "transparent", border: "none", cursor: "pointer", flexShrink: 0 }}
            >
              <i className="bi bi-search" style={{ fontSize: 14 }} />
            </button>
            <button
              type="button"
              className="nav-btn"
              aria-label="Toggle sidebar"
              onClick={() => isMobile && setSidebarOpen(false)}
              style={{ width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.38)", background: "transparent", border: "none", cursor: "pointer", flexShrink: 0 }}
            >
              <i className={isMobile ? "bi bi-x-lg" : "bi bi-layout-sidebar"} style={{ fontSize: 14 }} />
            </button>
          </div>

          {/* New chat button */}
          <div style={{ padding: "6px 12px 14px", flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="sidebarNewChat"
              style={{
                width: "100%",
                height: 36,
                borderRadius: 10,
                background: "#2a2a2e",
                border: "1px solid rgba(255,255,255,0.07)",
                color: "#e8e9ec",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
                fontFamily: "inherit",
                transition: "all .18s ease",
              }}
            >
              <span style={{ width: 18, height: 18, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <i className="bi bi-plus-lg" style={{ fontSize: 9, color: "rgba(255,255,255,0.85)" }} />
              </span>
              New chat
            </button>
          </div>

          {/* Chat history area */}
          <div style={{ flex: 1, overflowY: "auto", padding: "0 10px", display: "flex", flexDirection: "column" }}>
            {messages.filter((m) => m.role === "user").length === 0 ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingBottom: 80, gap: 12, animation: "fadeSlideUp .4s cubic-bezier(.16,1,.3,1) both" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", border: "1.5px dashed rgba(255,255,255,0.14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <i className="bi bi-chat" style={{ fontSize: 14, color: "rgba(255,255,255,0.18)" }} />
                </div>
                <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.28)", fontWeight: 500 }}>No chat history</span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.22)", padding: "8px 8px 6px", letterSpacing: "0.02em" }}>Recent</div>
                {messages
                  .filter((m) => m.role === "user")
                  .slice(-12)
                  .reverse()
                  .map((msg, i) => (
                    <button
                      key={msg.id}
                      type="button"
                      className="sidebar-item"
                      onClick={() => {
                        const el = document.getElementById("msg-" + msg.id)
                        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" })
                      }}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: 8,
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        textAlign: "left",
                        fontFamily: "inherit",
                        fontSize: 13,
                        color: "rgba(255,255,255,0.52)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        transition: "all .15s ease",
                        animation: `fadeSlideUp .22s ${i * 0.02}s cubic-bezier(.16,1,.3,1) both`,
                      }}
                    >
                      {msg.content.slice(0, 48)}
                      {msg.content.length > 48 ? "…" : ""}
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* User profile */}
          <div
            ref={profileMenuRef}
            style={{
              height: 56,
              padding: "0 10px",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexShrink: 0,
              position: "relative",
            }}
          >
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#2a3a3f", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>{safeDisplayName(profile).charAt(0).toUpperCase()}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.72)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.2 }}>{safeDisplayName(profile)}</span>
            </div>
            <button
              type="button"
              onClick={() => setProfileMenuOpen((v) => !v)}
              className="nav-btn"
              style={{ width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.32)", background: "transparent", border: "none", cursor: "pointer", flexShrink: 0 }}
            >
              <i className="bi bi-three-dots" style={{ fontSize: 14 }} />
            </button>

            {profileMenuOpen && (
              <div
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 10px)",
                  left: 10,
                  right: 10,
                  background: "rgba(20,20,22,0.98)",
                  backdropFilter: "blur(40px)",
                  WebkitBackdropFilter: "blur(40px)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 14,
                  padding: 6,
                  animation: "menuUp .22s cubic-bezier(.16,1,.3,1)",
                  zIndex: 100,
                  boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.07)", marginBottom: 4 }}>
                  <UserAvatar profile={profile} size={30} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{safeDisplayName(profile)}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", marginTop: 1 }}>@{(profile as FullProfile).username || "user"}</div>
                  </div>
                </div>

                <button
                  type="button"
                  className="g-menu-item"
                  onClick={() => {
                    setSettingsOpen(true)
                    setProfileMenuOpen(false)
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    padding: "9px 11px",
                    borderRadius: 8,
                    border: "none",
                    background: "transparent",
                    color: "rgba(255,255,255,0.58)",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "left",
                    transition: "background 0.15s, color 0.15s",
                  }}
                >
                  <i className="bi bi-gear" style={{ fontSize: 14 }} />
                  Settings
                </button>

                {isAdmin && (
                  <button
                    type="button"
                    className="g-menu-item"
                    onClick={() => {
                      setAdminOpen(true)
                      setProfileMenuOpen(false)
                    }}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      padding: "9px 11px",
                      borderRadius: 8,
                      border: "none",
                      background: "transparent",
                      color: "rgba(255,255,255,0.58)",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      textAlign: "left",
                      transition: "background 0.15s, color 0.15s",
                    }}
                  >
                    <i className="bi bi-shield-check" style={{ fontSize: 14 }} />
                    Admin Panel
                  </button>
                )}

                <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "4px 0" }} />

                <button
                  type="button"
                  className="g-menu-item g-signout"
                  onClick={async () => {
                    await supabase.auth.signOut()
                    router.replace("/auth/login")
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    padding: "9px 11px",
                    borderRadius: 8,
                    border: "none",
                    background: "transparent",
                    color: "rgba(255,255,255,0.38)",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "left",
                    transition: "background 0.15s, color 0.15s",
                  }}
                >
                  <i className="bi bi-box-arrow-right" style={{ fontSize: 14 }} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* ── MAIN AREA ── */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, position: "relative", background: "#09090b" }}>
          {/* Mobile top bar */}
          {isMobile && (
            <div
              style={{
                height: 52,
                display: "flex",
                alignItems: "center",
                padding: "0 12px",
                gap: 10,
                borderBottom: messages.length === 0 ? "none" : "1px solid rgba(255,255,255,0.06)",
                background: messages.length === 0 ? "transparent" : "rgba(9,9,11,0.85)",
                backdropFilter: messages.length === 0 ? "none" : "blur(20px)",
                WebkitBackdropFilter: messages.length === 0 ? "none" : "blur(20px)",
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="nav-btn"
                style={{ width: 34, height: 34, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer", flexShrink: 0 }}
              >
                <i className="bi bi-list" style={{ fontSize: 18 }} />
              </button>
              {messages.length > 0 && <span style={{ fontSize: 13.5, fontWeight: 600, color: "rgba(255,255,255,0.58)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{project.name}</span>}
            </div>
          )}

          {/* Content – empty vs chat */}
          {(() => {
            const hasChat = messages.length > 0 || loadingMsgs || loading
            if (!hasChat) {
              return (
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: isMobile ? "0 16px 20px" : "0 24px 40px",
                    animation: "centerFadeIn .5s cubic-bezier(.16,1,.3,1) both",
                    overflowY: "auto",
                  }}
                >
                  {/* Logo + Instant mode */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 22,
                      animation: "fadeSlideUp .5s .08s cubic-bezier(.16,1,.3,1) both",
                    }}
                  >
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                      <path d="M7.6 13.7C6.3 13.1 5.3 11.8 5.1 10.3C4.9 8.5 5.8 6.8 7.3 6C8.8 5.2 10.6 5.3 12 6.4L12.6 6.9L13.2 6.4C14.6 5.3 16.5 5.2 18 6C19.5 6.8 20.4 8.5 20.2 10.3C20 11.8 19 13.1 17.7 13.7L12.65 16.15L7.6 13.7Z" fill="rgba(255,255,255,0.72)" />
                      <path d="M12.6 6.9L17.1 4.65L18 5.65L13.35 8.45L12.6 6.9Z" fill="rgba(255,255,255,0.42)" />
                      <circle cx="15.2" cy="9.2" r="1.1" fill="#09090b" />
                    </svg>
                    <span style={{ fontSize: isMobile ? 21 : 23, fontWeight: 700, color: "#e8e9ec", letterSpacing: "-0.02em", lineHeight: 1 }}>Instant mode</span>
                  </div>

                  {/* Mode tabs – pill */}
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 2,
                      padding: 3,
                      background: "#1e1e1f",
                      border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 100,
                      marginBottom: 28,
                      animation: "fadeSlideUp .5s .14s cubic-bezier(.16,1,.3,1) both",
                    }}
                  >
                    {MODES.map((m) => {
                      const isActive = mode === m.id
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setMode(m.id)}
                          className={isActive ? "mode-tab active" : "mode-tab"}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "7px 14px",
                            borderRadius: 100,
                            background: isActive ? "rgba(255,255,255,0.11)" : "transparent",
                            border: isActive ? "1px solid rgba(255,255,255,0.10)" : "1px solid transparent",
                            color: isActive ? "#fff" : "rgba(255,255,255,0.44)",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            transition: "all .18s ease",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <i className={"bi " + m.icon} style={{ fontSize: 12.5 }} />
                          {m.label}
                        </button>
                      )
                    })}
                    <button
                      type="button"
                      disabled
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "7px 14px",
                        borderRadius: 100,
                        background: "transparent",
                        border: "1px solid transparent",
                        color: "rgba(255,255,255,0.22)",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "default",
                        fontFamily: "inherit",
                        whiteSpace: "nowrap",
                        opacity: 0.6,
                      }}
                    >
                      <i className="bi bi-eye" style={{ fontSize: 12.5 }} />
                      Vision
                    </button>
                  </div>

                  {/* Chat input card – DeepSeek style 1:1 monochrome */}
                  <div
                    style={{
                      width: "100%",
                      maxWidth: 680,
                      background: "#1e1e1f",
                      border: inputFocused ? "1px solid rgba(255,255,255,0.14)" : "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 20,
                      padding: isMobile ? "12px 12px 10px" : "14px 14px 10px",
                      animation: "fadeSlideUp .5s .22s cubic-bezier(.16,1,.3,1) both",
                      transition: "border-color .22s ease, box-shadow .22s ease",
                      boxShadow: inputFocused ? "0 0 0 3px rgba(255,255,255,0.04), 0 10px 40px rgba(0,0,0,0.35)" : "0 4px 24px rgba(0,0,0,0.18)",
                    }}
                  >
                    <textarea
                      ref={textareaRef}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey && sendOnEnter && !isMobile) {
                          e.preventDefault()
                          generate()
                        }
                      }}
                      onFocus={() => setInputFocused(true)}
                      onBlur={() => setInputFocused(false)}
                      placeholder={isOverLimit ? "Connect Studio to keep generating…" : "Message Zorin"}
                      disabled={loading || isOverLimit}
                      rows={1}
                      style={{
                        width: "100%",
                        background: "transparent",
                        border: "none",
                        outline: "none",
                        boxShadow: "none",
                        resize: "none",
                        fontSize: 14.5,
                        color: "#e8e9ec",
                        lineHeight: 1.6,
                        fontFamily: "inherit",
                        minHeight: 24,
                        maxHeight: 160,
                        overflowY: "auto",
                      }}
                    />

                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                      {/* Deep thinking */}
                      <button
                        type="button"
                        onClick={() => setMode(mode === "thinking" ? "generate" : "thinking")}
                        className={mode === "thinking" ? "pill-btn active" : "pill-btn"}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 11px",
                          borderRadius: 100,
                          background: mode === "thinking" ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.04)",
                          border: mode === "thinking" ? "1px solid rgba(255,255,255,0.14)" : "1px solid rgba(255,255,255,0.07)",
                          color: mode === "thinking" ? "#fff" : "rgba(255,255,255,0.48)",
                          fontSize: 12.5,
                          fontWeight: 500,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          transition: "all .18s ease",
                        }}
                      >
                        <i className="bi bi-stack" style={{ fontSize: 11.5 }} />
                        Deep thinking
                      </button>

                      {/* Smart Search */}
                      <button
                        type="button"
                        className="pill-btn active"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 11px",
                          borderRadius: 100,
                          background: "rgba(255,255,255,0.08)",
                          border: "1px solid rgba(255,255,255,0.12)",
                          color: "rgba(255,255,255,0.62)",
                          fontSize: 12.5,
                          fontWeight: 500,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          transition: "all .18s ease",
                        }}
                      >
                        <i className="bi bi-globe" style={{ fontSize: 11.5 }} />
                        Smart Search
                      </button>

                      <div style={{ flex: 1, minWidth: 6 }} />

                      {showLimitBanner && !isOverLimit && (
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", fontWeight: 500, marginRight: 2 }}>{PROMPT_LIMIT_UNCONNECTED - promptUsed} left</span>
                      )}

                      <button
                        type="button"
                        aria-label="Attach"
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          background: "transparent",
                          border: "none",
                          color: "rgba(255,255,255,0.32)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all .15s ease",
                        }}
                        className="nav-btn"
                      >
                        <i className="bi bi-paperclip" style={{ fontSize: 16 }} />
                      </button>

                      {loading ? (
                        <button
                          type="button"
                          onClick={() => {
                            setStopping(true)
                            abortRef.current?.abort()
                          }}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            border: "none",
                            cursor: "pointer",
                            background: stopping ? "rgba(252,129,129,0.06)" : "rgba(252,129,129,0.11)",
                            color: "#fc8181",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all .2s ease",
                            flexShrink: 0,
                          }}
                        >
                          {stopping ? (
                            <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(252,129,129,0.25)", borderTopColor: "#fc8181", animation: "spin .7s linear infinite" }} />
                          ) : (
                            <i className="bi bi-stop-fill" style={{ fontSize: 13 }} />
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => generate()}
                          disabled={!prompt.trim() || isOverLimit}
                          className="send-btn"
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            border: "none",
                            cursor: prompt.trim() && !isOverLimit ? "pointer" : "not-allowed",
                            background: prompt.trim() && !isOverLimit ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.07)",
                            color: prompt.trim() && !isOverLimit ? "#fff" : "rgba(255,255,255,0.22)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all .2s cubic-bezier(.34,1.56,.64,1)",
                            flexShrink: 0,
                          }}
                        >
                          <i
                            className="bi bi-arrow-up"
                            style={{
                              fontSize: 16,
                              fontWeight: 700,
                              transition: "transform .22s cubic-bezier(.34,1.56,.64,1)",
                              transform: sendBtnBounce ? "translateY(-3px)" : "translateY(0)",
                            }}
                          />
                        </button>
                      )}
                    </div>
                  </div>

                  {isOverLimit && (
                    <div style={{ width: "100%", maxWidth: 680, marginTop: 12 }}>
                      <PromptLimitBanner used={promptUsed} limit={PROMPT_LIMIT_UNCONNECTED} />
                    </div>
                  )}
                </div>
              )
            }
            return (
              <>
                {/* Messages */}
                <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
                  <div style={{ maxWidth: 720, margin: "0 auto", padding: isMobile ? "18px 16px 20px" : "28px 24px 24px", display: "flex", flexDirection: "column", gap: "var(--compact-gap, 28px)" }}>
                    {loadingMsgs ? (
                      <div style={{ display: "flex", justifyContent: "center", padding: 70 }}>
                        <div style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.08)", borderTopColor: "rgba(255,255,255,0.55)", animation: "spin .7s linear infinite" }} />
                      </div>
                    ) : (
                      <>
                        {messages.map((msg, idx) => {
                          if (hiddenIndices.has(idx)) return null
                          return (
                            <div key={msg.id} id={"msg-" + msg.id}>
                              <MessageBubble
                                msg={msg}
                                isMobile={isMobile}
                                pluginConnected={pluginConnected}
                                index={idx}
                                qaHistory={buildQAChain(messages, idx)}
                                onSuggestionClick={(s) => {
                                  setPrompt(s)
                                  requestAnimationFrame(() => textareaRef.current?.focus())
                                }}
                                onClarificationAnswer={handleClarificationAnswer}
                                onRetry={() => {
                                  if (lastUserPrompt) generate(lastUserPrompt)
                                }}
                                onFeedback={(msgId) => {
                                  setFeedbackMsgId(msgId)
                                  setFeedbackOpen(true)
                                }}
                              />
                            </div>
                          )
                        })}
                        {loading && generationSteps.length > 0 && (
                          <div style={{ animation: "msgInLeft .32s cubic-bezier(.16,1,.3,1) both" }}>
                            <ThinkingPill steps={generationSteps} />
                          </div>
                        )}
                        {loading && generationSteps.length === 0 && <TypingIndicator />}
                      </>
                    )}
                    <div ref={bottomRef} style={{ height: 1, flexShrink: 0 }} />
                  </div>
                </div>

                {showScrollBtn && (
                  <button
                    type="button"
                    onClick={scrollToBottom}
                    style={{
                      position: "absolute",
                      bottom: 96,
                      left: "50%",
                      transform: "translateX(-50%)",
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "rgba(24,24,27,0.96)",
                      backdropFilter: "blur(20px)",
                      WebkitBackdropFilter: "blur(20px)",
                      border: "1px solid rgba(255,255,255,0.10)",
                      color: "rgba(255,255,255,0.62)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
                      animation: "fadeSlideUp .3s cubic-bezier(.16,1,.3,1) both",
                      zIndex: 20,
                    }}
                  >
                    <i className="bi bi-chevron-down" style={{ fontSize: 16 }} />
                    {unreadCount > 0 && (
                      <div
                        style={{
                          position: "absolute",
                          top: -4,
                          right: -4,
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          background: "rgba(255,255,255,0.9)",
                          color: "#09090b",
                          fontSize: 10,
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </div>
                    )}
                  </button>
                )}

                {/* Bottom input – when chatting, same card but docked */}
                <div
                  style={{
                    position: "relative",
                    zIndex: 30,
                    padding: isMobile ? "10px 12px calc(12px + env(safe-area-inset-bottom))" : "12px 20px 16px",
                    background: "linear-gradient(to top, #09090b 78%, rgba(9,9,11,0.92) 92%, transparent)",
                    animation: "inputShift .4s cubic-bezier(.16,1,.3,1) both",
                    flexShrink: 0,
                  }}
                >
                  {showLimitBanner && (
                    <div style={{ maxWidth: 720, margin: "0 auto 8px" }}>
                      <PromptLimitBanner used={promptUsed} limit={PROMPT_LIMIT_UNCONNECTED} />
                    </div>
                  )}

                  <div
                    style={{
                      maxWidth: 720,
                      margin: "0 auto",
                      display: "flex",
                      alignItems: "flex-end",
                      gap: 8,
                      background: inputFocused ? "#1e1e1f" : "#1c1c1f",
                      border: isOverLimit
                        ? "1px solid rgba(252,100,100,0.22)"
                        : inputFocused
                          ? "1px solid rgba(255,255,255,0.13)"
                          : "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 20,
                      padding: isMobile ? "8px 8px 8px 14px" : "10px 10px 10px 16px",
                      boxShadow: inputFocused && !isOverLimit ? "0 0 0 3px rgba(255,255,255,0.04), 0 8px 32px rgba(0,0,0,0.32)" : "none",
                      opacity: loading ? 0.62 : isOverLimit ? 0.55 : 1,
                      pointerEvents: loading || isOverLimit ? "none" : "auto",
                      transition: "background .22s ease, border-color .22s ease, box-shadow .22s ease, opacity .2s ease",
                    }}
                  >
                    <textarea
                      ref={textareaRef}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey && sendOnEnter && !isMobile) {
                          e.preventDefault()
                          generate()
                        }
                      }}
                      onFocus={() => setInputFocused(true)}
                      onBlur={() => setInputFocused(false)}
                      placeholder={isOverLimit ? "Connect Studio to keep generating…" : "Message Zorin"}
                      disabled={loading || isOverLimit}
                      rows={1}
                      style={{
                        flex: 1,
                        background: "transparent",
                        border: "none",
                        outline: "none",
                        boxShadow: "none",
                        resize: "none",
                        fontSize: 14.5,
                        color: "#e8e9ec",
                        lineHeight: 1.6,
                        fontFamily: "inherit",
                        minHeight: 22,
                        maxHeight: isMobile ? 110 : 160,
                        overflowY: "auto",
                      }}
                    />
                    {loading ? (
                      <button
                        type="button"
                        onClick={() => {
                          setStopping(true)
                          abortRef.current?.abort()
                        }}
                        style={{
                          width: isMobile ? 34 : 36,
                          height: isMobile ? 34 : 36,
                          borderRadius: "50%",
                          border: "none",
                          flexShrink: 0,
                          background: stopping ? "rgba(252,129,129,0.06)" : "rgba(252,129,129,0.11)",
                          color: "#fc8181",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all .2s ease",
                        }}
                      >
                        {stopping ? (
                          <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(252,129,129,0.25)", borderTopColor: "#fc8181", animation: "spin .7s linear infinite" }} />
                        ) : (
                          <i className="bi bi-stop-fill" style={{ fontSize: 13 }} />
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => generate()}
                        disabled={!prompt.trim() || isOverLimit}
                        className="send-btn"
                        style={{
                          width: isMobile ? 34 : 36,
                          height: isMobile ? 34 : 36,
                          borderRadius: "50%",
                          border: "none",
                          flexShrink: 0,
                          background: prompt.trim() && !isOverLimit ? "#fff" : "rgba(255,255,255,0.07)",
                          color: prompt.trim() && !isOverLimit ? "#09090b" : "rgba(255,255,255,0.22)",
                          cursor: prompt.trim() && !isOverLimit ? "pointer" : "not-allowed",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all .2s cubic-bezier(.34,1.56,.64,1)",
                        }}
                      >
                        <i
                          className="bi bi-arrow-up-short"
                          style={{
                            fontSize: 22,
                            transition: "transform .22s cubic-bezier(.34,1.56,.64,1)",
                            transform: sendBtnBounce ? "translateY(-4px)" : "translateY(0)",
                          }}
                        />
                      </button>
                    )}
                  </div>
                </div>
              </>
            )
          })()}
        </main>
      </div>
    </>
  )
}
