import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase";
import { PLUGIN_DEVICE_CODE_TTL_MS, expiresIn } from "@/lib/plugin-token-expiry";
import { randomBytes } from "crypto";

function generateDeviceCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function generatePendingToken(): string {
  return "pending-" + randomBytes(16).toString("hex");
}

export async function POST() {
  try {
    console.log("[plugin/link] request received");

    const db = getAdminSupabase();
    console.log("[plugin/link] db client created:", !!db);

    const expiresAt = expiresIn(PLUGIN_DEVICE_CODE_TTL_MS);
    console.log("[plugin/link] expiresAt:", expiresAt, "| type:", typeof expiresAt);

    const pendingToken = generatePendingToken();
    console.log("[plugin/link] pendingToken generated:", pendingToken.slice(0, 16) + "...");

    // Prune expired rows (fire-and-forget)
    void Promise.resolve(
      db.from("plugin_tokens")
        .delete()
        .lt("expires_at", new Date().toISOString())
    )
      .then(() => console.log("[plugin/link] pruned expired rows"))
      .catch((e: unknown) => console.warn("[plugin/link] prune failed:", e));

    let deviceCode = "";
    let lastError: { message: string; code?: string } | null = null;
    const MAX_ATTEMPTS = 5;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      deviceCode = generateDeviceCode();
      console.log(`[plugin/link] attempt ${attempt + 1} — device_code: ${deviceCode}`);

      const { error } = await db.from("plugin_tokens").insert({
        token: pendingToken,
        device_code: deviceCode,
        authorized: false,
        expires_at: expiresAt,
      });

      if (!error) {
        console.log(`[plugin/link] insert succeeded on attempt ${attempt + 1}`);
        lastError = null;
        break;
      }

      console.warn(`[plugin/link] insert error on attempt ${attempt + 1}:`, {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });

      if (error.code !== "23505") {
        console.error("[plugin/link] non-retryable error, aborting");
        return NextResponse.json(
          { error: "failed", details: error.message, code: error.code ?? null },
          { status: 500 }
        );
      }

      lastError = error;
      console.warn(`[plugin/link] collision on device_code, retrying...`);
    }

    if (lastError) {
      console.error("[plugin/link] exhausted all retries:", lastError);
      return NextResponse.json(
        { error: "failed", details: "Could not generate unique code, try again." },
        { status: 500 }
      );
    }

    console.log("[plugin/link] success — code:", deviceCode);
    return NextResponse.json({
      code: deviceCode,
      authUrl: `https://zorinai.vercel.app/link-plugin?code=${deviceCode}`,
    });

  } catch (err) {
    console.error("[plugin/link] unexpected crash:", {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json(
      { error: "failed", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
