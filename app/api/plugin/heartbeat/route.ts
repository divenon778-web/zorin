




import { NextResponse } from "next/server"
import { getAdminSupabase } from "@/lib/supabase"

export async function POST(req: Request) {
  const auth  = req.headers.get("authorization") ?? ""
  const token = auth.replace(/^Bearer\s+/i, "").trim()

  if (!token) {
    return NextResponse.json({ error: "no token" }, { status: 401 })
  }

  const db = getAdminSupabase()


  const { data: session, error: sessionErr } = await db
    .from("plugin_sessions")
    .select("user_id")
    .eq("token", token)
    .maybeSingle()

  if (sessionErr || !session) {
    return NextResponse.json({ error: "invalid token" }, { status: 401 })
  }


  const { error: upsertErr } = await db
    .from("plugin_heartbeats")
    .upsert(
      { user_id: session.user_id, last_seen: new Date().toISOString() },
      { onConflict: "user_id" }
    )

  if (upsertErr) {
    console.error("[heartbeat] upsert failed:", upsertErr.message)
    return NextResponse.json({ error: "db error" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}