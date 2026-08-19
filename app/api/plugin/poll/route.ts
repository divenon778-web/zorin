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
    .select("token, authorized, expires_at, user_id, roblox_user_id")
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

  const data = rowData


  await Promise.all([
    db
      .from("plugin_sessions")
      .upsert(
        { token: data.token, user_id: data.user_id },
        { onConflict: "token" }
      )
      .then(({ error }) => {
        if (error) console.error("[poll] plugin_sessions upsert:", error.message)
      }),

    data.roblox_user_id
      ? db
          .from("profiles")
          .update({ roblox_user_id: data.roblox_user_id })
          .eq("id", data.user_id)
          .then(({ error }) => {
            if (error)
              console.error("[poll] roblox_user_id update:", error.message)
          })
      : Promise.resolve(),
  ])

  return NextResponse.json({ status: "authorized", token: data.token })
}