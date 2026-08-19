import { NextRequest, NextResponse } from "next/server"
import { runGenerate, runGenerateStream, isValidModel } from "@/lib/ai"
import { CORS_HEADERS, handleOptions } from "@/lib/cors"

export async function OPTIONS() {
  return handleOptions()
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const prompt      = (body.prompt      || "").trim()
    const model       = (body.model       || "").trim()
    const projectName = (body.projectName || "").trim()
    const datamodel   = body.datamodel   || null
    const gameModel   = body.gameModel   || null
    const history     = body.history     || []
    const stream      = body.stream      || false

    if (!prompt) {
      return NextResponse.json({ error: "prompt required" }, { status: 400, headers: CORS_HEADERS })
    }

    const effectiveModel = model && isValidModel(model) ? model : ""

    if (stream) {
      const result = await runGenerateStream({ prompt, model: effectiveModel, projectName, datamodel, gameModel, history })
      if (!result) {
        return NextResponse.json(
          { type: "chat", message: "All models failed. Please try again.", __model: "error" },
          { status: 500, headers: CORS_HEADERS }
        )
      }
      return new Response(result.stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "X-Accel-Buffering": "no",
          ...CORS_HEADERS,
        },
      })
    }

    const result = await runGenerate({ prompt, model: effectiveModel, projectName, datamodel, gameModel, history })
    return NextResponse.json(result, { headers: CORS_HEADERS })
  } catch (err) {
    console.error("[/api/actions/generate]", err)
    return NextResponse.json(
      { type: "chat", message: "Something went wrong. Please try again.", __model: "error" },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
