import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    if (!token) {
      return NextResponse.json({ error: "missing_token" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const robloxUserId = body?.robloxUserId;

    if (!robloxUserId) {
      return NextResponse.json({ error: "missing_roblox_user_id" }, { status: 400 });
    }

    const db = getAdminSupabase();


    const { data: session, error: sessionError } = await db
      .from("plugin_sessions")
      .select("user_id")
      .eq("token", token)
      .single();

    if (sessionError || !session) {
      console.error("[set-roblox-user] session not found:", sessionError);
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }


    const { error: updateError } = await db
      .from("profiles")
      .update({ roblox_user_id: String(robloxUserId) })
      .eq("id", session.user_id);

    if (updateError) {
      console.error("[set-roblox-user] update failed:", updateError);
      return NextResponse.json({ error: "failed" }, { status: 500 });
    }

    console.log("[set-roblox-user] saved roblox_user_id:", robloxUserId, "for user:", session.user_id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[set-roblox-user] crash:", err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}