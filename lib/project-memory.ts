import { SupabaseClient } from "@supabase/supabase-js"

export interface ProjectRule {
  id: string
  rule: string
  category: "architecture" | "security" | "performance" | "style" | "custom"
  pinned: boolean
  createdAt: string
}

export interface ProjectMemory {
  projectId: string
  architecture: {
    component: string
    description: string
  }[]
  rules: ProjectRule[]
  decisions: {
    question: string
    answer: string
    timestamp: string
  }[]
  dependencies: {
    from: string
    to: string
    type: string
  }[]
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function emptyMemory(projectId: string): ProjectMemory {
  return {
    projectId,
    architecture: [],
    rules: [],
    decisions: [],
    dependencies: [],
  }
}

export async function getProjectMemory(
  db: SupabaseClient,
  projectId: string
): Promise<ProjectMemory> {
  const { data, error } = await db
    .from("project_memory")
    .select("*")
    .eq("project_id", projectId)
    .single()

  if (error || !data) {
    return emptyMemory(projectId)
  }

  return {
    projectId: data.project_id,
    architecture: data.architecture ?? [],
    rules: (data.rules ?? []).map((r: any) => ({
      id: r.id,
      rule: r.rule,
      category: r.category,
      pinned: r.pinned,
      createdAt: r.createdAt,
    })),
    decisions: data.decisions ?? [],
    dependencies: data.dependencies ?? [],
  }
}

async function saveMemory(
  db: SupabaseClient,
  projectId: string,
  memory: ProjectMemory
): Promise<void> {
  const { error } = await db
    .from("project_memory")
    .upsert(
      {
        project_id: projectId,
        architecture: memory.architecture,
        rules: memory.rules,
        decisions: memory.decisions,
        dependencies: memory.dependencies,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id" }
    )

  if (error) {
    console.error("[saveMemory] error:", error)
    throw new Error(`Failed to save project memory: ${error.message}`)
  }
}

export async function updateProjectMemory(
  db: SupabaseClient,
  projectId: string,
  action: string,
  data: any
): Promise<ProjectMemory> {
  const memory = await getProjectMemory(db, projectId)

  switch (action) {
    case "add_rule": {
      const rule: ProjectRule = {
        id: generateId("rule"),
        rule: data.rule ?? "",
        category: data.category ?? "custom",
        pinned: data.pinned ?? false,
        createdAt: new Date().toISOString(),
      }
      memory.rules.push(rule)
      break
    }
    case "add_decision": {
      memory.decisions.push({
        question: data.question ?? data.decision ?? "",
        answer: data.answer ?? data.reason ?? "",
        timestamp: new Date().toISOString(),
      })
      break
    }
    case "update_architecture": {
      const existing = memory.architecture.find(
        a => a.component === data.component
      )
      if (existing) {
        existing.description = data.description ?? existing.description
      } else {
        memory.architecture.push({
          component: data.component ?? "",
          description: data.description ?? "",
        })
      }
      break
    }
    case "add_dependency": {
      const exists = memory.dependencies.some(
        d => d.from === data.from && d.to === data.to
      )
      if (!exists) {
        memory.dependencies.push({
          from: data.from ?? "",
          to: data.to ?? "",
          type: data.type ?? "uses",
        })
      }
      break
    }
    default:
      throw new Error(`Unknown action: ${action}`)
  }

  await saveMemory(db, projectId, memory)
  return memory
}

export async function removeRule(
  db: SupabaseClient,
  projectId: string,
  ruleId: string
): Promise<boolean> {
  const memory = await getProjectMemory(db, projectId)
  const before = memory.rules.length
  memory.rules = memory.rules.filter(r => r.id !== ruleId)
  if (memory.rules.length === before) return false
  await saveMemory(db, projectId, memory)
  return true
}

export async function addDecision(
  db: SupabaseClient,
  projectId: string,
  question: string,
  answer: string
): Promise<void> {
  const memory = await getProjectMemory(db, projectId)
  memory.decisions.push({
    question,
    answer,
    timestamp: new Date().toISOString(),
  })
  await saveMemory(db, projectId, memory)
}

export function detectContradictions(rules: ProjectRule[]): {
  ruleA: ProjectRule
  ruleB: ProjectRule
  reason: string
}[] {
  const contradictions: { ruleA: ProjectRule; ruleB: ProjectRule; reason: string }[] = []

  const negativePatterns = [
    { neg: /\bnever\b/i, pos: /\balways\b/i },
    { neg: /\bmust not\b/i, pos: /\bmust\b/i },
    { neg: /\bdon'?t\b/i, pos: /\bdo\b/i },
    { neg: /\bavoid\b/i, pos: /\buse\b/i },
    { neg: /\bforbidden\b/i, pos: /\brequired\b/i },
  ]

  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const a = rules[i]
      const b = rules[j]

      for (const pat of negativePatterns) {
        const aHasNeg = pat.neg.test(a.rule)
        const bHasPos = pat.pos.test(b.rule)
        if (aHasNeg && bHasPos) {
          const keyA = a.rule.replace(pat.neg, "").trim().toLowerCase()
          const keyB = b.rule.replace(pat.pos, "").trim().toLowerCase()
          if (keyA.length > 3 && keyB.length > 3 && keyA === keyB) {
            contradictions.push({
              ruleA: a,
              ruleB: b,
              reason: `"${a.rule}" contradicts "${b.rule}"`,
            })
          }
        }

        const aHasPos = pat.pos.test(a.rule)
        const bHasNeg = pat.neg.test(b.rule)
        if (aHasPos && bHasNeg) {
          const keyA = a.rule.replace(pat.pos, "").trim().toLowerCase()
          const keyB = b.rule.replace(pat.neg, "").trim().toLowerCase()
          if (keyA.length > 3 && keyB.length > 3 && keyA === keyB) {
            contradictions.push({
              ruleA: a,
              ruleB: b,
              reason: `"${b.rule}" contradicts "${a.rule}"`,
            })
          }
        }
      }
    }
  }

  return contradictions
}

export function buildContextString(memory: ProjectMemory): string {
  const parts: string[] = []

  if (memory.architecture.length) {
    parts.push("Architecture:")
    for (const a of memory.architecture) {
      parts.push(`  - ${a.component}: ${a.description}`)
    }
  }

  if (memory.rules.length) {
    const pinned = memory.rules.filter(r => r.pinned)
    const others = memory.rules.filter(r => !r.pinned)

    if (pinned.length) {
      parts.push("\nPinned Rules (MUST follow):")
      for (const r of pinned) parts.push(`  - [${r.category}] ${r.rule}`)
    }
    if (others.length) {
      parts.push("\nProject Rules:")
      for (const r of others) parts.push(`  - [${r.category}] ${r.rule}`)
    }
  }

  if (memory.decisions.length) {
    const recent = memory.decisions.slice(-5)
    parts.push("\nRecent Decisions:")
    for (const d of recent) parts.push(`  - ${d.question}: ${d.answer}`)
  }

  if (memory.dependencies.length) {
    parts.push("\nDependencies:")
    for (const dep of memory.dependencies) {
      parts.push(`  - ${dep.from} → ${dep.to} (${dep.type})`)
    }
  }

  return parts.join("\n")
}
