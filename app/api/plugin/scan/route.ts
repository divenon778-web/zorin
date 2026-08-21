import { NextRequest, NextResponse } from "next/server"
import { getAdminSupabase } from "@/lib/supabase"
import { scanSecurity, scanPerformance } from "@/lib/scanners"

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

  let body: { scripts?: { name: string; code: string; type: string }[]; scanType?: "security" | "performance" | "both" } = {}
  try { const raw = await req.text(); body = raw ? JSON.parse(raw) : {} } catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }) }

  if (!Array.isArray(body.scripts) || body.scripts.length === 0) {
    return NextResponse.json({ error: "missing_scripts" }, { status: 400 })
  }

  const scanType = body.scanType || "both"

  try {
    const security = scanType === "security" || scanType === "both" ? scanSecurity(body.scripts) : []
    const performance = scanType === "performance" || scanType === "both" ? scanPerformance(body.scripts) : []

    const totalIssues = security.length + performance.length
    const criticalCount = security.filter(s => s.severity === "critical").length
    const highCount = security.filter(s => s.severity === "high").length + performance.filter(p => p.severity === "high").length

    let summary = `${totalIssues} issue(s) found across ${body.scripts.length} script(s).`
    if (criticalCount) summary += ` ${criticalCount} critical.`
    if (highCount) summary += ` ${highCount} high.`
    if (totalIssues === 0) summary = `No issues found across ${body.scripts.length} script(s).`

    return NextResponse.json({ security, performance, summary })
  } catch (err) {
    return NextResponse.json(
      { error: "scan_failed", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
