export default function ServerErrorPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: 24,
        textAlign: "center",
        background: "#080808",
        position: "fixed",
        inset: 0,
      }}
    >
      <h1
        style={{
          fontSize: "clamp(28px, 6vw, 38px)",
          fontWeight: 800,
          color: "#f0f0f0",
          letterSpacing: "-1px",
          margin: 0,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        It’s down again.
      </h1>

      <p
        style={{
          fontSize: "clamp(14px, 3vw, 16px)",
          fontWeight: 600,
          color: "rgba(240,240,240,0.4)",
          margin: 0,
          fontFamily: "'DM Sans', sans-serif",
          lineHeight: 1.4,
        }}
      >
        I’m honestly just tired at this point.  
        It’ll be back when I fix it again.  
        Check{" "}
        <a
          href="https://discord.gg/cgFcRB7ZNv"
          target="_blank"
          rel="noreferrer"
          style={{
            color: "rgba(240,240,240,0.5)",
            textDecoration: "underline",
          }}
        >
          Discord
        </a>
        {" "}for updates.
      </p>
    </div>
  );
}