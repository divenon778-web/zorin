import { NextRequest, NextResponse } from "next/server"
import { getAdminSupabase } from "@/lib/supabase"
import { getProjectMemory, updateProjectMemory } from "@/lib/project-memory"

async function authenticate(req: NextRequest) {
  const db = getAdminSupabase()
  const auth = req.headers.get("authorization") || ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : ""
  if (!token) return { db, userId: null, error: NextResponse.json({ error: "missing_token" }, { status: 401 }) }

  const { data: tokenRow } = await db
    .from("plugin_tokens")
    .select("user_id, authorized, expires_at")
    .eq("token", token)
    .eq("authorized", true)
    .single()

  if (!tokenRow) return { db, userId: null, error: NextResponse.json({ error: "invalid_token" }, { status: 401 }) }
  if (new Date(tokenRow.expires_at) < new Date()) return { db, userId: null, error: NextResponse.json({ error: "token_expired" }, { status: 401 }) }

  return { db, userId: tokenRow.user_id, error: null }
}

export async function GET(req: NextRequest) {
  const { db, error } = await authenticate(req)
  if (error) return error

  const projectId = req.nextUrl.searchParams.get("projectId")
  if (!projectId) return NextResponse.json({ error: "missing_projectId" }, { status: 400 })

  try {
    const memory = await getProjectMemory(db, projectId)
    return NextResponse.json(memory)
  } catch (err) {
    return NextResponse.json(
      { error: "db_error", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  const { db, error } = await authenticate(req)
  if (error) return error

  let body: { projectId?: string; action?: string; data?: any } = {}
  try { body = await req.json() } catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }) }

  if (!body.projectId) return NextResponse.json({ error: "missing_projectId" }, { status: 400 })
  if (!body.action) return NextResponse.json({ error: "missing_action" }, { status: 400 })

  const validActions = ["add_rule", "add_decision", "update_architecture", "add_dependency"]
  if (!validActions.includes(body.action)) {
    return NextResponse.json({ error: "invalid_action", valid: validActions }, { status: 400 })
  }

  try {
    const memory = await updateProjectMemory(db, body.projectId, body.action, body.data)
    return NextResponse.json({ ok: true, memory })
  } catch (err) {
    return NextResponse.json(
      { error: "update_failed", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
