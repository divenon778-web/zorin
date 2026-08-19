import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "../../components/navbar";
import { Footer } from "../../components/footer";

export const metadata: Metadata = { title: "Privacy Policy | Zeugo AI" };

const LAST_UPDATED = "March 17, 2025";

export default function PrivacyPage() {
  return (
    <div style={{ position: "relative", zIndex: 1, minHeight: "100vh" }}>
      <Navbar
        activePage="privacy"
        rightSlot={
          <div className="topbar-actions" style={{ display: "flex", gap: 8 }}>
            <Link href="/legal/terms" className="btn btn-ghost btn-sm">Terms of Service</Link>
            <a href="https://zorinai.vercel.app" className="btn btn-primary btn-sm">Get Started</a>
          </div>
        }
      />

      <main style={S.main}>
        <div style={S.pageHeader}>
          <div style={S.badge}>Legal</div>
          <h1 style={S.h1}>Privacy Policy</h1>
          <p style={S.lastUpdated}>Last updated: {LAST_UPDATED}</p>
          <p style={S.intro}>This Privacy Policy explains how Zeugo Studios collects, uses, and protects your information when you use Zeugo AI. We are committed to protecting your privacy and being transparent about our data practices.</p>
        </div>

        <div style={S.content}>
          <Section title="1. Information We Collect">
            <P>When you use Zeugo AI, we collect the following information:</P>
            <List items={[
              "Roblox username and display name (via OAuth2 authentication)",
              "Roblox user ID (to identify your session)",
              "Roblox avatar URL (to display your profile picture in the dashboard)",
              "Prompts you submit to the AI generator",
              "Basic usage data such as generation requests and timestamps",
            ]} />
            <P>We do NOT collect your Roblox password, Robux balance, inventory, private messages, or any sensitive account data.</P>
          </Section>
          <Section title="2. How We Use Your Information">
            <P>We use the information we collect to:</P>
            <List items={[
              "Authenticate your identity via Roblox OAuth2",
              "Display your username and avatar in the dashboard",
              "Process and respond to your AI generation requests",
              "Improve the quality and accuracy of our AI models",
              "Monitor for abuse and enforce our Terms of Service",
            ]} />
            <P>We do not sell, rent, or trade your personal information to third parties for their marketing purposes.</P>
          </Section>
          <Section title="3. Authentication & Sessions">
            <P>We use Roblox OAuth2 to authenticate users. When you sign in, Roblox provides us with an access token stored in a secure, httpOnly cookie on your browser. This cookie expires when your session ends or when the Roblox token expires.</P>
            <P>We do not store your Roblox access token on our servers beyond the duration of your session.</P>
          </Section>
          <Section title="4. Cookies">
            <P>We use the following cookies:</P>
            <List items={[
              "zeugo_session â€” stores your encrypted session data, httpOnly, expires with your Roblox token",
              "roblox_oauth_state â€” a temporary CSRF protection token used during the OAuth flow, deleted after login",
            ]} />
            <P>We do not use advertising cookies, tracking pixels, or any third-party analytics cookies.</P>
          </Section>
          <Section title="5. Cloudflare">
            <P>We use Cloudflare for DDoS protection, performance optimization, and human verification (Turnstile). Cloudflare may collect certain technical data including IP addresses as part of its security services.</P>
            <P>Cloudflare Turnstile is used to verify that users are human before authenticating. The verification process is privacy-preserving and does not use tracking cookies.</P>
          </Section>
          <Section title="6. Data Storage & Security">
            <P>Session data is stored in encrypted cookies on your browser. We do not maintain a persistent database of user accounts or generated scripts. We implement HTTPS encryption, httpOnly cookies, and CSRF protection.</P>
          </Section>
          <Section title="7. Third-Party Services">
            <P>Zeugo AI integrates with:</P>
            <List items={[
              "Roblox â€” for OAuth2 authentication (governed by Roblox's Privacy Policy)",
              "Cloudflare â€” for security and performance (governed by Cloudflare's Privacy Policy)",
              "Vercel â€” for hosting and deployment (governed by Vercel's Privacy Policy)",
            ]} />
          </Section>
          <Section title="8. Your Rights">
            <P>You have the right to access, delete, or opt out of data collection by discontinuing use of the Service. You can withdraw your Roblox OAuth authorization at any time via your Roblox account settings.</P>
          </Section>
          <Section title="9. Contact Us">
            <P>If you have any questions about this Privacy Policy, please contact us through our Roblox group or Discord community. We aim to respond to all privacy-related inquiries within 48 hours.</P>
          </Section>
        </div>

        <div style={S.legalNav}>
          <Link href="/legal/terms" style={S.legalNavLink}>â† Terms of Service</Link>
        </div>
      </main>

      <Footer maxWidth={760} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section style={S.section}><h2 style={S.sectionTitle}>{title}</h2>{children}</section>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p style={S.p}>{children}</p>;
}
function List({ items }: { items: string[] }) {
  return (
    <ul style={S.list}>
      {items.map((item, i) => (
        <li key={i} style={S.listItem}><span style={S.listDot} />{item}</li>
      ))}
    </ul>
  );
}

const S: Record<string, React.CSSProperties> = {
  main:         { maxWidth: 760, margin: "0 auto", padding: "clamp(40px, 8vw, 56px) clamp(18px, 5vw, 24px) clamp(64px, 10vw, 80px)" },
  pageHeader:   { marginBottom: 52, paddingBottom: 40, borderBottom: "1px solid var(--border-subtle)" },
  badge:        { display: "inline-flex", alignItems: "center", padding: "4px 12px", background: "rgba(108,93,211,0.08)", border: "1px solid rgba(108,93,211,0.18)", borderRadius: 100, fontSize: 11, fontWeight: 600, color: "var(--purple-500)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 18 },
  h1:           { fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, letterSpacing: "-1.2px", color: "var(--text-primary)", marginBottom: 10 },
  lastUpdated:  { fontSize: 13, color: "var(--text-tertiary)", marginBottom: 18 },
  intro:        { fontSize: "clamp(14.5px, 2.8vw, 15px)", color: "var(--text-secondary)", lineHeight: 1.7, maxWidth: 580 },
  content:      { display: "flex", flexDirection: "column", gap: 0 },
  section:      { padding: "32px 0", borderBottom: "1px solid var(--border-subtle)" },
  sectionTitle: { fontSize: "clamp(16px, 3.2vw, 17px)", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.3px", marginBottom: 16 },
  p:            { fontSize: "clamp(14px, 2.6vw, 14.5px)", color: "var(--text-secondary)", lineHeight: 1.75, marginBottom: 12 },
  list:         { listStyle: "none", display: "flex", flexDirection: "column", gap: 10, margin: "12px 0" },
  listItem:     { display: "flex", alignItems: "flex-start", gap: 10, fontSize: "clamp(14px, 2.6vw, 14.5px)", color: "var(--text-secondary)", lineHeight: 1.6 },
  listDot:      { width: 5, height: 5, borderRadius: "50%", background: "var(--purple-500)", flexShrink: 0, marginTop: 8 },
  legalNav:     { marginTop: 48, paddingTop: 32, borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "flex-start" },
  legalNavLink: { fontSize: 13.5, color: "var(--purple-500)", fontWeight: 500, textDecoration: "none" },
};