"use client";

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { supabase } from "@/lib/supabase"
import Settings from "@/app/components/Settings"
import { useI18n } from "@/app/localization/client"
import type { Profile, Project } from "@/lib/supabase"
import type { CSSProperties as Properties } from "react"


interface ProjectWithMeta extends Project {}

type SortKey = "updated" | "created" | "name"

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

const CDN = ""

type FullProfile = Profile & {
  avatar_url?:       string | null
  roblox_user_id?:   number | null
  display_name?:     string | null
  username?:         string | null
  discord_id?:       string | null
  discord_username?: string | null
  discord_avatar?:   string | null
}


function getAvatarUrl(p: Profile): string | null {
  const fp = p as FullProfile
  return fp.avatar_url?.trim() || null
}

function safeDisplayName(p: Profile): string {
  const fp = p as FullProfile
  return fp.display_name?.trim() || fp.username?.trim() || "User"
}

function safeUsername(p: Profile): string {
  const fp = p as FullProfile
  const u = fp.username?.trim()
  return u ? "@" + u : ""
}


function RobloxAvatar({ userId, size = 32 }: { userId: number; size?: number }) {
  const [url, setUrl] = useState<string | null>(null)
  const initial = String(userId).charAt(0).toUpperCase()

  useEffect(() => {
    fetch(`/api/roblox-avatar?userId=${userId}`)
      .then(r => r.json())
      .then(d => { if (d.url) setUrl(d.url) })
      .catch(err => console.error("[RobloxAvatar] fetch threw:", err))
  }, [userId])

  return (
    <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: "1.5px solid rgba(255,255,255,0.11)" }}>
      {url
        ? <img src={url} width={size} height={size} alt="" style={{ objectFit: "cover", width: "100%", height: "100%", display: "block" }} />
        : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,rgba(255,255,255,0.14) 0%,rgba(255,255,255,0.06) 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.4), fontWeight: 700, color: "rgba(255,255,255,0.85)", letterSpacing: "-0.01em" }}>{initial}</div>
      }
    </div>
  )
}

// ─── UserAvatar ───────────────────────────────────────────────────────────────
function UserAvatar({ profile, size = 32 }: { profile: Profile; size?: number }) {
  const fp = profile as FullProfile
  const avatarUrl = getAvatarUrl(profile)
  const initial   = safeDisplayName(profile).charAt(0).toUpperCase()

  if (fp.roblox_user_id && !avatarUrl) {
    return <RobloxAvatar userId={fp.roblox_user_id} size={size} />
  }

  return (
    <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: "1.5px solid rgba(255,255,255,0.11)", position: "relative" }}>
      {avatarUrl ? (
        <img src={avatarUrl} width={size} height={size} alt="" style={{ objectFit: "cover", width: "100%", height: "100%", display: "block" }} />
      ) : (
        <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,rgba(255,255,255,0.14) 0%,rgba(255,255,255,0.06) 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.4), fontWeight: 700, color: "rgba(255,255,255,0.85)", letterSpacing: "-0.01em" }}>
          {initial}
        </div>
      )}
    </div>
  )
}

// ─── ProjectThumbnail ─────────────────────────────────────────────────────────
function ProjectThumbnail({ placeId, onLoaded }: { placeId: number | null; onLoaded?: () => void }) {
  const [url,     setUrl]     = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!placeId) { setLoading(false); onLoaded?.(); return }
    fetch(`/api/roblox-thumbnail?placeId=${placeId}`)
      .then(r => r.json())
      .then(d => { if (d.url) setUrl(d.url) })
      .catch(() => {})
      .finally(() => { setLoading(false); onLoaded?.() })
  }, [placeId])

  if (loading) {
    return (
      <div className="g-shimmer" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <i className="bi bi-controller" style={{ fontSize: 30, color: "rgba(255,255,255,0.04)" }} />
      </div>
    )
  }

  if (!url) {
    return (
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.02)" }}>
        <i className="bi bi-controller" style={{ fontSize: 30, color: "rgba(255,255,255,0.07)" }} />
      </div>
    )
  }

  return (
    <img
      className="g-thumb-img"
      src={url}
      alt=""
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }}
    />
  )
}

// ─── Glass tokens ─────────────────────────────────────────────────────────────
const G = {
  fill:        "rgba(255,255,255,0.05)",
  fillHover:   "rgba(255,255,255,0.09)",
  border:      "rgba(255,255,255,0.10)",
  blur:        "blur(24px) saturate(1.6)",
  blurHeavy:   "blur(40px) saturate(1.8)",
  shadow:      "0 4px 24px rgba(0,0,0,0.35)",
  shadowModal: "0 16px 64px rgba(0,0,0,0.6)",
}

const glassPill: Properties = {
  background:           G.fill,
  backdropFilter:       G.blur,
  WebkitBackdropFilter: G.blur,
  border:               "1px solid " + G.border,
  boxShadow:            "inset 0 1px 0 rgba(255,255,255,0.10)",
}

