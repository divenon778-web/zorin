"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { CSSProperties } from "react";

interface User {
  username: string;
  userId: string;
  avatarUrl?: string | null;
  robloxUserId?: number | null;
}

function RobloxAvatar({ userId, size = 36 }: { userId: number; size?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const initial = String(userId).charAt(0).toUpperCase();

  useEffect(() => {
    fetch(`/api/roblox-avatar?userId=${userId}`)
      .then((r) => r.json())
      .then((d) => { if (d.url) setUrl(d.url); })
      .catch(() => {});
  }, [userId]);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        flexShrink: 0,
        border: "1.5px solid rgba(255,255,255,0.11)",
      }}
    >
      {url ? (
        <img
          src={url}
          width={size}
          height={size}
          alt=""
          style={{ objectFit: "cover", width: "100%", height: "100%", display: "block" }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "rgba(255,255,255,0.07)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: Math.round(size * 0.4),
            fontWeight: 700,
            color: "#e0e0e0",
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: "0.5px",
          }}
        >
          {initial}
        </div>
      )}
    </div>
  );
}

function AccountAvatar({ user, size = 36 }: { user: User; size?: number }) {
  if (user.robloxUserId) {
    return <RobloxAvatar userId={user.robloxUserId} size={size} />;
  }

  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        width={size}
        height={size}
        alt=""
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
          border: "1.5px solid rgba(255,255,255,0.11)",
          display: "block",
        }}
      />
    );
  }

  return (
    <div style={S.accountAvatar}>
      {user.username.slice(0, 2).toUpperCase()}
    </div>
  );
}

