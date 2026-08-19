import { NextResponse } from "next/server"
import { CORS_HEADERS, handleOptions } from "@/lib/cors"
import { ALL_MODELS, getModelProvider } from "@/lib/ai.js"
import { getModelInfo } from "@/lib/model-router"

export async function OPTIONS() {
  return handleOptions()
}

export async function GET() {
  const models = ALL_MODELS.map(model => {
    const info = getModelInfo(model)
    return {
      id: model,
      name: info.name,
      provider: info.provider,
      strengths: info.strengths,
      isNvidia: getModelProvider(model) === "nvidia",
    }
  })

  return NextResponse.json({ models }, { headers: CORS_HEADERS })
}