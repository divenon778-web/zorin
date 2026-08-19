import { NextRequest, NextResponse } from "next/server"
import { getAdminSupabase } from "@/lib/supabase"
import { callGroqWithFallback, extractJson } from "@/lib/ai.js"

const EXPLAIN_SYSTEM = `You are Zeugo AI — an expert Roblox Luau architect.

Given a game model JSON, explain the game's architecture. Analyze the instance tree, identify systems, and describe how they connect.

Respond with ONLY valid JSON:
{
  "type": "explanation",
  "title": "Short title describing the game",
  "content": "Detailed explanation of the architecture in markdown",
  "systems": [
    {
      "name": "System Name",
      "purpose": "What this system does",
      "dependencies": ["OtherSystem1", "OtherSystem2"]
    }
  ]
}

Adjust depth based on the user's level:
- beginner: simple analogies, no jargon
- developer: technical but approachable, include class names
- expert: detailed API references, performance notes, edge cases`

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

  let body: { gameModel?: string; depth?: "beginner" | "developer" | "expert"; query?: string } = {}
  try { body = await req.json() } catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }) }

  if (!body.gameModel) return NextResponse.json({ error: "missing_gameModel" }, { status: 400 })

  const depth = body.depth || "developer"
  let compactModel: string
  try {
    const parsed = JSON.parse(body.gameModel)
    compactModel = JSON.stringify(parsed)
    if (compactModel.length > 12000) compactModel = compactModel.slice(0, 12000) + "... (truncated)"
  } catch {
    return NextResponse.json({ error: "invalid_gameModel_json" }, { status: 400 })
  }

  const userPrompt = `Explain this game's architecture at a **${depth}** level.\n\n${body.query ? `User question: ${body.query}\n\n` : ""}Game model:\n${compactModel}`

  const messages = [{ role: "user" as const, content: userPrompt }]

  try {
    const { output, model, fellBack } = await callGroqWithFallback(EXPLAIN_SYSTEM, messages, 45000)
    const parsed = extractJson(output)

    if (parsed.type && parsed.type !== "explanation") {
      parsed.type = "explanation"
    }

    return NextResponse.json({
      type: "explanation",
      title: parsed.title || "Game Architecture",
      content: parsed.content || "No explanation generated.",
      systems: Array.isArray(parsed.systems) ? parsed.systems : [],
      __model: model,
      __fallback_used: fellBack,
    })
  } catch (err) {
    console.error("[explain] error:", err)
    return NextResponse.json(
      { error: "explain_failed", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
