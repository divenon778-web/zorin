import { NextRequest, NextResponse } from "next/server"
import { getAdminSupabase } from "@/lib/supabase"
import { rollbackToCheckpoint } from "@/lib/checkpoint"

export async function POST(req: NextRequest) {
  const db = getAdminSupabase()
  const auth = req.headers.get("authorization") || ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : ""
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 401 })

  const { data: tokenRow } = await db
    .from("plugin_tokens")
    .select("user_id, authorized, expires_at")
    .eq("token", token)
    .eq("authorized", true)
    .single()

  if (!tokenRow) return NextResponse.json({ error: "invalid_token" }, { status: 401 })
  if (new Date(tokenRow.expires_at) < new Date()) return NextResponse.json({ error: "token_expired" }, { status: 401 })

  let body: { action?: string; targetId?: string } = {}
  try { body = await req.json() } catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }) }

  if (!body.action || !body.targetId) {
    return NextResponse.json({ error: "missing_fields", details: "action and targetId are required" }, { status: 400 })
  }

  if (body.action !== "task" && body.action !== "run") {
    return NextResponse.json({ error: "invalid_action", details: "action must be 'task' or 'run'" }, { status: 400 })
  }

  try {
    let query = db.from("checkpoints").select("id").order("created_at", { ascending: false })

    if (body.action === "task") {
      query = query.eq("task_id", body.targetId)
    } else {
      query = query.eq("run_id", body.targetId)
    }

    const { data: checkpoints, error: fetchErr } = await query
    if (fetchErr) throw new Error(`Failed to fetch checkpoints: ${fetchErr.message}`)

    if (!checkpoints || checkpoints.length === 0) {
      return NextResponse.json({ error: "no_checkpoints", details: "No checkpoints found for this target" }, { status: 404 })
    }

    let totalUndone = 0
    let lastChanges: any[] = []

    for (const cp of checkpoints) {
      const { checkpoint, undone } = await rollbackToCheckpoint(db, cp.id)
      totalUndone += undone
      lastChanges = checkpoint.changes
    }

    return NextResponse.json({ ok: true, undone: totalUndone, changes: lastChanges })
  } catch (err) {
    return NextResponse.json(
      { error: "undo_failed", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
