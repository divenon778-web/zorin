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

const STORAGE_KEY_REDUCE_MOTION  = "wisp_reduce_motion"
const STORAGE_KEY_SEND_ON_ENTER  = "wisp_send_on_enter"
const STORAGE_KEY_COMPACT_MODE   = "wisp_compact_mode"

const MODES = [
  { id: "generate", label: "Generate", icon: "bi-stars" },
  { id: "thinking", label: "Thinking", icon: "bi-lightbulb" },
] as const
type ModeId = typeof MODES[number]["id"]

const PROJECT_TYPES = [
  { id: "scripting", label: "Scripting", icon: "bi-code-slash" },
  { id: "plan",      label: "Plan",      icon: "bi-list-check" },
] as const
type ProjectTypeId = typeof PROJECT_TYPES[number]["id"]

const AVAILABLE_MODELS = [
  { id: "gpt-5.6-sol", label: "GPT 5.6 Sol", logo: "/assistant/brands/openai.svg" },
] as const
type ModelId = typeof AVAILABLE_MODELS[number]["id"]

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

function getTimeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return "just now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString()
}
function stripTicks(t: string) { if (!t) return t; return t.replace(/```[\w]*/g, "").replace(/`/g, "").trim() }
function stripThinking(t: string) { if (!t) return t; return t.replace(/<think>[\s\S]*?<\/think>/g, "").trim() }

