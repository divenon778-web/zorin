import { NextResponse } from "next/server"
import { runThinking } from "@/lib/ai"

export const maxDuration = 60

export async function POST(req) {
  try {
    const body = await req.json()
    const prompt = (body.prompt || "").trim()

    if (!prompt) {
      return NextResponse.json({ steps: [] })
    }

    const result = await runThinking({ prompt })
    return NextResponse.json({ steps: result.thinking_steps ?? [] })
  } catch (err) {
    console.error("[/api/actions/thinking-steps]", err)
    return NextResponse.json({ steps: [] })
  }
}