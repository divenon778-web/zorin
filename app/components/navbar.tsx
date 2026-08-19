"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

interface NavbarProps {
  activePage?: "home" | "dashboard" | "terms" | "privacy";
  rightSlot?: ReactNode;
}

const CDN = "";

export function Navbar({ activePage, rightSlot }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const closeOnDesktop = () => {
      if (window.innerWidth >= 768) setMenuOpen(false);
    };
    closeOnDesktop();
    window.addEventListener("resize", closeOnDesktop);
    return () => window.removeEventListener("resize", closeOnDesktop);
  }, []);

  const defaultActions = (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px" }} />
  );

  const actions = rightSlot ?? defaultActions;

  const navLinkStyle = (active: boolean): React.CSSProperties => ({
    fontSize: 13,
    fontWeight: active ? 600 : 500,
    color: active ? "#fff" : "rgba(255,255,255,0.45)",
    textDecoration: "none",
    padding: "5px 10px",
    borderRadius: 8,
    background: "transparent",
    transition: "color 0.15s, background 0.15s",
    fontFamily: "inherit",
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes gFloat    { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
        @keyframes gHeaderIn { from { opacity: 0; transform: translateY(-12px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes gFadeIn   { from { opacity: 0 } to { opacity: 1 } }
        @keyframes gMenuIn   { from { opacity: 0; transform: translateY(6px) scale(0.97) } to { opacity: 1; transform: translateY(0) scale(1) } }

        .g-nav-link:hover {
          color: rgba(255,255,255,0.85) !important;
          background: rgba(255,255,255,0.06) !important;
        }

        .g-hamburger-btn {
          display: none;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 4.5px;
          width: 34px;
          height: 34px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 9px;
          cursor: pointer;
          padding: 0;
          transition: background 0.15s;
        }
        .g-hamburger-btn:hover { background: rgba(255,255,255,0.09) !important; }
        .g-hamburger-btn span {
          display: block;
          width: 15px;
          height: 1.5px;
          background: rgba(255,255,255,0.65);
          border-radius: 2px;
          transition: transform 0.22s ease, opacity 0.22s ease;
          transform-origin: center;
        }
        .g-hamburger-btn.open span:nth-child(1) { transform: translateY(6px) rotate(45deg); }
        .g-hamburger-btn.open span:nth-child(2) { opacity: 0; transform: scaleX(0); }
        .g-hamburger-btn.open span:nth-child(3) { transform: translateY(-6px) rotate(-45deg); }

        .g-mobile-panel {
          display: none;
          position: absolute;
          top: calc(100% + 8px);
          left: 14px;
          right: 14px;
          background: rgba(14,14,16,0.97);
          backdrop-filter: blur(40px) saturate(1.8);
          -webkit-backdrop-filter: blur(40px) saturate(1.8);
          border: 1px solid rgba(255,255,255,0.11);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), 0 16px 48px rgba(0,0,0,0.55);
          border-radius: 16px;
          padding: 12px;
          flex-direction: column;
          gap: 4px;
          animation: gMenuIn 0.22s cubic-bezier(0.16,1,0.3,1);
          z-index: 49;
        }
        .g-mobile-panel.open { display: flex; }

        .g-mobile-divider {
          height: 1px;
          background: rgba(255,255,255,0.07);
          margin: 6px 0;
        }

        @media (max-width: 767px) {
          .g-desktop-nav   { display: none !important; }
          .g-desktop-actions { display: none !important; }
          .g-hamburger-btn { display: flex !important; }
        }
      `}</style>

      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px",
          height: 58,
          background: scrolled ? "rgba(9,9,11,0.95)" : "rgba(9,9,11,0.80)",
          backdropFilter: "blur(28px)",
          WebkitBackdropFilter: "blur(28px)",
          borderBottom: scrolled
            ? "1px solid rgba(255,255,255,0.09)"
            : "1px solid rgba(255,255,255,0.05)",
          boxShadow: scrolled ? "0 4px 32px rgba(0,0,0,0.4)" : "none",
          transition: "background 0.3s, border-color 0.3s, box-shadow 0.3s",
          animation: "gHeaderIn 0.45s cubic-bezier(0.16,1,0.3,1) both",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            textDecoration: "none",
            animation: "gFloat 6s ease-in-out infinite",
          }}
        >
          <Image
            src={`${CDN}/icons/logo-white.png`}
            alt="Zeugo AI"
            width={22}
            height={22}
            style={{ objectFit: "contain" }}
          />
          <span
            style={{
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "#fff",
            }}
          >
            Zeugo AI
          </span>
        </Link>
        <nav
          className="g-desktop-nav"
          aria-label="Primary navigation"
          style={{ display: "flex", alignItems: "center", gap: 2 }}
        >
          <Link
            href="/"
            className="g-nav-link"
            style={navLinkStyle(activePage === "home")}
          >
            Home
          </Link>
          <a
            href="https://zeugoai.vercel.app"
            className="g-nav-link"
            style={navLinkStyle(activePage === "dashboard")}
          >
            Dashboard
          </a>
        </nav>
        <div className="g-desktop-actions" style={{ display: "flex" }}>
          {actions}
        </div>
        <button
          type="button"
          className={`g-hamburger-btn${menuOpen ? " open" : ""}`}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
        <div className={`g-mobile-panel${menuOpen ? " open" : ""}`} role="navigation" aria-label="Mobile navigation">
          <Link
            href="/"
            className="g-nav-link"
            style={{ ...navLinkStyle(activePage === "home"), padding: "10px 12px", borderRadius: 10 }}
            onClick={() => setMenuOpen(false)}
          >
            Home
          </Link>
          <a
            href="https://zeugoai.vercel.app"
            className="g-nav-link"
            style={{ ...navLinkStyle(activePage === "dashboard"), padding: "10px 12px", borderRadius: 10 }}
            onClick={() => setMenuOpen(false)}
          >
            Dashboard
          </a>
          <div className="g-mobile-divider" />
          <div style={{ padding: "2px 0 4px" }}>{actions}</div>
        </div>
      </header>
    </>
  );
}