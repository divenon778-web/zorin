import { SupabaseClient } from "@supabase/supabase-js"

export interface ChangeSet {
  type: "script" | "instance" | "deletion"
  name: string
  parent: string
  before: string | null
  after: string | null
  diff: string | null
}

export interface Checkpoint {
  id: string
  runId: string
  taskId: string
  projectId: string
  userId: string | null
  createdAt: string
  label: string
  changes: ChangeSet[]
  status: "active" | "rolled_back"
}

function generateId(): string {
  return `cp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function buildDiff(before: string | null, after: string | null): string | null {
  if (before === null && after !== null) return `[added]\n${after}`
  if (before !== null && after === null) return `[removed]\n${before}`
  if (before === after) return null

  const beforeLines = (before ?? "").split("\n")
  const afterLines = (after ?? "").split("\n")
  const diffs: string[] = []

  const maxLen = Math.max(beforeLines.length, afterLines.length)
  for (let i = 0; i < maxLen; i++) {
    const b = beforeLines[i]
    const a = afterLines[i]
    if (b === a) continue
    if (b === undefined) diffs.push(`+ ${a}`)
    else if (a === undefined) diffs.push(`- ${b}`)
    else {
      diffs.push(`- ${b}`)
      diffs.push(`+ ${a}`)
    }
  }

  return diffs.length > 0 ? diffs.join("\n") : null
}

export async function createCheckpoint(
  db: SupabaseClient,
  params: {
    runId: string
    taskId?: string
    projectId: string
    userId?: string
    label: string
    changes: ChangeSet[]
  }
): Promise<Checkpoint> {
  const id = generateId()

  const enrichedChanges = params.changes.map(c => ({
    ...c,
    diff: c.diff ?? buildDiff(c.before, c.after),
  }))

  const row = {
    id,
    run_id: params.runId,
    task_id: params.taskId ?? null,
    project_id: params.projectId,
    user_id: params.userId ?? null,
    label: params.label,
    changes: enrichedChanges,
    status: "active",
    created_at: new Date().toISOString(),
  }

  const { error } = await db.from("checkpoints").insert(row)
  if (error) {
    console.error("[createCheckpoint] insert error:", error)
    throw new Error(`Failed to create checkpoint: ${error.message}`)
  }

  return {
    id,
    runId: params.runId,
    taskId: params.taskId ?? "",
    projectId: params.projectId,
    userId: params.userId ?? null,
    createdAt: row.created_at,
    label: params.label,
    changes: enrichedChanges,
    status: "active",
  }
}

export async function getCheckpoint(
  db: SupabaseClient,
  checkpointId: string
): Promise<Checkpoint | null> {
  const { data, error } = await db
    .from("checkpoints")
    .select("*")
    .eq("id", checkpointId)
    .single()

  if (error || !data) return null

  return {
    id: data.id,
    runId: data.run_id,
    taskId: data.task_id ?? "",
    projectId: data.project_id,
    userId: data.user_id ?? null,
    createdAt: data.created_at,
    label: data.label,
    changes: data.changes ?? [],
    status: data.status,
  }
}

export async function listCheckpoints(
  db: SupabaseClient,
  params: { runId?: string; projectId?: string }
): Promise<Checkpoint[]> {
  let query = db.from("checkpoints").select("*").order("created_at", { ascending: true })

  if (params.runId) query = query.eq("run_id", params.runId)
  if (params.projectId) query = query.eq("project_id", params.projectId)

  const { data, error } = await query
  if (error || !data) return []

  return data.map((row: any) => ({
    id: row.id,
    runId: row.run_id,
    taskId: row.task_id ?? "",
    projectId: row.project_id,
    userId: row.user_id ?? null,
    createdAt: row.created_at,
    label: row.label,
    changes: row.changes ?? [],
    status: row.status,
  }))
}

export async function rollbackToCheckpoint(
  db: SupabaseClient,
  checkpointId: string
): Promise<{ checkpoint: Checkpoint; undone: number }> {
  const checkpoint = await getCheckpoint(db, checkpointId)
  if (!checkpoint) throw new Error("Checkpoint not found")
  if (checkpoint.status === "rolled_back") {
    return { checkpoint, undone: 0 }
  }

  let undone = 0

  for (const change of checkpoint.changes) {
    if (change.before !== null) undone++
  }

  const { error } = await db
    .from("checkpoints")
    .update({ status: "rolled_back" })
    .eq("id", checkpointId)

  if (error) {
    console.error("[rollbackToCheckpoint] update error:", error)
    throw new Error(`Failed to rollback: ${error.message}`)
  }

  checkpoint.status = "rolled_back"
  return { checkpoint, undone }
}

export async function deleteCheckpointsByRun(
  db: SupabaseClient,
  runId: string
): Promise<void> {
  await db.from("checkpoints").delete().eq("run_id", runId)
}

export async function deleteCheckpointsByProject(
  db: SupabaseClient,
  projectId: string
): Promise<void> {
  await db.from("checkpoints").delete().eq("project_id", projectId)
}