const glassModal: Properties = {
  background:           "rgba(14,14,16,0.97)",
  backdropFilter:       G.blurHeavy,
  WebkitBackdropFilter: G.blurHeavy,
  border:               "1px solid rgba(255,255,255,0.11)",
  boxShadow:            ["inset 0 1px 0 rgba(255,255,255,0.12)", G.shadowModal].join(", "),
}

// ─── Shared modal backdrop ────────────────────────────────────────────────────
function ModalBackdrop({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.62)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "none", cursor: "default" }} />
}

// ─── ProjectLoadingOverlay ────────────────────────────────────────────────────
function ProjectLoadingOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(9,9,11,0.82)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14,
      animation: "gFadeIn 0.18s ease forwards",
    }}>

      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        border: "2.5px solid rgba(255,255,255,0.08)",
        borderTopColor: "rgba(255,255,255,0.38)",
        animation: "gSpin 0.75s linear infinite",
      }} />

      <span style={{
        fontSize: 12,
        fontWeight: 500,
        color: "rgba(255,255,255,0.28)",
        letterSpacing: "0.04em",
        fontFamily: "'Inter', sans-serif",
      }}>
        Loading project…
      </span>
    </div>
  )
}

// ─── DeleteConfirmModal ───────────────────────────────────────────────────────
function DeleteConfirmModal({ open, projectName, onConfirm, onCancel }: { open: boolean; projectName: string; onConfirm: () => void; onCancel: () => void }) {
  const [closing, setClosing] = useState(false)
  const close = () => { setClosing(true); setTimeout(() => { setClosing(false); onCancel() }, 220) }
  useEffect(() => {
    if (!open) return; setClosing(false)
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") close() }
    document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h)
  }, [open])
  if (!open && !closing) return null
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: closing ? "gFadeOut .22s ease forwards" : "gFadeIn .18s ease forwards" }}>
      <ModalBackdrop onClick={close} />
      <div style={{ position: "relative", width: "min(400px,calc(100vw - 40px))", ...glassModal, borderRadius: 20, overflow: "hidden", animation: closing ? "gScaleOut .22s ease forwards" : "gScaleIn .28s cubic-bezier(.16,1,.3,1) forwards" }}>
        <div style={{ padding: "24px 24px 20px" }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: "rgba(252,129,129,.10)", border: "1px solid rgba(252,129,129,.20)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, animation: "gShakeIn .4s cubic-bezier(.16,1,.3,1)" }}>
            <i className="bi bi-trash3" style={{ fontSize: 20, color: "#fc8181" }} />
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6, letterSpacing: "-0.02em", color: "#fff" }}>Delete project?</div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.55 }}>
            <span style={{ color: "rgba(255,255,255,.75)", fontWeight: 600 }}>{projectName}</span> and all its messages will be permanently deleted.
          </div>
        </div>
        <div style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />
        <div style={{ display: "flex", gap: 10, padding: "16px 24px" }}>
          <button type="button" onClick={close} style={{ flex: 1, height: 40, borderRadius: 10, ...glassPill, fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,.7)", cursor: "pointer", fontFamily: "inherit", transition: "all .18s" }}>Cancel</button>
          <button type="button" onClick={onConfirm} style={{ flex: 1, height: 40, borderRadius: 10, background: "rgba(252,129,129,.14)", border: "1px solid rgba(252,129,129,.28)", fontSize: 14, fontWeight: 700, color: "#fc8181", cursor: "pointer", fontFamily: "inherit", transition: "all .18s" }}>Delete</button>
        </div>
      </div>
    </div>
  )
}

