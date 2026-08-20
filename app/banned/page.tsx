export const dynamic = "force-dynamic";

export default async function BannedPage({
  searchParams,
}: {
  searchParams?: Promise<{ reason?: string }>;
}) {

  const params = await searchParams;


  const rawReason = params?.reason;


  const cleanedReason = rawReason
    ? decodeURIComponent(rawReason)
        .replace(/[-_]/g, " ")
        .trim()
    : null;


  const formattedReason = cleanedReason
    ? cleanedReason
        .split(" ")
        .map(
          (w) => w.charAt(0).toUpperCase() + w.slice(1)
        )
        .join(" ")
    : null;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
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
        Access Revoked
      </h1>

      <p
        style={{
          fontSize: "clamp(14px, 3vw, 16px)",
          fontWeight: 600,
          color: "rgba(240,240,240,0.4)",
          margin: 0,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        Sorry, but you're banned from Wisp services.
      </p>

      {formattedReason && (
        <p
          style={{
            fontSize: "clamp(14px, 3vw, 16px)",
            fontWeight: 600,
            color: "rgba(240,240,240,0.4)",
            marginTop: 4,
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Reason:{" "}
          <span style={{ color: "#f0f0f0" }}>
            {formattedReason}
          </span>
        </p>
      )}
    </div>
  );
}
