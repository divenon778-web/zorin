import { NextRequest, NextResponse } from "next/server"
import { getAdminSupabase } from "@/lib/supabase"

export async function GET(req: NextRequest) {
  const db = getAdminSupabase()
  const code = req.nextUrl.searchParams.get("code")

  if (!code) {
    return NextResponse.json({ error: "missing_code" }, { status: 400 })
  }

  const { data: rowData, error } = await db
    .from("plugin_tokens")
    .select("token, authorized, expires_at, user_id")
    .eq("device_code", code)
    .single()

  console.log("[poll] code:", code, "rowData:", rowData, "error:", error)

  if (error || !rowData) {
    return NextResponse.json({ status: "expired" }, { status: 410 })
  }

  const expiresAt = new Date(rowData.expires_at).getTime()
  if (isNaN(expiresAt) || expiresAt < Date.now()) {
    return NextResponse.json({ status: "expired" }, { status: 410 })
  }

  if (!rowData.authorized) {
    return NextResponse.json({ status: "pending" })
  }

  const { error: sessionError } = await db
    .from("plugin_sessions")
    .upsert(
      { token: rowData.token, user_id: rowData.user_id },
      { onConflict: "token" }
    )

  if (sessionError) {
    console.error("[poll] plugin_sessions upsert:", sessionError.message)
  }

  return NextResponse.json({ status: "authorized", token: rowData.token })
}