export function LinkPluginClient({
  code,
  user,
}: {
  code: string | null;
  user: User | null;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");
  const [enteredCode, setEnteredCode] = useState("");
  const [copied, setCopied] = useState(false);
  const startedRef = useRef(false);

  const effectiveCode = (code ?? enteredCode).trim();

  const copyCode = async () => {
    if (!effectiveCode) return;
    try {
      await navigator.clipboard.writeText(effectiveCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const authorize = async () => {
    if (!effectiveCode || !user || status === "loading") return;
    setStatus("loading");
    setErrMsg("");
    try {
      const res = await fetch("/api/plugin/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: effectiveCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        setErrMsg(
          data.error === "expired"
            ? "This code expired. Generate a new one in Studio."
            : data.details || "Something went wrong."
        );
        setStatus("error");
        return;
      }
      setStatus("done");
    } catch {
      setErrMsg("Network error. Please try again.");
      setStatus("error");
    }
  };

  useEffect(() => {
    if (!code || !user) return;
    if (startedRef.current) return;
    startedRef.current = true;
    authorize();
  }, [code, user]);

  if (!code) {
    return (
      <Shell>
        <Card>
          <StatusPill color="rgba(255,255,255,0.3)" label="Enter your code" />
          <h1 style={S.title}>Connect Studio</h1>
          <p style={S.sub}>
            Type or paste the 4-digit code shown in the Zorin plugin inside Roblox Studio.
          </p>

          <input
            value={enteredCode}
            onChange={(e) => setEnteredCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 8))}
            placeholder="e.g. 3083"
            autoFocus
            style={S.codeInput}
          />

          {status === "error" && (
            <div style={S.errBox}>
              <i className="bi bi-exclamation-circle" style={{ fontSize: 13, flexShrink: 0 }} />
              <span>{errMsg}</span>
            </div>
          )}

          {user ? (
            <button
              onClick={authorize}
              disabled={!effectiveCode || status === "loading"}
              style={{
                ...S.btnPrimary,
                border: "none",
                width: "100%",
                opacity: effectiveCode && status !== "loading" ? 1 : 0.45,
                cursor: effectiveCode && status !== "loading" ? "pointer" : "not-allowed",
              }}
            >
              {status === "loading" ? "Connecting..." : "Authorize"}
            </button>
          ) : (
            <a
              href={`http://localhost:3000/login?redirect=${encodeURIComponent(`/link-plugin?code=${effectiveCode || ""}`)}`}
              style={S.btnPrimary}
            >
              Sign in to continue
            </a>
          )}

          <p style={S.footnote}>
            Stuck? Go back to Studio, click Connect, and read the code in the plugin output.
          </p>
        </Card>
      </Shell>
    );
  }

  if (!user) {
    return (
      <Shell>
        <Card>
          <StatusPill color="rgba(255,255,255,0.4)" label="Sign in required" />
          <h1 style={S.title}>Sign in first</h1>
          <p style={S.sub}>You need a Zorin AI account before Studio can connect.</p>
          <a
            href={`http://localhost:3000/login?redirect=${encodeURIComponent(`/link-plugin?code=${code}`)}`}
            style={S.btnPrimary}
          >
            Sign in to continue
          </a>
        </Card>
      </Shell>
    );
  }

  if (status === "done") {
    return (
      <Shell>
        <Card video="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260818_072341_50851634-bbc3-4c33-9acc-7647d4db44aa.mp4">
          <StatusPill color="#4ade80" label="Connected" glow />
          <h1 style={S.title}>You're linked.</h1>
          <p style={S.sub}>
            Studio is connected to <strong style={{ color: "#f0f0f0", fontWeight: 600 }}>{user.username}</strong>. Close this tab and go back to Roblox Studio.
          </p>

          <div style={S.infoCard}>
            <div style={S.infoRow}>
              <span style={S.infoKey}>Account</span>
              <span style={S.infoVal}>{user.username}</span>
            </div>
            <div style={S.infoDivider} />
            <div style={S.infoRow}>
              <span style={S.infoKey}>Status</span>
              <span style={{ ...S.infoVal, color: "#4ade80" }}>Authorized</span>
            </div>
          </div>

          <a href="http://localhost:3000" style={S.btnGhost}>Open dashboard</a>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <Card>
        {status === "loading" ? (
          <StatusPill color="#facc15" label="Connecting" pulse />
        ) : status === "error" ? (
          <StatusPill color="#f87171" label="Failed" />
        ) : (
          <StatusPill color="rgba(255,255,255,0.3)" label="Awaiting authorization" />
        )}

        <h1 style={S.title}>
          {status === "loading" ? "Connecting..." : status === "error" ? "Link failed" : "Authorize Studio"}
        </h1>

        <p style={S.sub}>
          {status === "loading"
            ? "Linking Roblox Studio to your Zorin AI account."
            : status === "error"
            ? errMsg
            : "Zorin AI Studio is requesting access to your account."}
        </p>

        <div style={S.codeChip}>
          <span style={S.codeChipLabel}>Link code</span>
          <span style={S.codeChipValue}>{effectiveCode}</span>
          <button onClick={copyCode} style={S.codeCopyBtn}>
            <i className={`bi ${copied ? "bi-check-lg" : "bi-clipboard"}`} style={{ fontSize: 11 }} />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <div style={S.accountChip}>
          <AccountAvatar user={user} size={36} />
          <div>
            <div style={S.accountName}>{user.username}</div>
            <div style={S.accountSub}>Zorin AI account</div>
          </div>
          <div style={S.accountCheckmark}>
            <i className="bi bi-check" style={{ fontSize: 11 }} />
          </div>
        </div>

        {status === "error" && (
          <div style={S.errBox}>
            <i className="bi bi-exclamation-circle" style={{ fontSize: 13, flexShrink: 0 }} />
            <span>{errMsg}</span>
          </div>
        )}

        {status === "loading" ? (
          <div style={S.loaderTrack}>
            <div style={S.loaderFill} />
          </div>
        ) : (
          <button onClick={authorize} style={{ ...S.btnPrimary, border: "none", width: "100%" }}>
            {status === "error" ? "Try again" : "Authorize"}
          </button>
        )}

        <p style={S.footnote}>
          Stuck? Go back to Studio and generate a fresh code.
        </p>
      </Card>
    </Shell>
  );
}

function StatusPill({
  color,
  label,
  glow = false,
  pulse = false,
}: {
  color: string;
  label: string;
  glow?: boolean;
  pulse?: boolean;
}) {
  return (
    <div style={S.pill}>
      <span
        style={{
          ...S.pillDot,
          background: color,
          ...(glow ? { boxShadow: `0 0 8px ${color}` } : {}),
          ...(pulse ? { animation: "glcPulse 1.4s ease infinite" } : {}),
        }}
      />
      <span style={S.pillLabel}>{label}</span>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');
        @import url('https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css');

        @keyframes glcFadeUp {
          from { opacity: 0; transform: translateY(14px) scale(0.99); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes glcPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.65); }
        }
        @keyframes glcMarch {
          from { transform: translateX(-100%); }
          to   { transform: translateX(350%); }
        }

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .glc-shell {
          min-height: 100vh;
          background: #0a0a0a;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 20px 48px;
          font-family: 'Inter', sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        .glc-topbar {
          position: fixed;
          top: 0; left: 0; right: 0;
          height: 54px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 28px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(10,10,10,0.95);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          z-index: 100;
        }

        .glc-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
        }

        .glc-brand-name {
          font-size: 14px;
          font-weight: 700;
          color: #e0e0e0;
          letter-spacing: -0.3px;
        }

        .glc-topbar-badge {
          font-size: 11px;
          font-weight: 500;
          color: rgba(255,255,255,0.3);
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          padding: 3px 10px;
          border-radius: 6px;
          letter-spacing: 0.3px;
        }

        .glc-card {
          width: 100%;
          max-width: 420px;
          background: #111111;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          padding: 36px 32px 32px;
          position: relative;
          overflow: hidden;
          animation: glcFadeUp 0.45s cubic-bezier(0.16,1,0.3,1) both;
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.03) inset,
            0 32px 80px rgba(0,0,0,0.55);
        }

        .glc-card::before {
          content: '';
          position: absolute;
          top: 0; left: 10%; right: 10%;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
          border-radius: 0 0 4px 4px;
        }

        .glc-card-video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0.18;
          z-index: 0;
          pointer-events: none;
        }

        .glc-card-content {
          position: relative;
          z-index: 1;
        }

        @media (max-width: 480px) {
          .glc-card { padding: 28px 24px 28px; border-radius: 16px; }
          .glc-topbar { padding: 0 20px; }
        }
      `}</style>

      <div className="glc-shell">
        <header className="glc-topbar">
          <a href="http://localhost:3000" className="glc-brand">
            <Image src="/icons/logo-white.png" alt="Zorin AI" width={22} height={22} style={{ objectFit: "contain" }} />
            <span className="glc-brand-name">Zorin AI</span>
          </a>
          <span className="glc-topbar-badge">Studio Link</span>
        </header>

        {children}
      </div>
    </>
  );
}

function Card({ children, video }: { children: React.ReactNode; video?: string }) {
  return (
    <div className="glc-card">
      {video && (
        <video
          className="glc-card-video"
          src={video}
          autoPlay
          loop
          muted
          playsInline
        />
      )}
      <div className={video ? "glc-card-content" : undefined}>
        {children}
      </div>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  pill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    marginBottom: 20,
  },
  pillDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    flexShrink: 0,
  },
  pillLabel: {
    fontSize: 12,
    fontWeight: 500,
    color: "rgba(255,255,255,0.35)",
    letterSpacing: "0.1px",
  },
  title: {
    fontSize: 24,
    fontWeight: 800,
    letterSpacing: "-0.5px",
    color: "#efefef",
    lineHeight: 1.15,
    marginBottom: 10,
  },
  sub: {
    fontSize: 14,
    color: "rgba(255,255,255,0.42)",
    lineHeight: 1.65,
    marginBottom: 28,
  },
  accountChip: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    background: "#0a0a0a",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 12,
    marginBottom: 20,
  },
  codeChip: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 10,
    marginBottom: 14,
  },
  codeChipLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: "rgba(255,255,255,0.30)",
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
  },
  codeChipValue: {
    fontSize: 15,
    fontWeight: 700,
    fontFamily: "'JetBrains Mono', monospace",
    color: "#f0f0f0",
    letterSpacing: "0.12em",
    flex: 1,
  },
  codeCopyBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 8,
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'Inter', sans-serif",
    transition: "background 0.15s",
  },
  codeInput: {
    width: "100%",
    padding: "14px 16px",
    background: "#0a0a0a",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 12,
    color: "#f0f0f0",
    fontSize: 18,
    fontWeight: 700,
    fontFamily: "'JetBrains Mono', monospace",
    letterSpacing: "0.2em",
    textAlign: "center" as const,
    outline: "none",
    marginBottom: 16,
  },
  accountAvatar: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.10)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 700,
    color: "#e0e0e0",
    flexShrink: 0,
    fontFamily: "'JetBrains Mono', monospace",
    letterSpacing: "0.5px",
  },
  accountName: {
    fontSize: 14,
    fontWeight: 600,
    color: "#e0e0e0",
    lineHeight: 1.2,
  },
  accountSub: {
    fontSize: 11.5,
    color: "rgba(255,255,255,0.28)",
    marginTop: 2,
  },
  accountCheckmark: {
    marginLeft: "auto",
    width: 22,
    height: 22,
    borderRadius: "50%",
    background: "rgba(74,222,128,0.10)",
    border: "1px solid rgba(74,222,128,0.20)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#4ade80",
    flexShrink: 0,
  },
  infoCard: {
    background: "#0a0a0a",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 12,
    padding: "4px 0",
    marginBottom: 20,
  },
  infoRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "11px 16px",
    gap: 12,
  },
  infoDivider: {
    height: 1,
    background: "rgba(255,255,255,0.05)",
    margin: "0 16px",
  },
  infoKey: {
    fontSize: 13,
    color: "rgba(255,255,255,0.28)",
    fontWeight: 400,
  },
  infoVal: {
    fontSize: 13,
    fontWeight: 600,
    color: "rgba(255,255,255,0.75)",
  },
  errBox: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "11px 14px",
    background: "rgba(248,113,113,0.06)",
    border: "1px solid rgba(248,113,113,0.16)",
    borderRadius: 10,
    color: "#f87171",
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 1.5,
  },
  loaderTrack: {
    width: "100%",
    height: 2,
    background: "rgba(255,255,255,0.06)",
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 20,
  },
  loaderFill: {
    height: "100%",
    width: "30%",
    background: "rgba(255,255,255,0.35)",
    borderRadius: 999,
    animation: "glcMarch 1.6s ease-in-out infinite",
  },
  btnPrimary: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    padding: "13px 20px",
    background: "#efefef",
    color: "#0a0a0a",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: "-0.2px",
    textDecoration: "none",
    cursor: "pointer",
    fontFamily: "'Inter', sans-serif",
    transition: "opacity 0.15s",
  },
  btnGhost: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    padding: "12px 20px",
    background: "transparent",
    color: "rgba(255,255,255,0.35)",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 500,
    textDecoration: "none",
    cursor: "pointer",
    fontFamily: "'Inter', sans-serif",
    transition: "border-color 0.15s, color 0.15s",
  },
  footnote: {
    fontSize: 12,
    color: "rgba(255,255,255,0.2)",
    marginTop: 18,
    lineHeight: 1.55,
    textAlign: "center" as const,
  },
};