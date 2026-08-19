import { callGroqWithFallback } from "./ai.js"

export interface TestResult {
  id: string
  taskId: string
  type: "playtest" | "syntax" | "type_check" | "api_check"
  status: "passed" | "failed" | "error"
  details: string
  autoFix?: {
    description: string
    apply: () => Promise<void>
  }
}

export interface PlaytestReport {
  passed: number
  failed: number
  errors: number
  tests: {
    name: string
    status: "passed" | "failed" | "error"
    message?: string
    stack?: string
  }[]
  consoleOutput?: string[]
}

function generateId(): string {
  return `test_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function parsePlaytestOutput(raw: string): PlaytestReport {
  const lines = raw.split("\n")
  const report: PlaytestReport = {
    passed: 0,
    failed: 0,
    errors: 0,
    tests: [],
    consoleOutput: [],
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (trimmed.startsWith("[PASS]") || trimmed.includes("✓") || trimmed.includes("✔")) {
      report.passed++
      const name = trimmed.replace(/^\[PASS\]|✓|✔/g, "").trim()
      report.tests.push({ name, status: "passed" })
    } else if (trimmed.startsWith("[FAIL]") || trimmed.includes("✗") || trimmed.includes("✘")) {
      report.failed++
      const parts = trimmed.replace(/^\[FAIL\]|✗|✘/g, "").trim().split(":")
      const name = parts[0]?.trim() ?? "unnamed"
      const message = parts.slice(1).join(":").trim()
      report.tests.push({ name, status: "failed", message })
    } else if (trimmed.startsWith("[ERROR]")) {
      report.errors++
      const name = trimmed.replace(/^\[ERROR\]/, "").trim()
      report.tests.push({ name, status: "error" })
    } else if (trimmed.startsWith("[INFO]") || trimmed.startsWith("[WARN]")) {
      report.consoleOutput?.push(trimmed)
    } else {
      report.consoleOutput?.push(trimmed)
    }
  }

  return report
}

export function parseTestResults(raw: string): TestResult[] {
  const results: TestResult[] = []

  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        results.push({
          id: item.id ?? generateId(),
          taskId: item.taskId ?? "",
          type: item.type ?? "syntax",
          status: item.status ?? "failed",
          details: item.details ?? "",
        })
      }
      return results
    }
  } catch {}

  const report = parsePlaytestOutput(raw)
  for (const test of report.tests) {
    results.push({
      id: generateId(),
      taskId: "",
      type: "playtest",
      status: test.status,
      details: test.message ?? test.name,
    })
  }

  return results
}

export function compareExpectedVsActual(
  expected: { name: string; expectedBehavior: string }[],
  actual: PlaytestReport
): {
  matched: { name: string; expected: string; actualStatus: string }[]
  unexpected: string[]
  missing: string[]
} {
  const matched: { name: string; expected: string; actualStatus: string }[] = []
  const unexpected: string[] = []
  const missing: string[] = []

  for (const exp of expected) {
    const found = actual.tests.find(t => t.name.toLowerCase() === exp.name.toLowerCase())
    if (found) {
      matched.push({
        name: exp.name,
        expected: exp.expectedBehavior,
        actualStatus: found.status,
      })
    } else {
      missing.push(exp.name)
    }
  }

  for (const test of actual.tests) {
    if (!expected.some(e => e.name.toLowerCase() === test.name.toLowerCase())) {
      unexpected.push(test.name)
    }
  }

  return { matched, unexpected, missing }
}

export async function generateAutoFix(
  code: string,
  testResults: TestResult[]
): Promise<{ description: string; fixedCode: string }[]> {
  const failures = testResults.filter(t => t.status === "failed" || t.status === "error")
  if (failures.length === 0) return []

  const failSummary = failures
    .map(f => `- [${f.type}] ${f.status}: ${f.details}`)
    .join("\n")

  const system = `You are a Roblox Luau expert. Given a script that has failing tests, produce a fixed version.
Return ONLY valid JSON: { "fixes": [{ "description": "what changed", "fixedCode": "full fixed Luau code" }] }
If you cannot fix the issues, return { "fixes": [] }.
Write complete Luau code. Never truncate with comments.`

  const user = `## Script\n\`\`\`lua\n${code}\n\`\`\`\n\n## Failures\n${failSummary}`

  try {
    const { output } = await callGroqWithFallback(system, [{ role: "user", content: user }], 30000)
    const cleaned = output
      .trim()
      .replace(/^```(?:json)?\s*/m, "")
      .replace(/```\s*$/m, "")
      .trim()

    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed.fixes)) {
      return parsed.fixes.map((f: any) => ({
        description: f.description ?? "Auto-fix applied",
        fixedCode: f.fixedCode ?? code,
      }))
    }
  } catch (e) {
    console.error("[generateAutoFix] LLM call failed:", e)
  }

  return []
}

export function calculatePassRate(results: TestResult[]): {
  total: number
  passed: number
  failed: number
  errored: number
  rate: number
} {
  const total = results.length
  const passed = results.filter(r => r.status === "passed").length
  const failed = results.filter(r => r.status === "failed").length
  const errored = results.filter(r => r.status === "error").length
  const rate = total > 0 ? Math.round((passed / total) * 100) : 0

  return { total, passed, failed, errored, rate }
}

export function filterByTask(results: TestResult[], taskId: string): TestResult[] {
  return results.filter(r => r.taskId === taskId)
}

export function filterByType(results: TestResult[], type: TestResult["type"]): TestResult[] {
  return results.filter(r => r.type === type)
}

export function summarizeResults(results: TestResult[]): string {
  const { total, passed, failed, errored, rate } = calculatePassRate(results)
  if (total === 0) return "No test results."
  return `${passed}/${total} passed (${rate}%) — ${failed} failed, ${errored} errored.`
}
