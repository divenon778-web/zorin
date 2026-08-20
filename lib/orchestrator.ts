import { callNvidiaWithFallback, extractJson, normaliseResponse, buildContext, buildScanContext } from "./ai.js"
import { routeModel } from "./model-router"
import { scanSecurity, scanPerformance, ScanResult } from "./scanners"

export type AgentType =
  | "planner"
  | "code"
  | "world"
  | "ui"
  | "test"
  | "reviewer"
  | "performance"
  | "security"
  | "economy"

export interface AgentTask {
  id: string
  type: AgentType
  prompt: string
  status: "pending" | "running" | "completed" | "failed" | "skipped"
  dependencies: string[]
  result: any
  error?: string
}

export interface OrchestratorResult {
  taskGraph: AgentTask[]
  mergedOutput: any
  status: "completed" | "partial" | "failed"
  warnings: string[]
  summary: string
  runId: string
  projectId: string
}

export interface OrchestratorInput {
  prompt: string
  projectId?: string
  projectName?: string
  datamodel?: Record<string, string[]>
  gameModel?: string
  runId?: string
  projectMemory?: string
  mode?: "default" | "advanced"
}

const AGENT_SYSTEM_PROMPTS: Record<AgentType, string> = {
  planner: `You are Wisp AI Planner — a Roblox game feature architect.
Given a user request and project context, produce a structured task plan.
Always respond with ONLY valid JSON, no markdown fences.

{
  "type": "plan",
  "title": "Short title (5 words max)",
  "overview": "2-3 sentence summary of the feature and architectural approach",
  "tasks": [
    {
      "id": "task_1",
      "type": "code|world|ui|test|performance|security|economy",
      "description": "What this task does",
      "dependencies": ["task IDs that must finish first"],
      "estimatedComplexity": "low|medium|high"
    }
  ],
  "data_flow": ["Server/client interaction descriptions"],
  "considerations": ["Edge cases, security, performance flags"]
}

Rules:
- Tasks must be granular and specific
- Mark dependencies accurately — independent tasks should have empty dependencies
- Always include a reviewer task that depends on all code tasks
- Flag security-sensitive tasks (DataStore, remotes, player data)
- Flag performance-sensitive tasks (Heartbeat, raycasting, large loops)`,

  code: `You are Wisp AI Code Specialist — a senior Roblox Luau developer.
Generate production-quality Luau code for the given task.
Always respond with ONLY valid JSON, no markdown fences.

{
  "type": "generation",
  "title": "Short title",
  "summary": "What was built",
  "scripts": [
    {
      "name": "ScriptName",
      "type": "Script | LocalScript | ModuleScript",
      "parent": "ServerScriptService | StarterPlayerScripts | ReplicatedStorage | StarterGui | Workspace",
      "code": "-- Complete Luau code"
    }
  ],
  "instances": [
    {
      "name": "InstanceName",
      "class": "ClassName",
      "parent": "ServiceName"
    }
  ],
  "deletions": [],
  "notes": [],
  "warnings": []
}

Luau rules:
- Annotate function params and return types
- Guard RemoteEvent args with type checks
- Use task.wait(), task.spawn(), task.delay() — never wait(), spawn(), delay()
- Cache services at top: local Players = game:GetService("Players")
- Wrap DataStore calls in pcall
- Early returns to reduce nesting
- Complete scripts — never truncate`,

  world: `You are Wisp AI World Specialist — a Roblox environment and world-building expert.
Generate Luau code for world interactions: terrain, parts, models, spatial systems, spawning, environmental effects.
Always respond with ONLY valid JSON, no markdown fences.

{
  "type": "generation",
  "title": "Short title",
  "summary": "What was built",
  "scripts": [
    {
      "name": "ScriptName",
      "type": "Script | LocalScript | ModuleScript",
      "parent": "Workspace | ServerScriptService | ReplicatedStorage",
      "code": "-- Complete Luau code"
    }
  ],
  "instances": [
    { "name": "Name", "class": "ClassName", "parent": "Workspace" }
  ],
  "notes": [],
  "warnings": []
}

World rules:
- Handle CharacterAdded for player spawning and respawn
- Use CollectionService tags for dynamic world objects
- Anchor or weld parts appropriately
- Use Vector3.new() with named constants for positions
- Clean up connections and instances when no longer needed
- For procedural terrain, use Terrain:FillRegion() or Terrain:FillWedge() carefully`,

  ui: `You are Wisp AI UI Specialist — a Roblox GUI and player interface expert.
Generate LocalScripts for player UI: HUDs, menus, inventory screens, notification systems, minigames.
Always respond with ONLY valid JSON, no markdown fences.

{
  "type": "generation",
  "title": "Short title",
  "summary": "What was built",
  "scripts": [
    {
      "name": "ScriptName",
      "type": "LocalScript",
      "parent": "StarterGui | StarterPlayerScripts",
      "code": "-- Complete Luau code"
    }
  ],
  "instances": [
    { "name": "ScreenGuiName", "class": "ScreenGui", "parent": "StarterGui" }
  ],
  "notes": [],
  "warnings": []
}

UI rules:
- Always use LocalScript for UI logic
- Parent ScreenGuis to StarterGui, not PlayerGui directly
- TweenService for animations, not coroutines with waits
- Debounce button clicks to prevent double-fires
- Use UDim2.new() for positioning and sizing
- Disconnect UI connections on CharacterRemoving
- Update UI through RemoteEvents from server, not direct client manipulation
- Use UIListLayout, UIStroke, UICorner for consistent styling`,

  test: `You are Wisp AI Test Specialist — a Roblox QA and playtesting expert.
Write unit tests or integration test scripts for the generated code.
Always respond with ONLY valid JSON, no markdown fences.

{
  "type": "test_plan",
  "title": "Test plan title",
  "tests": [
    {
      "name": "test_name",
      "type": "unit | integration | edge_case",
      "description": "What this test verifies",
      "steps": ["step 1", "step 2"],
      "expected": "Expected outcome"
    }
  ],
  "testScript": {
    "name": "TestScript",
    "type": "Script",
    "parent": "ServerScriptService",
    "code": "-- Complete test runner code"
  },
  "notes": []
}

Test rules:
- Test both happy paths and edge cases
- Test remote argument validation (send invalid types)
- Test DataStore failure scenarios
- Test player disconnect during operations
- Use checkpoints to verify state changes
- Output results in [PASS] / [FAIL] / [ERROR] format`,

  reviewer: `You are Wisp AI Reviewer — a senior Roblox code reviewer.
Review the generated code for correctness, security, performance, and style. Do NOT rewrite code — only report issues.
Always respond with ONLY valid JSON, no markdown fences.

{
  "type": "review",
  "overallRating": "good | needs_work | critical",
  "issues": [
    {
      "severity": "critical | high | medium | low",
      "category": "security | performance | correctness | style | architecture",
      "file": "ScriptName",
      "line": 42,
      "description": "What the issue is",
      "suggestion": "How to fix it"
    }
  ],
  "summary": "Overall assessment",
  "approved": true | false
}

Review checklist:
- All RemoteEvent args validated on server
- DataStore calls wrapped in pcall
- Connections stored and disconnected
- No client-authoritative state for security-sensitive values
- Services cached at script top
- task.wait() not wait()
- Complete scripts, no truncation
- Type annotations present`,

  performance: `You are Wisp AI Performance Specialist — a Roblox performance optimization expert.
Analyze generated code for performance issues and suggest optimizations.
Always respond with ONLY valid JSON, no markdown fences.

{
  "type": "performance_review",
  "score": 85,
  "issues": [
    {
      "severity": "high | medium | low",
      "category": "heartbeat | polling | memory | raycast | instance_creation",
      "file": "ScriptName",
      "line": 30,
      "description": "Performance issue",
      "impact": "Estimated impact description",
      "fix": "Optimization suggestion"
    }
  ],
  "optimizedCode": [
    {
      "name": "ScriptName",
      "code": "-- Optimized version if changes needed"
    }
  ],
  "summary": "Performance assessment"
}

Check for:
- Heartbeat/RenderStepped with expensive operations
- Polling loops instead of events
- Connection leaks
- Unthrottled raycasting
- Instance.new() at runtime vs cloning
- Repeated GetChildren/GetDescendants calls
- Large table allocations in hot paths
- pairs() where ipairs() would be faster`,

  security: `You are Wisp AI Security Specialist — a Roblox security auditor.
Analyze generated code for security vulnerabilities and trust-boundary violations.
Always respond with ONLY valid JSON, no markdown fences.

{
  "type": "security_review",
  "riskLevel": "low | medium | high | critical",
  "vulnerabilities": [
    {
      "severity": "critical | high | medium | low",
      "category": "client_authority | remote_validation | datastore | code_injection | trust_boundary",
      "file": "ScriptName",
      "line": 15,
      "description": "Security issue",
      "exploit": "How an attacker could abuse this",
      "fix": "How to fix it"
    }
  ],
  "hardenedCode": [
    {
      "name": "ScriptName",
      "code": "-- Hardened version if changes needed"
    }
  ],
  "summary": "Security assessment"
}

Security checklist:
- No client-authoritative currency/inventory/damage
- All RemoteEvent/RemoteFunction args validated
- DataStore only accessed from server
- No loadstring or dynamic require
- Rate limiting on remote fires
- No exposed API keys
- Server-authoritative game state
- Input sanitization for all player data`,

  economy: `You are Wisp AI Economy Specialist — a Roblox game economy designer.
Design balanced in-game economies: currencies, pricing, rewards, shop systems, progression.
Always respond with ONLY valid JSON, no markdown fences.

{
  "type": "economy_design",
  "title": "Economy system title",
  "currencies": [
    { "name": "CurrencyName", "type": "soft | hard", "earnRate": "description", "sinkRate": "description" }
  ],
  "pricing": [
    { "item": "ItemName", "currency": "CurrencyName", "price": 100, "justification": "Why this price" }
  ],
  "scripts": [
    {
      "name": "ScriptName",
      "type": "Script | ModuleScript",
      "parent": "ServerScriptService | ReplicatedStorage",
      "code": "-- Complete Luau code"
    }
  ],
  "balancing_notes": ["Design considerations"],
  "anti_exploit": ["Security measures for economy"]
}

Economy rules:
- All currency mutations must be server-authoritative
- Anti-farm: cooldowns, diminishing returns, daily caps
- Soft currency (earnable) vs hard currency (premium)
- Sink sources to prevent inflation
- Price anchoring and psychological pricing
- DataStore for persistence with backup strategies`,
}

