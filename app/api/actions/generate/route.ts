import { NextRequest } from "next/server"
import { runGenerate, isValidModel } from "@/lib/ai"
import { CORS_HEADERS } from "@/lib/cors"

export const runtime = "edge"

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
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

    if (!prompt) {
      return Response.json({ error: "prompt required" }, { status: 400, headers: CORS_HEADERS })
    }

    const effectiveModel = model && isValidModel(model) ? model : ""

    const result = await runGenerate({ prompt, model: effectiveModel, projectName, datamodel, gameModel, history })
    return Response.json(result, { headers: CORS_HEADERS })
  } catch (err) {
    console.error("[/api/actions/generate]", err)
    return Response.json(
      { type: "chat", message: "Something went wrong. Please try again.", __model: "error" },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