function extractJson(raw: string): any {
  const text = raw.trim()

  const codeBlockRegex = /```[\s\S]*?\n([\s\S]*?)```/g
  const scripts: any[] = []
  let match
  let scriptIndex = 0
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const code = match[1].trim()
    if (code) {
      scriptIndex++
      const isLocal = code.includes("LocalPlayer") || code.includes("StarterPlayer") || code.includes("UserInputService")
      scripts.push({
        name: `Script${scriptIndex > 1 ? scriptIndex : ""}`,
        type: isLocal ? "LocalScript" : "Script",
        parent: "ServerScriptService",
        code,
      })
    }
  }

  if (scripts.length > 0) {
    return {
      type: "generation",
      title: "Here is ur Scripts",
      summary: "",
      notes: [],
      warnings: [],
      suggestions: [],
      instances: [],
      deletions: [],
      scripts,
      thoughts: [],
      plan: [],
      thinking_steps: [],
    }
  }

  let cleaned = text
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/```\s*$/m, "")
    .trim()

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]) } catch {}
  }

  try { return JSON.parse(cleaned) } catch {}

  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  if (start !== -1 && end > start) {
    try { return JSON.parse(cleaned.slice(start, end + 1)) } catch {}
  }

  return null
}

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

/* ──────────────── CREDITS LOW BANNER ──────────────── */

function CreditsLowBanner({ credits }: { credits: number }) {
  const isOut = credits <= 0
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
          ? "You've run out of credits. Upgrade to keep generating."
          : `Only ${credits} credit${credits !== 1 ? "s" : ""} left. Each prompt uses 1 credit.`}
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
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.42)" }}>plugin not connected — scripts generated but won't auto-insert. <a href="https://wisprblx.site" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,0.42)", textDecoration: "underline" }}>get help</a></span>
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
  const [pluginToken,       setPluginToken]       = useState(() => typeof window !== "undefined" ? window.localStorage.getItem("wisp_plugin_token") || "" : "")
  const [datamodelSnapshot, setDatamodelSnapshot] = useState<Record<string, string[]>>({})
  const [gameModelJson,     setGameModelJson]     = useState<string | null>(null)
  const [stopping,          setStopping]          = useState(false)
  const [lastUserPrompt,    setLastUserPrompt]    = useState("")
  const [sendBtnBounce,     setSendBtnBounce]     = useState(false)
  const [inputFocused,      setInputFocused]      = useState(false)
  const [planHovered,       setPlanHovered]       = useState(false)
  const [promptUsed,        setPromptUsed]        = useState(0)
  const [credits,           setCredits]           = useState<number | null>(null)

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
  const [sidebarOpen,       setSidebarOpen]       = useState(false)
  const [sidebarSearch,     setSidebarSearch]     = useState("")
  const [userProjects,      setUserProjects]      = useState<Project[]>([])

  const bottomRef      = useRef<HTMLDivElement>(null)
  const scrollRef       = useRef<HTMLDivElement>(null)
  const textareaRef    = useRef<HTMLTextAreaElement>(null)
  const abortRef       = useRef<AbortController | null>(null)
  const modeMenuRef    = useRef<HTMLDivElement>(null)
  const typeMenuRef    = useRef<HTMLDivElement>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const prevMsgCountRef = useRef(0)
  const prevPluginRef   = useRef<boolean | null>(null)

  // Derived: is this user out of credits?
  const isUnlimited = profile?.unlimited_prompts === true
  const isOverCredits = credits !== null && credits <= 0 && !isUnlimited
  const isOverLimit = isOverCredits
  const showLimitBanner = !isUnlimited && credits !== null && credits <= 5 && credits > 0
  

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

      // Load all user projects for sidebar history
      const { data: allProjects } = await supabase.from("projects").select("*").eq("user_id", session.user.id).order("updated_at", { ascending: false })
      setUserProjects((allProjects || []) as Project[])

      // Load prompt usage for this user
      const { data: usage } = await supabase
        .from("prompt_usage")
        .select("used_count")
        .eq("user_id", session.user.id)
        .single()
      if (usage) setPromptUsed(usage.used_count || 0)

      // Load credits from profile
      if (prof.credits !== undefined && prof.credits !== null) {
        setCredits(prof.credits)
      } else {
        setCredits(50)
      }
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
          if (data.token) { setPluginToken(data.token); window.localStorage.setItem("wisp_plugin_token", data.token) }
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

  // Increment prompt_usage in Supabase and deduct credits
  const incrementPromptUsage = async () => {
    if (!profile) return
    const newCount = promptUsed + 1
    setPromptUsed(newCount)
    await supabase.from("prompt_usage").upsert(
      { user_id: profile.id, used_count: newCount, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )
    // Deduct 1 credit
    if (credits !== null && !isUnlimited) {
      const newCredits = Math.max(0, credits - 1)
      setCredits(newCredits)
      await supabase.from("profiles").update({ credits: newCredits }).eq("id", profile.id)
    }
  }

  const generate = async (overridePrompt?: string) => {
    if (!profile || !project) return
    const userPrompt = (overridePrompt ?? prompt).trim()
    if (!userPrompt || loading) {
      if (!userPrompt && !overridePrompt) { setShakeSend(true); setTimeout(() => setShakeSend(false), 420); textareaRef.current?.focus() }
      return
    }

    // Enforce credit limit
    if (!isUnlimited && credits !== null && credits <= 0) {
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

      // Increment usage and deduct credits
      if (!isUnlimited) {
        await incrementPromptUsage()
      }

      const aiBase = process.env.NEXT_PUBLIC_AI_API_URL ?? "https://wisprblx.site"
      const endpoint = mode === "thinking"
        ? `${aiBase}/generate/thinking`
        : `${aiBase}/generate`

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setStopping(false)

      const fetchStepsEarly = async (): Promise<string[]> => {
        try {
          const stepsController = new AbortController()
          const stepsTimeout = setTimeout(() => stepsController.abort(), 10000)
          const res = await fetch(`${aiBase}/thinking-steps`, {
            method: "POST", headers: { "Content-Type": "application/json" }, signal: stepsController.signal,
            body: JSON.stringify({ prompt: userPrompt, projectId: currentProjectId, projectName: currentProjectName, locale, language: LOCALES.find(l => l.code === locale)?.label || "English" }),
          })
          clearTimeout(stepsTimeout)
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
                model: "gpt-5.6-sol",
              projectId: currentProjectId, projectName: currentProjectName,
              history: historyForBackend.length > 0 ? historyForBackend : undefined,
              datamodel: Object.keys(datamodelSnapshot).length > 0 ? datamodelSnapshot : undefined,
              gameModel: gameModelJson || undefined,
              pluginToken: pluginToken || undefined,
              stream: true,
            }),
          })
          if (!res.ok) {
            try {
              const errBody = await res.json()
              throw new Error(errBody?.message || errBody?.error || `server error (${res.status})`)
            } catch {
              throw new Error(`server error (${res.status})`)
            }
          }

          const contentType = res.headers.get("content-type") || ""
          if (contentType.includes("text/event-stream") && res.body) {
            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let meta: { __model?: string; __provider?: string } | null = null
            let output = ""
            let buffer = ""

            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              buffer += decoder.decode(value, { stream: true })

              const lines = buffer.split("\n")
              buffer = lines.pop() || ""

              for (const line of lines) {
                if (!line.startsWith("data: ")) continue
                const data = line.slice(6).trim()
                if (data === "[DONE]") continue
                try {
                  const parsed = JSON.parse(data)
                  const delta = parsed.choices?.[0]?.delta
                  if (delta?.content) output += delta.content
                  if (!meta && parsed.__model) meta = parsed
                } catch {}
              }
            }

            try {
              const cleaned = stripThinking(output)
              const parsed = extractJson(cleaned)
              if (parsed) {
                if (meta) { parsed.__model = meta.__model; parsed.__provider = meta.__provider }
                return parsed
              }
              return { type: "chat", message: output || "Empty response", __model: meta?.__model || "" }
            } catch {
              return { type: "chat", message: output || "Empty response", __model: meta?.__model || "" }
            }
          }

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

    } catch (err: any) {
      stepControl.finish()
      setGenerationSteps(prev => prev.map(s => ({ ...s, status: "error" as const })))
      const reason = err?.message && err.message !== "server error"
        ? err.message
        : "Something went wrong. Check your connection and try again."
      setMessages(prev => [
        ...prev.filter(m => m.id !== tempMsg.id),
        {
          id: "err-" + Date.now(), project_id: project.id, user_id: profile.id, role: "assistant",
          content: JSON.stringify({ type: "chat", message: reason, __model: "" }),
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
        ::placeholder { color: rgba(255,255,255,0.20); }
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

        .script-chip:hover       { background: rgba(255,255,255,0.08) !important; transform: translateY(-2px) !important; box-shadow: 0 6px 18px rgba(0,0,0,0.35) !important; transition: all .24s cubic-bezier(.34,1.56,.64,1) !important; }
        .suggestion-chip:hover   { background: rgba(255,255,255,0.08) !important; color: #e8e9ec !important; transform: translateY(-1px) !important; transition: all .18s ease !important; }
        .reaction-btn:hover      { background: rgba(255,255,255,0.055) !important; color: rgba(255,255,255,0.62) !important; transform: translateY(-1px) !important; transition: all .15s ease !important; }
        .clarif-opt:hover        { background: rgba(255,255,255,0.09) !important; color: #e8e9ec !important; border-color: rgba(255,255,255,0.18) !important; transform: translateY(-1px) !important; transition: all .2s cubic-bezier(.34,1.56,.64,1) !important; }
        .g-menu-item:hover       { background: rgba(255,255,255,0.07) !important; color: #fff !important; }
        .g-signout:hover         { color: #fc8181 !important; }
        .nav-btn:hover           { background: rgba(255,255,255,0.06) !important; transition: all .15s ease !important; }
        .send-btn:hover:not(:disabled) { transform: scale(1.10) !important; box-shadow: 0 4px 22px rgba(255,255,255,0.18) !important; transition: all .2s cubic-bezier(.34,1.56,.64,1) !important; }
        .send-btn:active:not(:disabled) { animation: sendPop .3s ease !important; }
        .mode-pill:hover         { background: rgba(255,255,255,0.08) !important; border-color: rgba(255,255,255,0.15) !important; transition: all .15s ease !important; }
        .type-pill:hover         { background: rgba(255,255,255,0.08) !important; border-color: rgba(255,255,255,0.15) !important; transition: all .15s ease !important; }
        .type-pill:hover .type-pill-icon { transform: rotate(-18deg) scale(1.18) !important; }
        .plan-menu-item:hover .plan-icon  { transform: rotate(-18deg) scale(1.18) !important; }
        .plan-menu-item:hover .plan-coming-soon { opacity: 1 !important; pointer-events: none; animation: tooltipDown .22s cubic-bezier(.34,1.56,.64,1) both !important; }
        .reasoning-toggle:hover  { opacity: 0.75; }
        .reasoning-row:hover     { background: rgba(255,255,255,0.018) !important; }
        .credits-pill:hover      { background: rgba(255,255,255,0.08) !important; border-color: rgba(255,255,255,0.15) !important; transition: all .15s ease !important; }
        .sidebar-overlay         { opacity: 1; pointer-events: auto; }
        .sidebar-panel           { transform: translateX(0); }
        .sidebar-item:hover      { background: rgba(255,255,255,0.06) !important; }
        .sidebar-item.active     { background: rgba(255,255,255,0.08) !important; border-color: rgba(255,255,255,0.12) !important; }
      `}</style>

      <FeedbackModal open={feedbackOpen} onClose={() => { setFeedbackOpen(false); setFeedbackMsgId(null) }} onSubmit={submitFeedback} sending={feedbackSending} isMobile={isMobile} />
      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} profile={profile} locale={locale} setLocale={setLocale} />
      {isAdmin && <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} />}

      {/* ── SIDEBAR OVERLAY ── */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 90,
            background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
            animation: "fadeIn .2s ease forwards",
          }}
        />
      )}

      {/* ── SIDEBAR PANEL ── */}
      <div style={{
        position: "fixed", top: 12, left: 12, bottom: 12,
        width: isMobile ? "calc(100vw - 24px)" : 280,
        zIndex: 95,
        background: "rgba(17,17,20,0.97)",
        backdropFilter: "blur(40px) saturate(1.5)", WebkitBackdropFilter: "blur(40px) saturate(1.5)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 18,
        boxShadow: "0 24px 80px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.06)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        transform: sidebarOpen ? "translateX(0)" : "translateX(-110%)",
        opacity: sidebarOpen ? 1 : 0,
        pointerEvents: sidebarOpen ? "auto" : "none",
        transition: "transform .3s cubic-bezier(.16,1,.3,1), opacity .25s ease",
      }}>
        {/* sidebar header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 14px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <button type="button" onClick={() => setSidebarOpen(false)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", borderRadius: 8, background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600, fontFamily: "inherit", transition: "all .15s ease" }} className="nav-btn">
            <svg width="14" height="14" viewBox="0 0 15 15" fill="none"><path d="M9.5 11.5L5.5 7.5l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Back to Toolbox
          </button>
          <button type="button" onClick={() => setSidebarOpen(false)} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 7, background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", transition: "all .15s ease" }} className="nav-btn">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="2" width="5" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="8" y="2" width="5" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/></svg>
          </button>
        </div>

        {/* new chat button */}
        <div style={{ padding: "12px 14px 10px" }}>
          <button type="button" onClick={() => { setSidebarOpen(false); router.push("/dashboard") }} style={{
            width: "100%", padding: "11px 0", borderRadius: 12, border: "none",
            background: "#6b7280",
            color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
            fontFamily: "inherit", letterSpacing: "0.01em",
            boxShadow: "0 4px 16px rgba(75,85,99,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
            transition: "all .2s ease",
          }}>
            + New Chat
          </button>
        </div>

        {/* search */}
        <div style={{ padding: "0 14px 10px" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "9px 12px", borderRadius: 11,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, opacity: 0.35 }}><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/><path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
            <input
              type="text"
              value={sidebarSearch}
              onChange={e => setSidebarSearch(e.target.value)}
              placeholder="Search"
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                fontSize: 13, color: "#e8e9ec", fontFamily: "inherit",
              }}
            />
          </div>
        </div>

        {/* history list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 14px" }}>
          {userProjects.filter(p => !sidebarSearch || p.name.toLowerCase().includes(sidebarSearch.toLowerCase())).length === 0 ? (
            <div style={{ padding: "24px 14px", textAlign: "center" }}>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.22)" }}>Sign in to sync chats</span>
            </div>
          ) : (
            userProjects
              .filter(p => !sidebarSearch || p.name.toLowerCase().includes(sidebarSearch.toLowerCase()))
              .map(p => {
                const isActive = p.id === projectId
                const timeAgo = getTimeAgo(p.updated_at)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { router.push(`/project/${p.id}`); setSidebarOpen(false) }}
                    className={`sidebar-item${isActive ? " active" : ""}`}
                    style={{
                      width: "100%", display: "flex", flexDirection: "column", gap: 3,
                      padding: "10px 12px", borderRadius: 11, marginBottom: 2,
                      background: isActive ? "rgba(255,255,255,0.06)" : "transparent",
                      border: isActive ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent",
                      cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                      transition: "all .15s ease",
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 500, color: isActive ? "#e8e9ec" : "rgba(255,255,255,0.55)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name || "Untitled"}</span>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.22)" }}>{timeAgo}</span>
                  </button>
                )
              })
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#09090b", fontFamily: "'Inter', sans-serif", color: "#e8e9ec" }}>

        {/* ── HEADER ── */}
        <header style={{
          display: "flex", alignItems: "center",
          padding: isMobile ? "0 14px" : "0 24px",
          height: isMobile ? 52 : 58,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(9,9,11,0.94)",
          backdropFilter: "blur(32px)", WebkitBackdropFilter: "blur(32px)",
          flexShrink: 0, zIndex: 40,
          animation: "headerSlide .45s cubic-bezier(.16,1,.3,1) both",
        }}>

          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
            <button type="button" onClick={() => setSidebarOpen(v => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 9, background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.38)", transition: "all .18s ease" }} className="nav-btn">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="1.5" rx="0.75" fill="currentColor"/><rect x="2" y="7.25" width="8" height="1.5" rx="0.75" fill="currentColor"/><rect x="2" y="11.5" width="10" height="1.5" rx="0.75" fill="currentColor"/></svg>
            </button>
            <button type="button" onClick={() => router.push("/dashboard")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 9px", borderRadius: 9, background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.38)", fontSize: 13, fontWeight: 500, fontFamily: "inherit", transition: "all .18s ease" }} className="nav-btn">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M9.5 11.5L5.5 7.5l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              {!isMobile && <span style={{ fontSize: 13 }}>Projects</span>}
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 9, animation: "headerFadeIn .5s .12s cubic-bezier(.16,1,.3,1) both", overflow: "hidden", maxWidth: isMobile ? "44vw" : 340 }}>
            <span style={{ fontSize: isMobile ? 14 : 15, fontWeight: 700, color: "#e8e9ec", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "-0.018em" }}>{project.name}</span>
            {/* Static dot — no pulse animation */}
            <div
              title={pluginConnected === true ? "Studio connected" : pluginConnected === null ? "Checking…" : "Studio offline"}
              style={{
                width: 7, height: 7, borderRadius: "50%", background: pluginDot, flexShrink: 0,
                transition: "background .5s ease",
                // Checking state: gentle opacity pulse only (no scale, no overflow)
                animation: pluginConnected === null ? "pulse 1.4s ease-in-out infinite" : "none",
              }}
            />
          </div>

          {/* ── PROFILE MENU ── */}
          <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }} ref={profileMenuRef}>
            <button type="button" className="nav-btn" onClick={() => setProfileMenuOpen(v => !v)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 8px 5px 5px", borderRadius: 10, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", transition: "all .18s ease" }}>
              <UserAvatar profile={profile} size={26} />
              {!isMobile && <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.62)" }}>{safeDisplayName(profile).split(" ")[0]}</span>}
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ opacity: 0.3, transform: profileMenuOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .22s cubic-bezier(.34,1.56,.64,1)" }}><path d="M1.5 3.5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>

            {profileMenuOpen && (
              <div style={{ position: "absolute", top: isMobile ? 52 : 58, right: isMobile ? 14 : 24, width: 210, ...glassModal, borderRadius: 14, padding: 5, animation: "menuIn .22s cubic-bezier(.16,1,.3,1)", zIndex: 100 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.07)", marginBottom: 4 }}>
                  <UserAvatar profile={profile} size={32} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{safeDisplayName(profile)}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>@{(profile as FullProfile).username || "user"}</div>
                  </div>
                </div>

                <button type="button" className="g-menu-item" onClick={() => { setSettingsOpen(true); setProfileMenuOpen(false) }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", borderRadius: 8, border: "none", background: "transparent", color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "background 0.15s, color 0.15s" }}>
                  <i className="bi bi-gear" style={{ fontSize: 14 }} />Settings
                </button>

                {isAdmin && (
                  <button type="button" className="g-menu-item" onClick={() => { setAdminOpen(true); setProfileMenuOpen(false) }}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", borderRadius: 8, border: "none", background: "transparent", color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "background 0.15s, color 0.15s" }}>
                    <i className="bi bi-shield-check" style={{ fontSize: 14 }} />Admin Panel
                  </button>
                )}

                <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "4px 0" }} />

                <button type="button" className="g-menu-item g-signout" onClick={async () => { await supabase.auth.signOut(); router.replace("/auth/login") }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", borderRadius: 8, border: "none", background: "transparent", color: "rgba(255,255,255,0.38)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "background 0.15s, color 0.15s" }}>
                  <i className="bi bi-box-arrow-right" style={{ fontSize: 14 }} />Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        {/* ── MESSAGES ── */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          <div style={{ maxWidth: 720, margin: "0 auto", padding: isMobile ? "24px 16px 130px" : "36px 24px 150px", display: "flex", flexDirection: "column", gap: "var(--compact-gap, 28px)" }}>
            {loadingMsgs ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 70 }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.08)", borderTopColor: "rgba(255,255,255,0.55)", animation: "spin .7s linear infinite" }} />
              </div>
            ) : messages.length === 0 && !loading ? (
              lateHour ? (
                <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 16, pointerEvents: "none", animation: "lateGreetIn .6s .1s cubic-bezier(.16,1,.3,1) both" }}>
                  <Image src={`${CDN}/icons/logo-white.png`} alt="Wisp" width={60} height={60} style={{ objectFit: "contain", opacity: 0.12, animation: "logoFloat 5s ease-in-out infinite" }} />
                  <p style={{ fontSize: isMobile ? 28 : 38, fontWeight: 800, letterSpacing: "-0.04em", color: "#e8e9ec", margin: 0, lineHeight: 1.1 }}>{greetingText}</p>
                  <p style={{ fontSize: isMobile ? 14 : 16, color: "rgba(255,255,255,0.25)", margin: 0 }}>{buildingPrompt}</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "90px 20px 0", textAlign: "center", gap: 12 }}>
                  <Image src={`${CDN}/icons/logo-white.png`} alt="Wisp" width={48} height={48} style={{ objectFit: "contain", opacity: 0.15, animation: "logoFloat 5s ease-in-out infinite" }} />
                  <p style={{ fontSize: isMobile ? 22 : 26, fontWeight: 800, letterSpacing: "-0.032em", color: "#e8e9ec", margin: 0, animation: "fadeSlideUp .5s .1s cubic-bezier(.16,1,.3,1) both" }}>{greetingText}</p>
                  <p style={{ fontSize: 14, color: "rgba(255,255,255,0.30)", margin: 0, animation: "fadeSlideUp .5s .18s cubic-bezier(.16,1,.3,1) both" }}>{buildingPrompt}</p>
                </div>
              )
            ) : (
              <>
                {messages.map((msg, idx) => {
                  if (hiddenIndices.has(idx)) return null
                  return (
                    <MessageBubble
                      key={msg.id} msg={msg} isMobile={isMobile} pluginConnected={pluginConnected}
                      index={idx}
                      qaHistory={buildQAChain(messages, idx)}
                      onSuggestionClick={s => { setPrompt(s); requestAnimationFrame(() => textareaRef.current?.focus()) }}
                      onClarificationAnswer={handleClarificationAnswer}
                      onRetry={() => { if (lastUserPrompt) generate(lastUserPrompt) }}
                      onFeedback={msgId => { setFeedbackMsgId(msgId); setFeedbackOpen(true) }}
                    />
                  )
                })}
                {loading && generationSteps.length > 0 && <div style={{ animation: "msgInLeft .32s cubic-bezier(.16,1,.3,1) both" }}><ThinkingPill steps={generationSteps} /></div>}
                {loading && generationSteps.length === 0 && <TypingIndicator />}
              </>
            )}
            <div ref={bottomRef} style={{ height: 1, flexShrink: 0 }} />
          </div>
        </div>

        {/* ── INPUT AREA ── */}
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 30,
          padding: isMobile ? "10px 12px calc(14px + env(safe-area-inset-bottom))" : "12px 24px 22px",
          background: "linear-gradient(to top, #09090b 60%, rgba(9,9,11,0.88) 85%, transparent)",
          animation: "inputAreaIn .55s .18s cubic-bezier(.16,1,.3,1) both",
        }}>
          <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 9 }}>

            {/* credits low banner */}
            {showLimitBanner && credits !== null && (
              <CreditsLowBanner credits={credits} />
            )}

            {/* toolbar row */}
            <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>

              {/* mode picker */}
              <div ref={modeMenuRef} style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setModeMenuOpen(v => !v)}
                  className="mode-pill"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 11px",
                    ...glassPill, borderRadius: 100, fontSize: 12, fontWeight: 600,
                    cursor: "pointer", color: "rgba(255,255,255,0.52)", border: "1px solid rgba(255,255,255,0.09)",
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  <i className={"bi " + currentMode.icon} style={{ fontSize: 12, transition: "transform .25s cubic-bezier(.34,1.56,.64,1)", transform: modeMenuOpen ? "rotate(-18deg) scale(1.18)" : "scale(1)" }} />
                  <span>{currentMode.label}</span>
                  <i className="bi bi-chevron-up" style={{ fontSize: 10, opacity: 0.36, transition: "transform .22s ease", transform: modeMenuOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
                </button>
                {modeMenuOpen && (
                  <div style={{ position: "absolute", bottom: "calc(100% + 9px)", left: 0, width: 185, ...glassModal, borderRadius: 15, padding: 6, zIndex: 100, animation: "menuUp .22s cubic-bezier(.16,1,.3,1)", fontFamily: "'Inter', sans-serif" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "5px 10px 5px", marginBottom: 2 }}>Mode</div>
                    {MODES.map((m, i) => (
                      <button key={m.id} type="button" onClick={() => { setMode(m.id); setModeMenuOpen(false) }}
                        style={{ width: "100%", padding: "9px 11px", borderRadius: 10, border: "none", background: mode === m.id ? "rgba(255,255,255,0.07)" : "transparent", cursor: "pointer", textAlign: "left", fontFamily: "'Inter', sans-serif", animation: `fadeSlideUp .18s ${i * 0.04}s cubic-bezier(.16,1,.3,1) both` }} className="g-menu-item">
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "#e8e9ec" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, fontWeight: 500 }}><i className={"bi " + m.icon} style={{ fontSize: 14 }} />{m.label}</div>
                          {mode === m.id && <i className="bi bi-check-lg" style={{ fontSize: 13, animation: "checkPop .2s cubic-bezier(.34,1.56,.64,1) both" }} />}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* type picker */}
              <div ref={typeMenuRef} style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setTypeMenuOpen(v => !v)}
                  className="type-pill"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 11px",
                    ...glassPill, borderRadius: 100, fontSize: 12, fontWeight: 600,
                    cursor: "pointer", color: "rgba(255,255,255,0.52)", border: "1px solid rgba(255,255,255,0.09)",
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  <i
                    className={"bi " + currentType.icon + " type-pill-icon"}
                    style={{
                      fontSize: 12,
                      transition: "transform .25s cubic-bezier(.34,1.56,.64,1)",
                      transform: typeMenuOpen ? "rotate(-18deg) scale(1.18)" : "scale(1)",
                    }}
                  />
                  <span>{currentType.label}</span>
                  <i className="bi bi-chevron-up" style={{ fontSize: 10, opacity: 0.36, transition: "transform .22s ease", transform: typeMenuOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
                </button>

                {typeMenuOpen && (
                  <div style={{ position: "absolute", bottom: "calc(100% + 9px)", left: 0, width: 165, ...glassModal, borderRadius: 15, padding: 6, zIndex: 100, animation: "menuUp .22s cubic-bezier(.16,1,.3,1)", fontFamily: "'Inter', sans-serif" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "5px 10px 5px", marginBottom: 2 }}>Type</div>

                    {PROJECT_TYPES.map((t, i) => {
                      const isPlan = t.id === "plan"
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            if (isPlan) return
                            setProjectType(t.id)
                            setTypeMenuOpen(false)
                          }}
                          onMouseEnter={() => { if (isPlan) setPlanHovered(true) }}
                          onMouseLeave={() => { if (isPlan) setPlanHovered(false) }}
                          style={{
                            width: "100%", padding: "9px 11px", borderRadius: 10, border: "none",
                            background: projectType === t.id ? "rgba(255,255,255,0.07)" : "transparent",
                            cursor: isPlan ? "default" : "pointer",
                            textAlign: "left", fontFamily: "'Inter', sans-serif",
                            animation: `fadeSlideUp .18s ${i * 0.04}s cubic-bezier(.16,1,.3,1) both`,
                            position: "relative",
                            overflow: "visible",
                          }}
                          className={isPlan ? "plan-menu-item" : "g-menu-item"}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: isPlan ? "rgba(255,255,255,0.38)" : "#e8e9ec" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, fontWeight: 500 }}>
                              <i
                                className={"bi " + t.icon + (isPlan ? " plan-icon" : "")}
                                style={{
                                  fontSize: 14,
                                  transition: "transform .25s cubic-bezier(.34,1.56,.64,1)",
                                  transform: isPlan && planHovered ? "rotate(-18deg) scale(1.18)" : "scale(1)",
                                }}
                              />
                              {t.label}
                            </div>
                            {projectType === t.id && !isPlan && <i className="bi bi-check-lg" style={{ fontSize: 13, animation: "checkPop .2s cubic-bezier(.34,1.56,.64,1) both" }} />}
                          </div>

                          {/* tooltip drops DOWN below the button */}
                          {isPlan && (
                            <div
                              className="plan-coming-soon"
                              style={{
                                position: "absolute",
                                top: "calc(100% + 8px)",
                                left: "50%",
                                transform: "translateX(-50%)",
                                background: "#000",
                                color: "#fff",
                                fontSize: 12,
                                fontWeight: 600,
                                padding: "6px 12px",
                                borderRadius: 9,
                                whiteSpace: "nowrap",
                                pointerEvents: "none",
                                opacity: planHovered ? 1 : 0,
                                transition: "opacity .18s ease",
                                animation: planHovered ? "tooltipDown .22s cubic-bezier(.34,1.56,.64,1) both" : "none",
                                boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
                                zIndex: 200,
                              }}
                            >
                              Coming soon
                              {/* arrow points UP */}
                              <div style={{
                                position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)",
                                width: 0, height: 0,
                                borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderBottom: "5px solid #000",
                              }} />
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {(Object.keys(datamodelSnapshot).length > 0 || gameModelJson) && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", ...glassPill, borderRadius: 100, border: "1px solid rgba(74,222,128,0.16)", animation: "chipPop .38s cubic-bezier(.34,1.56,.64,1) both" }}>
                  <i className="bi bi-diagram-3" style={{ fontSize: 11, color: "rgba(74,222,128,0.65)" }} />
                  <span style={{ fontSize: 11, color: "rgba(74,222,128,0.65)", fontWeight: 600 }}>Game scanned</span>
                </div>
              )}

              {/* model selector */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 11px", ...glassPill, borderRadius: 100, fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.52)", border: "1px solid rgba(255,255,255,0.09)", fontFamily: "'Inter', sans-serif" }}>
                <img
                  src="/assistant/brands/openai.svg"
                  alt="GPT 5.6 Sol"
                  style={{ width: 16, height: 16, background: "transparent", filter: "brightness(0) invert(1)", opacity: 0.52 }}
                />
                <span>GPT 5.6 Sol</span>
              </div>

              {/* credits pill — right side */}
              <div className="credits-pill" style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", ...glassPill, borderRadius: 100, fontSize: 12, fontWeight: 600, color: credits !== null && credits <= 5 && !isUnlimited ? "#fc8181" : "rgba(255,255,255,0.52)", border: credits !== null && credits <= 5 && !isUnlimited ? "1px solid rgba(252,100,100,0.2)" : "1px solid rgba(255,255,255,0.09)", fontFamily: "'Inter', sans-serif", transition: "all .3s ease", animation: "chipPop .38s cubic-bezier(.34,1.56,.64,1) both" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill={credits !== null && credits <= 5 && !isUnlimited ? "rgba(252,100,100,0.7)" : "rgba(255,192,72,0.8)"} stroke={credits !== null && credits <= 5 && !isUnlimited ? "rgba(252,100,100,0.4)" : "rgba(255,192,72,0.4)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>{isUnlimited ? "∞" : credits !== null ? credits.toLocaleString() : "—"}</span>
              </div>
            </div>

            {/* text input row */}
            <div style={{
              display: "flex", alignItems: "flex-end", gap: 9,
              background: inputFocused ? "rgba(255,255,255,0.055)" : "rgba(255,255,255,0.04)",
              border: isOverLimit
                ? "1px solid rgba(252,100,100,0.22)"
                : inputFocused ? "1px solid rgba(255,255,255,0.14)" : "1px solid rgba(255,255,255,0.08)",
              borderRadius: 18,
              padding: isMobile ? "7px 7px 7px 13px" : "9px 9px 9px 15px",
              boxShadow: inputFocused && !isOverLimit
                ? "0 0 0 3px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 32px rgba(0,0,0,0.25)"
                : "inset 0 1px 0 rgba(255,255,255,0.05)",
              opacity: loading ? 0.60 : isOverLimit ? 0.55 : 1,
              pointerEvents: loading || isOverLimit ? "none" : "auto",
              transition: "background .24s ease, border-color .24s ease, box-shadow .3s ease, opacity .2s ease",
            }}>
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && sendOnEnter && !isMobile) { e.preventDefault(); generate() } }}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                placeholder={isOverLimit ? "Out of credits…" : "Message Wisp…"}
                disabled={loading || isOverLimit}
                rows={1}
                style={{
                  flex: 1, background: "transparent", border: "none", outline: "none", boxShadow: "none",
                  resize: "none", fontSize: 14, color: "#e8e9ec", lineHeight: 1.65,
                  fontFamily: "inherit", minHeight: 22, maxHeight: isMobile ? 110 : 160, overflowY: "auto",
                }}
              />
              {loading ? (
                <button
                  type="button"
                  onClick={() => { setStopping(true); abortRef.current?.abort() }}
                  style={{
                    width: isMobile ? 36 : 38, height: isMobile ? 36 : 38, borderRadius: "50%",
                    border: "none", flexShrink: 0,
                    background: stopping ? "rgba(252,129,129,0.04)" : "rgba(252,129,129,0.09)",
                    color: "#fc8181", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all .2s ease",
                  }}
                >
                  {stopping
                    ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(252,129,129,0.25)", borderTopColor: "#fc8181", animation: "spin .7s linear infinite" }} />
                    : <i className="bi bi-stop-fill" style={{ fontSize: 14 }} />}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => generate()}
                  disabled={!prompt.trim() || isOverLimit}
                  className="send-btn"
                  style={{
                    width: isMobile ? 36 : 38, height: isMobile ? 36 : 38, borderRadius: "50%",
                    border: "none", flexShrink: 0,
                    background: prompt.trim() && !isOverLimit ? "#fff" : "rgba(255,255,255,0.06)",
                    color: prompt.trim() && !isOverLimit ? "#09090b" : "rgba(255,255,255,0.20)",
                    cursor: prompt.trim() && !isOverLimit ? "pointer" : "not-allowed",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all .2s cubic-bezier(.34,1.56,.64,1)",
                  }}
                >
                  <i className="bi bi-arrow-up-short" style={{
                    fontSize: 22,
                    transition: "transform .22s cubic-bezier(.34,1.56,.64,1)",
                    transform: sendBtnBounce ? "translateY(-4px)" : "translateY(0)",
                  }} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}