function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function topoSortWithDeps(tasks: AgentTask[]): AgentTask[][] {
  const levels: AgentTask[][] = []
  const completed = new Set<string>()
  let remaining = [...tasks]

  while (remaining.length > 0) {
    const ready = remaining.filter(
      t => t.dependencies.every(d => completed.has(d))
    )
    if (ready.length === 0) break

    levels.push(ready)
    for (const t of ready) completed.add(t.id)
    remaining = remaining.filter(t => !completed.has(t.id))
  }

  return levels
}

async function callAgent(
  type: AgentType,
  prompt: string,
  context: string
): Promise<any> {
  const system = AGENT_SYSTEM_PROMPTS[type] + (context ? `\n\n## Project Context\n${context}` : "")
  const model = routeModel(type)
  const messages = [{ role: "user" as const, content: prompt }]

  const { output, model: usedModel } = await callNvidiaWithFallback(system, messages, 25000, model)
  const parsed = extractJson(output)
  return normaliseResponse(parsed, usedModel)
}

async function runTask(
  task: AgentTask,
  context: string
): Promise<void> {
  task.status = "running"

  try {
    task.result = await callAgent(task.type, task.prompt, context)
    task.status = "completed"
  } catch (e: any) {
    task.status = "failed"
    task.error = e.message ?? "Unknown error"
  }
}