// ─── NewProjectModal ──────────────────────────────────────────────────────────
function NewProjectModal({ open, onClose, profile, onCreate, creating }: { open: boolean; onClose: () => void; profile: Profile; onCreate: (name: string) => void; creating: boolean }) {
  const [name, setName] = useState("")
  const [closing, setClosing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const close = () => { setClosing(true); setTimeout(() => { setClosing(false); setName(""); onClose() }, 220) }
  const submit = () => { if (!name.trim() || creating) return; onCreate(name.trim().slice(0, 32)) }
  useEffect(() => { if (open) { setClosing(false); setName(""); setTimeout(() => inputRef.current?.focus(), 80) } }, [open])
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") close() }
    document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h)
  }, [open])
  if (!open && !closing) return null
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: closing ? "gFadeOut .22s ease forwards" : "gFadeIn .18s ease forwards" }}>
      <ModalBackdrop onClick={close} />
      <div style={{ position: "relative", width: "min(420px,calc(100vw - 32px))", ...glassModal, borderRadius: 20, overflow: "hidden", animation: closing ? "gScaleOut .22s ease forwards" : "gScaleIn .3s cubic-bezier(.16,1,.3,1) forwards" }}>
        <div style={{ padding: "20px 22px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>New project</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.35)", marginTop: 3 }}>Name your project to get started</div>
          </div>
          <button type="button" onClick={close} style={{ width: 30, height: 30, borderRadius: 8, ...glassPill, color: "rgba(255,255,255,.4)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, border: "1px solid rgba(255,255,255,0.10)", transition: "all .18s" }}>
            <i className="bi bi-x-lg" />
          </button>
        </div>
        <div style={{ padding: "18px 22px 10px" }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Project name</label>
          <input ref={inputRef} value={name} onChange={e => setName(e.target.value.slice(0, 32))} onKeyDown={e => e.key === "Enter" && submit()} placeholder="e.g. Combat System, Admin Panel…" maxLength={32}
            style={{ width: "100%", height: 44, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.10)", borderRadius: 11, padding: "0 14px", fontSize: 14, color: "#fff", fontFamily: "inherit", outline: "none", transition: "border-color .2s, box-shadow .2s" }} />
        </div>
        <div style={{ height: 1, background: "rgba(255,255,255,.07)", margin: "0 22px" }} />
        <div style={{ padding: "14px 22px 20px", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
          <button type="button" onClick={close} disabled={creating} style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.10)", background: "transparent", color: "rgba(255,255,255,.52)", fontSize: 13, fontWeight: 500, cursor: creating ? "not-allowed" : "pointer", transition: "all .18s" }}>Cancel</button>
          <button type="button" onClick={submit} disabled={creating || !name.trim()} style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: name.trim() && !creating ? "#fff" : "rgba(255,255,255,0.06)", color: name.trim() && !creating ? "#09090b" : "rgba(255,255,255,0.20)", fontSize: 13, fontWeight: 600, cursor: name.trim() && !creating ? "pointer" : "not-allowed", transition: "all .18s" }}>
            {creating ? "Creating…" : "Create project"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── AdminPanel ───────────────────────────────────────────────────────────────
type FeedbackRow = { id: string; feedback_text: string; created_at: string }
type AdminOverviewResponse = { ok: boolean; counts: { users: number | null; messages: number | null; projects: number | null }; feedback: FeedbackRow[] }

function AdminPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [closing,      setClosing]      = useState(false)
  const [tab,          setTab]          = useState<"overview" | "feedback" | "users">("overview")
  const [feedbackList, setFeedbackList] = useState<FeedbackRow[]>([])
  const [userList,     setUserList]     = useState<{ id: string; display_name: string | null; username: string | null; created_at: string; avatar_url?: string | null; roblox_user_id?: number | null }[]>([])
  const [userCount,    setUserCount]    = useState<number | null>(null)
  const [msgCount,     setMsgCount]     = useState<number | null>(null)
  const [projCount,    setProjCount]    = useState<number | null>(null)
  const [loading,      setLoading]      = useState(false)

  const close = () => { setClosing(true); setTimeout(() => { setClosing(false); onClose() }, 240) }

  useEffect(() => {
    if (!open) return; setClosing(false); setLoading(true)
    fetch("/api/admin/overview", { cache: "no-store" })
      .then(async r => { if (!r.ok) throw new Error(); return r.json() as Promise<AdminOverviewResponse> })
      .then(d => {
        setUserCount(d.counts.users); setMsgCount(d.counts.messages); setProjCount(d.counts.projects); setFeedbackList(d.feedback || [])
        supabase.from("profiles")
          .select("id, display_name, username, created_at, avatar_url, roblox_user_id")
          .order("created_at", { ascending: false }).limit(50)
          .then(({ data }) => { if (data) setUserList(data as typeof userList) })
      })
      .catch(() => { setUserCount(null); setMsgCount(null); setProjCount(null); setFeedbackList([]); setUserList([]) })
      .finally(() => setLoading(false))
  }, [open])

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") close() }
    document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h)
  }, [open])

  if (!open && !closing) return null

  const tabs = [
    { id: "overview"  as const, label: "Overview",  icon: "bi-bar-chart" },
    { id: "feedback"  as const, label: "Feedback",  icon: "bi-chat-left-text" },
    { id: "users"     as const, label: "Users",     icon: "bi-people" },
  ]

  const StatCard = ({ icon, label, value }: { icon: string; label: string; value: number | null }) => (
    <div style={{ flex: 1, padding: "16px 18px", ...glassPill, borderRadius: 14, transition: "transform .2s, box-shadow .2s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <i className={"bi " + icon} style={{ fontSize: 15, color: "rgba(255,255,255,.35)" }} />
        <span style={{ fontSize: 11, color: "rgba(255,255,255,.35)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", color: "#fff" }}>{value === null ? "—" : value.toLocaleString()}</div>
    </div>
  )

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: closing ? "gFadeOut .24s ease forwards" : "gFadeIn .18s ease forwards" }}>
      <ModalBackdrop onClick={close} />
      <div style={{ position: "relative", width: "min(720px,calc(100vw - 32px))", maxHeight: "82vh", ...glassModal, borderRadius: 24, overflow: "hidden", display: "flex", flexDirection: "column", animation: closing ? "gScaleOut .24s ease forwards" : "gScaleIn .3s cubic-bezier(.16,1,.3,1) forwards" }}>
        <div style={{ padding: "20px 20px 0", borderBottom: "1px solid rgba(255,255,255,.07)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, ...glassPill, display: "flex", alignItems: "center", justifyContent: "center" }}><i className="bi bi-shield-check" style={{ fontSize: 15 }} /></div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em", color: "#fff" }}>Admin</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,.35)" }}>wisp control panel</div>
              </div>
            </div>
            <button type="button" onClick={close} style={{ width: 30, height: 30, borderRadius: 8, ...glassPill, border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,.4)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, transition: "all .18s" }}><i className="bi bi-x-lg" /></button>
          </div>
          <div style={{ display: "flex", gap: 2 }}>
            {tabs.map(t => (
              <button key={t.id} type="button" onClick={() => setTab(t.id)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", background: "transparent", border: "none", cursor: "pointer", color: tab === t.id ? "#fff" : "rgba(255,255,255,.38)", fontWeight: tab === t.id ? 600 : 400, fontSize: 13, fontFamily: "inherit", borderBottom: tab === t.id ? "2px solid #fff" : "2px solid transparent", transition: "all .15s", marginBottom: -1 }}>
                <i className={"bi " + t.icon} style={{ fontSize: 14 }} />{t.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, gap: 14 }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid rgba(255,255,255,.12)", borderTopColor: "rgba(255,255,255,.7)", animation: "gSpin .7s linear infinite" }} />
              <span style={{ fontSize: 12, color: "rgba(255,255,255,.25)", animation: "gPulse 1.5s ease-in-out infinite" }}>Loading data…</span>
            </div>
          ) : tab === "overview" ? (
            <>
              <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                <StatCard icon="bi-people" label="Users" value={userCount} />
                <StatCard icon="bi-chat-dots" label="Messages" value={msgCount} />
                <StatCard icon="bi-folder" label="Projects" value={projCount} />
              </div>
              <div style={{ padding: "14px 16px", ...glassPill, borderRadius: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Recent feedback</div>
                {feedbackList.length === 0
                  ? <p style={{ fontSize: 13, color: "rgba(255,255,255,.35)" }}>No feedback yet.</p>
                  : feedbackList.slice(0, 5).map((fb, i) => (
                    <div key={fb.id} style={{ padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,.05)", animation: `gSlideDown .3s ${i * 0.05}s cubic-bezier(.16,1,.3,1) both` }}>
                      <div style={{ fontSize: 13, color: "rgba(255,255,255,.55)", lineHeight: 1.5 }}>{fb.feedback_text}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,.25)", marginTop: 4 }}>{new Date(fb.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                    </div>
                  ))}
              </div>
            </>
          ) : tab === "feedback" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {feedbackList.length === 0
                ? <div style={{ textAlign: "center", padding: 40 }}><p style={{ fontSize: 14, color: "rgba(255,255,255,.35)" }}>No feedback yet.</p></div>
                : feedbackList.map((fb, i) => (
                  <div key={fb.id} style={{ padding: "14px 16px", ...glassPill, borderRadius: 12, animation: `gSlideDown .3s ${i * 0.04}s cubic-bezier(.16,1,.3,1) both` }}>
                    <p style={{ fontSize: 14, color: "rgba(255,255,255,.6)", lineHeight: 1.6, margin: 0 }}>{fb.feedback_text}</p>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,.25)", marginTop: 8 }}>{new Date(fb.created_at).toLocaleDateString()}</div>
                  </div>
                ))}
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,.35)", marginBottom: 16 }}>{userCount !== null ? userCount + " registered users" : "Loading…"} · showing latest 50</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {userList.map((u, idx) => {
                  const userName = u.display_name || u.username || "Unnamed"
                  return (
                    <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", ...glassPill, borderRadius: 12, animation: `gSlideDown .3s ${idx * 0.03}s cubic-bezier(.16,1,.3,1) both`, transition: "background .18s" }}>
                      {u.roblox_user_id ? (
                        <RobloxAvatar userId={u.roblox_user_id} size={32} />
                      ) : (
                        <div style={{ width: 32, height: 32, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: "1.5px solid rgba(255,255,255,.10)" }}>
                          {u.avatar_url
                            ? <img src={u.avatar_url} width={32} height={32} style={{ objectFit: "cover", width: "100%", height: "100%", display: "block" }} alt="" />
                            : <div style={{ width: "100%", height: "100%", background: "rgba(255,255,255,.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,.7)" }}>{userName.charAt(0).toUpperCase()}</div>
                          }
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", display: "flex", alignItems: "center", gap: 6 }}>
                          {userName}
                          {u.roblox_user_id && (
                            <span style={{ fontSize: 10, color: "#00a2ff", background: "rgba(0,162,255,0.10)", border: "1px solid rgba(0,162,255,0.22)", borderRadius: 4, padding: "1px 5px", fontWeight: 600 }}>
                              Roblox
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,.3)" }}>{u.username ? "@" + u.username : "no username"} · joined {new Date(u.created_at).toLocaleDateString()}</div>
                      </div>
                      <div style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,.2)" }}>#{String(idx + 1).padStart(3, "0")}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main DashboardShell ──────────────────────────────────────────────────────
export default function DashboardShell({ profile, initialProjects }: { profile: Profile; initialProjects: Project[] }) {
  const { locale, setLocale } = useI18n()
  const [projects,         setProjects]         = useState<ProjectWithMeta[]>(initialProjects)
  const [newProjectOpen,   setNewProjectOpen]   = useState(false)
  const [creating,         setCreating]         = useState(false)
  const [deleteOpen,       setDeleteOpen]       = useState(false)
  const [deleteId,         setDeleteId]         = useState<string | null>(null)
  const [deleteName,       setDeleteName]       = useState("")
  const [settingsOpen,     setSettingsOpen]     = useState(false)
  const [adminOpen,        setAdminOpen]        = useState(false)
  const [profileMenuOpen,  setProfileMenuOpen]  = useState(false)
  const [sortMenuOpen,     setSortMenuOpen]     = useState(false)
  const [search,           setSearch]           = useState("")
  const [sort,             setSort]             = useState<SortKey>("updated")
  const [scrolled,         setScrolled]         = useState(false)
  // Project loading overlay
  const [loadingProject,   setLoadingProject]   = useState(false)
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null)

  const profileMenuRef = useRef<HTMLDivElement>(null)
  const sortMenuRef    = useRef<HTMLDivElement>(null)

  const fp        = profile as FullProfile
  const isAdmin   = !!(profile as FullProfile & { is_admin?: boolean }).is_admin
  const firstName = safeDisplayName(profile).split(" ")[0]

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 10)
    window.addEventListener("scroll", h, { passive: true })
    return () => window.removeEventListener("scroll", h)
  }, [])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) setProfileMenuOpen(false)
      if (sortMenuRef.current    && !sortMenuRef.current.contains(e.target as Node))    setSortMenuOpen(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  // Navigate to project after delay so loading screen is visible
  const handleProjectClick = (projectId: string) => {
    setLoadingProject(true)
    setPendingProjectId(projectId)
    const delay = 1000 + Math.random() * 2000
    setTimeout(() => {
      window.location.href = `/project/${projectId}`
    }, delay)
  }

  const displayed = useMemo(() => {
    let list = [...projects]
    if (search.trim()) { const q = search.toLowerCase(); list = list.filter(p => p.name.toLowerCase().includes(q)) }
    list.sort((a, b) => {
      if (sort === "name")    return a.name.localeCompare(b.name)
      if (sort === "created") return new Date(b.created_at || "").getTime() - new Date(a.created_at || "").getTime()
      return new Date(b.updated_at || b.created_at || "").getTime() - new Date(a.updated_at || a.created_at || "").getTime()
    })
    return list
  }, [projects, search, sort])

  const handleCreate = async (name: string) => {
    setCreating(true)
    const { data, error } = await supabase.from("projects").insert({ user_id: profile.id, name }).select().single()
    if (!error && data) { setProjects(prev => [data, ...prev]); setNewProjectOpen(false) }
    setCreating(false)
  }

  const promptDelete  = (id: string, name: string) => { setDeleteId(id); setDeleteName(name); setDeleteOpen(true) }
  const cancelDelete  = () => { setDeleteOpen(false); setDeleteId(null); setDeleteName("") }
  const confirmDelete = async () => {
    if (!deleteId) return; setDeleteOpen(false)
    const id = deleteId; setDeleteId(null); setDeleteName("")
    await supabase.from("projects").delete().eq("id", id)
    setProjects(prev => prev.filter(p => p.id !== id))
  }

  const signOut = async () => { await supabase.auth.signOut(); window.location.href = "/auth/login" }

  const sortLabels: Record<SortKey, string> = { updated: "Last updated", created: "Date created", name: "Name (A–Z)" }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; color: #d1d5db; background: #09090b; }
        p      { font-size: 18px; line-height: 1.6; letter-spacing: -0.01em; font-weight: 400; }
        strong { font-weight: 600; color: white; }
        ::placeholder { color: rgba(255,255,255,0.22); }
        input:focus   { outline: none; border-color: rgba(255,255,255,0.26) !important; box-shadow: 0 0 0 3px rgba(255,255,255,0.04) !important; }

        @keyframes gSpin      { to { transform: rotate(360deg) } }
        @keyframes gFadeIn    { from { opacity: 0 } to { opacity: 1 } }
        @keyframes gFadeOut   { from { opacity: 1 } to { opacity: 0 } }
        @keyframes gScaleIn   { from { opacity: 0; transform: scale(0.94) translateY(8px) } to { opacity: 1; transform: scale(1) translateY(0) } }
        @keyframes gScaleOut  { from { opacity: 1; transform: scale(1) translateY(0) } to { opacity: 0; transform: scale(0.94) translateY(6px) } }
        @keyframes gCardIn    { from { opacity: 0; transform: translateY(20px) scale(0.97) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes gMenuIn    { from { opacity: 0; transform: translateY(6px) scale(0.97) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes gHeaderIn  { from { opacity: 0; transform: translateY(-12px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes gHeroIn    { from { opacity: 0; transform: translateY(18px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes gSlideDown { from { opacity: 0; transform: translateY(-8px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes gShakeIn   { 0% { transform: scale(0.7) rotate(-8deg) } 60% { transform: scale(1.1) rotate(4deg) } 100% { transform: scale(1) rotate(0deg) } }
        @keyframes gShimmer   { 0% { background-position: -200% center } 100% { background-position: 200% center } }
        @keyframes gPulse     { 0%,100% { opacity: 1 } 50% { opacity: 0.4 } }
        @keyframes gFloat     { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
        @keyframes gBounceIn  { 0% { transform: scale(0) } 60% { transform: scale(1.15) } 100% { transform: scale(1) } }
        @keyframes gCountUp   { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }

        .g-nav-btn:hover       { background: rgba(255,255,255,0.07) !important; }
        .g-menu-item:hover     { background: rgba(255,255,255,0.07) !important; color: #fff !important; }
        .g-signout:hover       { color: #fc8181 !important; }
        .g-new-btn:hover       { background: rgba(255,255,255,0.10) !important; border-color: rgba(255,255,255,0.20) !important; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,0,0,0.3) !important; }
        .g-new-btn:active      { transform: translateY(0) scale(0.97) !important; }
        .g-add-card:hover      { background: rgba(255,255,255,0.05) !important; border-color: rgba(255,255,255,0.16) !important; color: rgba(255,255,255,0.5) !important; transform: translateY(-3px) !important; }

        /* Project card — NO upward translate on hover, just a subtle lift */
        .g-proj-card           { transition: box-shadow 0.26s ease, border-color 0.26s ease, opacity 0.2s ease !important; }
        .g-proj-card:hover     { box-shadow: 0 16px 40px rgba(0,0,0,0.45) !important; border-color: rgba(255,255,255,0.14) !important; }
        .g-proj-card:active    { opacity: 0.85 !important; }

        /* Delete button — smooth reveal, no shapeshifting */
        .g-proj-card .g-del-btn {
          opacity: 0;
          transform: scale(0.85);
          transition: opacity 0.2s ease, transform 0.2s ease, background 0.15s ease, color 0.15s ease, border-color 0.15s ease !important;
        }
        .g-proj-card:hover .g-del-btn {
          opacity: 1 !important;
          transform: scale(1) !important;
        }
        .g-del-btn:hover       { background: rgba(252,129,129,0.15) !important; color: #fc8181 !important; border-color: rgba(252,129,129,0.3) !important; }

        .g-sort-btn:hover      { background: rgba(255,255,255,0.07) !important; }
        .g-sort-item:hover     { background: rgba(255,255,255,0.06) !important; }
        .g-search:focus        { border-color: rgba(255,255,255,0.20) !important; }
        .g-close-search:hover  { color: rgba(255,255,255,0.6) !important; }
        .g-thumb-img           { transition: transform 0.5s ease !important; }
        .g-proj-card:hover .g-thumb-img { transform: scale(1.06) !important; }

        .g-shimmer {
          background: linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 75%);
          background-size: 200% 100%;
          animation: gShimmer 1.6s ease-in-out infinite;
        }
      `}</style>


      <ProjectLoadingOverlay visible={loadingProject} />

      <NewProjectModal open={newProjectOpen} onClose={() => setNewProjectOpen(false)} profile={profile} onCreate={handleCreate} creating={creating} />
      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} profile={profile} locale={locale} setLocale={setLocale} />
      {isAdmin && <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} />}
      <DeleteConfirmModal open={deleteOpen} projectName={deleteName} onConfirm={confirmDelete} onCancel={cancelDelete} />

      <div style={{ minHeight: "100vh", background: "#09090b", fontFamily: "'Inter', sans-serif", color: "#fff" }}>


        <header style={{
          position: "sticky", top: 0, zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 28px",
          height: 58,
          background: scrolled ? "rgba(9,9,11,0.95)" : "rgba(9,9,11,0.80)",
          backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
          borderBottom: scrolled ? "1px solid rgba(255,255,255,0.09)" : "1px solid rgba(255,255,255,0.05)",
          boxShadow: scrolled ? "0 4px 32px rgba(0,0,0,0.4)" : "none",
          transition: "background 0.3s, border-color 0.3s, box-shadow 0.3s",
          animation: "gHeaderIn 0.45s cubic-bezier(0.16,1,0.3,1) both",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, animation: "gFloat 6s ease-in-out infinite" }}>
            <Image src={`${CDN}/icons/logo-white.png`} alt="Wisp" width={22} height={22} style={{ objectFit: "contain" }} />
            <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em", color: "#fff" }}>Wisp</span>
          </div>


          <div ref={profileMenuRef} style={{ position: "relative" }}>
            <button type="button" className="g-nav-btn" onClick={() => setProfileMenuOpen(v => !v)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px 5px 5px", borderRadius: 10, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", transition: "background 0.15s" }}>
              <UserAvatar profile={profile} size={28} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.72)" }}>{firstName}</span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.38, transition: "transform .2s", transform: profileMenuOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {profileMenuOpen && (
              <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 210, ...glassModal, borderRadius: 14, padding: 5, animation: "gMenuIn 0.22s cubic-bezier(0.16,1,0.3,1)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.07)", marginBottom: 4 }}>
                  <UserAvatar profile={profile} size={32} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{safeDisplayName(profile)}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>{safeUsername(profile)}</div>
                  </div>
                </div>
                <button type="button" className="g-menu-item" onClick={() => { setSettingsOpen(true); setProfileMenuOpen(false) }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", borderRadius: 8, border: "none", background: "transparent", color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "background 0.15s, color 0.15s" }}>
                  <i className="bi bi-gear" style={{ fontSize: 14 }} />Settings
                </button>
                {isAdmin && (
                  <button type="button" className="g-menu-item" onClick={() => { setAdminOpen(true); setProfileMenuOpen(false) }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", borderRadius: 8, border: "none", background: "transparent", color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "background 0.15s, color 0.15s" }}>
                    <i className="bi bi-shield-check" style={{ fontSize: 14 }} />Admin Panel
                  </button>
                )}
                <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "4px 0" }} />
                <button type="button" className="g-menu-item g-signout" onClick={signOut} style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", borderRadius: 8, border: "none", background: "transparent", color: "rgba(255,255,255,0.38)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "background 0.15s, color 0.15s" }}>
                  <i className="bi bi-box-arrow-right" style={{ fontSize: 14 }} />Sign out
                </button>
              </div>
            )}
          </div>
        </header>


        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "44px 28px 80px", animation: "gHeroIn 0.55s 0.08s cubic-bezier(0.16,1,0.3,1) both" }}>


          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <UserAvatar profile={profile} size={50} />
              <div>
                <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.035em", marginBottom: 4, color: "#fff", lineHeight: 1.2, animation: "gCountUp .5s .1s cubic-bezier(.16,1,.3,1) both" }}>Hey, {firstName} 👋</h1>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", margin: 0, lineHeight: 1.4, animation: "gCountUp .5s .18s cubic-bezier(.16,1,.3,1) both" }}>
                  {projects.length === 0 ? "No projects yet — create one to get started." : `${projects.length} project${projects.length !== 1 ? "s" : ""}`}
                </p>
              </div>
            </div>
            <button type="button" className="g-new-btn" onClick={() => setNewProjectOpen(true)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.22s cubic-bezier(.34,1.26,.64,1)", animation: "gCountUp .5s .25s cubic-bezier(.16,1,.3,1) both" }}>
              <i className="bi bi-plus-lg" style={{ fontSize: 13 }} />New project
            </button>
          </div>

          <div style={{ height: 1, background: "rgba(255,255,255,0.07)", marginBottom: 22 }} />


          {projects.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22, flexWrap: "wrap", animation: "gSlideDown .4s .1s cubic-bezier(.16,1,.3,1) both" }}>
              <div style={{ flex: 1, minWidth: 180, position: "relative" }}>
                <i className="bi bi-search" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "rgba(255,255,255,0.26)", pointerEvents: "none" }} />
                <input className="g-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects…"
                  style={{ width: "100%", height: 38, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, paddingLeft: 36, paddingRight: search ? 34 : 14, fontSize: 13, color: "#fff", fontFamily: "inherit", outline: "none", transition: "border-color 0.2s, box-shadow 0.2s" }} />
                {search && (
                  <button type="button" className="g-close-search" onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "rgba(255,255,255,0.28)", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", transition: "color 0.15s" }}>
                    <i className="bi bi-x-circle-fill" />
                  </button>
                )}
              </div>
              <div ref={sortMenuRef} style={{ position: "relative" }}>
                <button type="button" className="g-sort-btn" onClick={() => setSortMenuOpen(v => !v)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 12px", height: 38, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", transition: "background 0.15s", whiteSpace: "nowrap" }}>
                  <i className="bi bi-arrow-down-up" style={{ fontSize: 13 }} />
                  {sortLabels[sort]}
                  <i className={"bi " + (sortMenuOpen ? "bi-chevron-up" : "bi-chevron-down")} style={{ fontSize: 11, opacity: 0.5, transition: "transform .2s" }} />
                </button>
                {sortMenuOpen && (
                  <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, width: 180, ...glassModal, borderRadius: 12, padding: 5, animation: "gMenuIn 0.18s cubic-bezier(0.16,1,0.3,1)", zIndex: 100 }}>
                    {(["updated", "created", "name"] as SortKey[]).map(k => (
                      <button key={k} type="button" className="g-sort-item" onClick={() => { setSort(k); setSortMenuOpen(false) }} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 11px", borderRadius: 8, border: "none", background: "transparent", color: sort === k ? "#fff" : "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: sort === k ? 600 : 400, cursor: "pointer", fontFamily: "inherit", transition: "background 0.15s" }}>
                        {sortLabels[k]}
                        {sort === k && <i className="bi bi-check-lg" style={{ fontSize: 13, animation: "gBounceIn .25s cubic-bezier(.34,1.56,.64,1)" }} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}


          {projects.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 20px", textAlign: "center", animation: "gHeroIn .5s .15s cubic-bezier(.16,1,.3,1) both" }}>
              <div style={{ width: 64, height: 64, borderRadius: 18, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18, animation: "gFloat 5s ease-in-out infinite" }}>
                <i className="bi bi-controller" style={{ fontSize: 28, color: "rgba(255,255,255,0.12)" }} />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 8, color: "#fff" }}>No projects yet</h2>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", marginBottom: 24, lineHeight: 1.6, maxWidth: 280 }}>Get started by making your first project.</p>
              <button type="button" onClick={() => setNewProjectOpen(true)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 22px", background: "#fff", color: "#09090b", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all .2s cubic-bezier(.34,1.26,.64,1)" }}>
                <i className="bi bi-plus-lg" style={{ fontSize: 13 }} />Create project
              </button>
            </div>
          ) : displayed.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 20px", textAlign: "center", animation: "gFadeIn .3s ease" }}>
              <i className="bi bi-search" style={{ fontSize: 28, color: "rgba(255,255,255,0.12)", marginBottom: 14 }} />
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", margin: 0 }}>No projects match "{search}"</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(272px, 1fr))", gap: 14 }}>
              {displayed.map((project, idx) => (
                <div
                  key={project.id}
                  className="g-proj-card"
                  onClick={() => handleProjectClick(project.id)}
                  style={{
                    position: "relative",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 14,
                    overflow: "hidden",
                    cursor: "pointer",
                    animation: `gCardIn 0.5s cubic-bezier(0.16,1,0.3,1) ${idx * 0.06}s both`,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
                  }}
                >

                  <div style={{ position: "relative", width: "100%", paddingTop: "52%", overflow: "hidden" }}>
                    <ProjectThumbnail placeId={project.place_id ?? null} />

                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 56, background: "linear-gradient(to top, rgba(9,9,11,0.95), transparent)", pointerEvents: "none" }} />
                    <button
                      type="button"
                      className="g-del-btn"
                      onClick={e => { e.stopPropagation(); promptDelete(project.id, project.name) }}
                      style={{
                        position: "absolute", top: 10, right: 10,
                        width: 28, height: 28, borderRadius: 8,
                        background: "rgba(0,0,0,0.55)",
                        backdropFilter: "blur(8px)",
                        border: "1px solid rgba(255,255,255,0.10)",
                        color: "rgba(255,255,255,0.55)",
                        cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11,

                      }}
                    >
                      <i className="bi bi-trash3" />
                    </button>
                  </div>


                  <div style={{ padding: "12px 14px 14px" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", letterSpacing: "-0.015em", marginBottom: 7, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {project.name}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <UserAvatar profile={profile} size={16} />
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                        {safeDisplayName(profile)}
                      </span>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.15)" }}>·</span>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                        <i className="bi bi-clock" style={{ fontSize: 10 }} />
                        {timeAgo(project.updated_at || project.created_at || "")}
                      </span>
                    </div>
                  </div>
                </div>
              ))}


              <button
                type="button"
                className="g-add-card"
                onClick={() => setNewProjectOpen(true)}
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px dashed rgba(255,255,255,0.08)",
                  borderRadius: 14,
                  cursor: "pointer",
                  minHeight: 210,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
                  color: "rgba(255,255,255,0.2)",
                  fontFamily: "inherit",
                  transition: "all 0.24s cubic-bezier(.34,1.26,.64,1)",
                  animation: `gCardIn 0.5s cubic-bezier(0.16,1,0.3,1) ${displayed.length * 0.06}s both`,
                }}
              >
                <i className="bi bi-plus-lg" style={{ fontSize: 22 }} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>New project</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}