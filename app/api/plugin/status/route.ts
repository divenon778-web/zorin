








import { NextResponse }         from "next/server"
import { createServerSupabase } from "@/lib/supabase-server"
import { getAdminSupabase }     from "@/lib/supabase"

const CONNECTED_WINDOW_MS = 75_000

export async function GET() {
  try {

    const supabase = await createServerSupabase()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ connected: false, reason: "unauthenticated" })
    }

    const db = getAdminSupabase()
    const { data, error } = await db
      .from("plugin_heartbeats")
      .select("last_seen")
      .eq("user_id", user.id)
      .maybeSingle()

    if (error) {
      console.error("[plugin/status] db error:", error.message)
      return NextResponse.json({ connected: false, reason: "db_error" })
    }

    if (!data?.last_seen) {
      return NextResponse.json({ connected: false, reason: "no_heartbeat" })
    }

    const elapsedMs = Date.now() - new Date(data.last_seen).getTime()

    return NextResponse.json({
      connected:  elapsedMs < CONNECTED_WINDOW_MS,
      last_seen:  data.last_seen,
      elapsed_ms: elapsedMs,
    })
  } catch (err) {
    console.error("[plugin/status] unexpected error:", err)
    return NextResponse.json({ connected: false, reason: "exception" })
  }
}