function extractScripts(results: any[]): { name: string; code: string }[] {
  const scripts: { name: string; code: string }[] = []
  for (const result of results) {
    if (!result?.scripts) continue
    for (const s of result.scripts) {
      if (s.name && s.code) scripts.push({ name: s.name, code: s.code })
    }
  }
  return scripts
}

export async function runOrchestrator(input: OrchestratorInput): Promise<OrchestratorResult> {
  const runId = input.runId ?? `run_${Date.now()}`
  const projectId = input.projectId ?? ""
  const warnings: string[] = []

  const projectContext = buildContext(input.projectName ?? "", input.datamodel, input.gameModel)
  const scanContext = buildScanContext(input.gameModel, input.prompt)
  const memoryContext = input.projectMemory ?? ""
  const fullContext = [projectContext, scanContext, memoryContext].filter(Boolean).join("\n\n")

  const planPrompt = `User request: ${input.prompt}\n\nProject context:\n${fullContext || "(none)"}`

  let plannerResult: any
  try {
    plannerResult = await callAgent("planner", planPrompt, fullContext)
  } catch (e: any) {
    return {
      taskGraph: [],
      mergedOutput: null,
      status: "failed",
      warnings: [...warnings, `Planner failed: ${e.message}`],
      summary: `Orchestration failed: planner could not create a plan.`,
      runId,
      projectId,
    }
  }

  const taskSpecs = plannerResult.tasks ?? plannerResult.scripts_needed ?? []
  const tasks: AgentTask[] = []

  for (const spec of taskSpecs) {
    tasks.push({
      id: spec.id ?? generateTaskId(),
      type: spec.type ?? "code",
      prompt: spec.description ?? spec.purpose ?? JSON.stringify(spec),
      status: "pending",
      dependencies: spec.dependencies ?? [],
      result: null,
    })
  }

  tasks.push({
    id: generateTaskId(),
    type: "reviewer",
    prompt: `Review all generated code for correctness, security, and performance.\n\nOriginal request: ${input.prompt}`,
    status: "pending",
    dependencies: tasks.map(t => t.id),
    result: null,
  })

  const levels = topoSortWithDeps(tasks)

  for (const level of levels) {
    await Promise.all(
      level.map(task => runTask(task, fullContext))
    )
  }

  const completedTasks = tasks.filter(t => t.status === "completed")
  const failedTasks = tasks.filter(t => t.status === "failed")

  const allResults = completedTasks
    .map(t => t.result)
    .filter(Boolean)

  const mergedOutput = mergeResults(allResults, plannerResult)

  const reviewerTask = tasks.find(t => t.type === "reviewer" && t.status === "completed")
  if (reviewerTask?.result?.approved === false) {
    warnings.push("Reviewer did not approve the output — review issues may need addressing.")
  }

  if (reviewerTask?.result?.issues) {
    for (const issue of reviewerTask.result.issues) {
      if (issue.severity === "critical") {
        warnings.push(`Critical review issue: ${issue.description}`)
      }
    }
  }

  const scripts = extractScripts(allResults)
  const allCode = scripts.map(s => s.code).join("\n\n")

  if (allCode) {
    const secScan: ScanResult = scanSecurity(allCode)
    for (const issue of secScan.issues) {
      if (issue.severity === "critical" || issue.severity === "high") {
        warnings.push(`Security: ${issue.description} (line ${issue.line})`)
      }
    }

    const perfScan: ScanResult = scanPerformance(allCode)
    for (const issue of perfScan.issues) {
      if (issue.severity === "critical" || issue.severity === "high") {
        warnings.push(`Performance: ${issue.description} (line ${issue.line})`)
      }
    }
  }

  let status: OrchestratorResult["status"] = "completed"
  if (failedTasks.length === tasks.length) status = "failed"
  else if (failedTasks.length > 0) status = "partial"

  const summary = buildSummary(tasks, plannerResult, status, warnings)

  return {
    taskGraph: tasks,
    mergedOutput,
    status,
    warnings,
    summary,
    runId,
    projectId,
  }
}

