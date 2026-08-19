import { NextRequest, NextResponse } from "next/server"
import { getAdminSupabase } from "@/lib/supabase"
import { runOrchestrator } from "@/lib/orchestrator"
import { getProjectMemory } from "@/lib/project-memory"

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

  const userId = tokenRow.user_id

  let body: { prompt?: string; projectId?: string; gameModel?: string; mode?: "default" | "advanced" } = {}
  try { body = await req.json() } catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }) }

  if (!body.prompt?.trim()) return NextResponse.json({ error: "missing_prompt" }, { status: 400 })

  let projectMemory: string | undefined
  if (body.projectId) {
    try {
      const memory = await getProjectMemory(db, body.projectId)
      const parts: string[] = []
      if (memory.rules.length) parts.push("Rules:\n" + memory.rules.map(r => `- ${r}`).join("\n"))
      if (memory.decisions.length) parts.push("Decisions:\n" + memory.decisions.map(d => `- ${d.question}: ${d.answer}`).join("\n"))
      if (memory.architecture.length) parts.push("Architecture:\n" + memory.architecture.map(a => `- ${a.component}: ${a.description}`).join("\n"))
      if (parts.length) projectMemory = parts.join("\n\n")
    } catch {}
  }

  try {
    const result = await runOrchestrator({
      prompt: body.prompt.trim(),
      projectMemory,
      gameModel: body.gameModel,
      mode: body.mode,
    })

    const runId = crypto.randomUUID()
    await db.from("task_runs").insert({
      id: runId,
      user_id: userId,
      project_id: body.projectId || null,
      prompt: body.prompt.trim(),
      result: JSON.stringify(result),
      created_at: new Date().toISOString(),
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error("[orchestrate] error:", err)
    return NextResponse.json(
      { error: "orchestration_failed", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
