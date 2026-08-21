import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";

const INTER = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const CDN = "";

const YoutubeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

const DiscordIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.08.114 18.1.134 18.114a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

const TikTokIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z" />
  </svg>
);

export function Footer({ maxWidth = 1100 }: { maxWidth?: number }) {
  return (
    <footer style={S.footer}>
      <div style={{ ...S.inner, maxWidth }}>

        <div style={S.grid}>
          <div style={S.brandCol}>
            <div style={S.brandRow}>
              <Image
                src={`${CDN}/icons/logo-white.png`}
                alt="Wisp AI"
                width={28}
                height={28}
                style={{ objectFit: "contain" }}
              />
              <span style={S.brandName}>Wisp AI</span>
            </div>
            <p style={S.tagline}>
              AI-powered Luau code generation for Roblox developers. Build faster. Ship better.
            </p>
            <a href="mailto:elias@end.lat" style={S.contactLink}>elias@end.lat</a>

            {/* Social links */}
            <div style={S.socials}>
              <a
                href="https://www.youtube.com/@robloxaidev"
                target="_blank"
                rel="noreferrer"
                style={S.socialLink}
                aria-label="YouTube"
              >
                <YoutubeIcon />
              </a>
              <a
href="https://wisp-pvv1.onrender.com"
                target="_blank"
                rel="noreferrer"
                style={S.socialLink}
                aria-label="Discord"
              >
                <DiscordIcon />
              </a>
              <a
                href="https://www.tiktok.com/@wispstudios"
                target="_blank"
                rel="noreferrer"
                style={S.socialLink}
                aria-label="TikTok"
              >
                <TikTokIcon />
              </a>
            </div>
          </div>

          <div style={S.col}>
            <span style={S.colHead}>Product</span>
            <a href="https://wisp-pvv1.onrender.com" style={S.link}>Dashboard</a>
            <Link href="/" style={S.link}>Home</Link>
          </div>

          <div style={S.col}>
            <span style={S.colHead}>Legal</span>
            <Link href="/legal/terms" style={S.link}>Terms of Service</Link>
            <Link href="/legal/privacy" style={S.link}>Privacy Policy</Link>
          </div>

          <div style={S.col}>
            <span style={S.colHead}>Contact</span>
            <a href="mailto:elias@end.lat" style={S.link}>elias@end.lat</a>
          </div>
        </div>

        <div style={S.divider} />

        <div style={S.bottom}>
          <span style={S.copy}>
            Â© {new Date().getFullYear()}{" "}
            <a href="https://troojin.online" target="_blank" rel="noreferrer" style={S.troojinLink}>
              Troojin
            </a>
            . All rights reserved.
          </span>
          <span style={S.copy}>Made for Roblox developers.</span>
        </div>

      </div>
    </footer>
  );
}

const S: Record<string, CSSProperties> = {
  footer: {
    background: "#050507",
    borderTop: "1px solid rgba(255,255,255,0.06)",
    padding: "72px clamp(18px, 4vw, 48px) 40px",
    fontFamily: INTER,
  },
  inner: {
    margin: "0 auto",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr 1fr",
    gap: "0 48px",
    marginBottom: 56,
    alignItems: "start",
  },
  brandCol: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    paddingRight: 32,
  },
  brandRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  brandName: {
    fontSize: 15,
    fontWeight: 700,
    color: "#fff",
    letterSpacing: "-0.3px",
    fontFamily: INTER,
  },
  tagline: {
    fontSize: 13,
    color: "rgba(255,255,255,0.32)",
    lineHeight: 1.75,
    margin: 0,
    fontFamily: INTER,
  },
  contactLink: {
    fontSize: 12.5,
    color: "rgba(255,255,255,0.4)",
    textDecoration: "none",
    fontFamily: INTER,
  },
  socials: {
    display: "flex",
    gap: 8,
    marginTop: 4,
  },
  socialLink: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    borderRadius: 8,
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.4)",
    textDecoration: "none",
    transition: "background 0.15s, color 0.15s",
  },
  col: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  colHead: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "1.4px",
    textTransform: "uppercase" as const,
    color: "rgba(255,255,255,0.18)",
    marginBottom: 6,
    fontFamily: INTER,
  },
  link: {
    fontSize: 13.5,
    color: "rgba(255,255,255,0.42)",
    textDecoration: "none",
    fontFamily: INTER,
  },
  divider: {
    borderTop: "1px solid rgba(255,255,255,0.05)",
    marginBottom: 28,
  },
  bottom: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  copy: {
    fontSize: 12,
    color: "rgba(255,255,255,0.18)",
    fontFamily: INTER,
  },
  troojinLink: {
    color: "rgba(255,255,255,0.35)",
    textDecoration: "none",
  },
};