function mergeResults(results: any[], plannerResult: any): any {
  const scripts: any[] = []
  const instances: any[] = []
  const deletions: any[] = []
  const notes: string[] = []
  const warnings: string[] = []
  const suggestions: string[] = []

  for (const result of results) {
    if (!result) continue
    if (result.scripts) scripts.push(...result.scripts)
    if (result.instances) instances.push(...result.instances)
    if (result.deletions) deletions.push(...result.deletions)
    if (result.notes) notes.push(...result.notes)
    if (result.warnings) warnings.push(...result.warnings)
    if (result.suggestions) suggestions.push(...result.suggestions)
    if (result.optimizedCode) {
      for (const opt of result.optimizedCode) {
        const existing = scripts.find((s: any) => s.name === opt.name)
        if (existing) existing.code = opt.code
      }
    }
    if (result.hardenedCode) {
      for (const h of result.hardenedCode) {
        const existing = scripts.find((s: any) => s.name === h.name)
        if (existing) existing.code = h.code
      }
    }
  }

  const title = plannerResult?.title ?? "Multi-agent generation"
  const summary = plannerResult?.overview ?? `Generated ${scripts.length} script(s) across ${results.length} agent(s).`

  return {
    type: "generation",
    title,
    summary,
    scripts,
    instances,
    deletions,
    notes,
    warnings,
    suggestions,
    thoughts: [],
    plan: [],
    thinking_steps: [],
  }
}

function buildSummary(
  tasks: AgentTask[],
  plannerResult: any,
  status: OrchestratorResult["status"],
  warnings: string[]
): string {
  const completed = tasks.filter(t => t.status === "completed").length
  const failed = tasks.filter(t => t.status === "failed").length
  const total = tasks.length

  const title = plannerResult?.title ?? "Multi-agent generation"
  const lines = [
    `## ${title}`,
    `Status: ${status} — ${completed}/${total} tasks completed, ${failed} failed.`,
    "",
  ]

  for (const task of tasks) {
    const icon =
      task.status === "completed" ? "✓" :
      task.status === "failed" ? "✗" :
      task.status === "skipped" ? "○" : "…"
    lines.push(`${icon} [${task.type}] ${task.prompt.slice(0, 80)}`)
  }

  if (warnings.length) {
    lines.push("")
    lines.push("Warnings:")
    for (const w of warnings) lines.push(`  ⚠ ${w}`)
  }

  return lines.join("\n")
}
