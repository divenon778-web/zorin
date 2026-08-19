import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase";
import { createServerSupabase } from "@/lib/supabase-server";
import crypto from "node:crypto";
import { PLUGIN_ACCESS_TOKEN_TTL_MS, expiresIn } from "@/lib/plugin-token-expiry";

export async function POST(req: NextRequest) {
  try {
    console.log("[plugin/authorize] start");

    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    console.log("[plugin/authorize] supabase user:", user);

    if (!user) {
      return NextResponse.json(
        { error: "not_authenticated", details: "No Supabase user" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const code = body?.code;

    if (!code) {
      return NextResponse.json({ error: "missing_code" }, { status: 400 });
    }

    const db = getAdminSupabase();

    const { data: row } = await db
      .from("plugin_tokens")
      .select("id, expires_at")
      .eq("device_code", code)
      .single();

    console.log("[plugin/authorize] row:", row);

    if (!row) {
      return NextResponse.json({ error: "expired" }, { status: 410 });
    }

    if (new Date(row.expires_at) < new Date()) {
      return NextResponse.json({ error: "expired" }, { status: 410 });
    }

    const realToken = "gxp-" + crypto.randomBytes(28).toString("hex");

    const { error: updateError } = await db
      .from("plugin_tokens")
      .update({
        user_id: user.id,
        token: realToken,
        authorized: true,
        expires_at: expiresIn(PLUGIN_ACCESS_TOKEN_TTL_MS),
      })
      .eq("id", row.id);

    if (updateError) {
      console.error("[plugin/authorize] update failed:", updateError);
      return NextResponse.json({ error: "failed" }, { status: 500 });
    }

    console.log("[plugin/authorize] SUCCESS");

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[plugin/authorize] crash:", err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}