import { NextRequest, NextResponse } from "next/server"
import { getAdminSupabase } from "@/lib/supabase"

export async function POST(req: NextRequest) {
  const auth  = req.headers.get("authorization") ?? ""
  const token = auth.replace(/^Bearer\s+/i, "").trim()
  if (!token) return NextResponse.json({ error: "no token" }, { status: 401 })

  const db = getAdminSupabase()

  const { data: session, error: sessionErr } = await db
    .from("plugin_sessions")
    .select("user_id")
    .eq("token", token)
    .maybeSingle()

  if (sessionErr || !session) {
    return NextResponse.json({ error: "invalid token" }, { status: 401 })
  }

  let body: { model?: string; placeId?: string | number; universeId?: string | number; thumbnailApiUrl?: string } = {}
  try { body = await req.json() } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }) }

  const model = body.model
  if (!model || typeof model !== "string") {
    return NextResponse.json({ error: "missing model" }, { status: 400 })
  }

  const MAX_MODEL_BYTES = 8_000_000
  if (model.length > MAX_MODEL_BYTES) {
    return NextResponse.json({ error: "model_too_large", max_bytes: MAX_MODEL_BYTES }, { status: 413 })
  }

  try {
    JSON.parse(model)
  } catch {
    return NextResponse.json({ error: "model_not_valid_json" }, { status: 400 })
  }

  const placeIdNum    = body.placeId    ? Number(body.placeId)    : 0
  const universeIdNum = body.universeId ? Number(body.universeId) : 0
  const placeId       = placeIdNum    > 0 ? placeIdNum    : null
  const universeId    = universeIdNum > 0 ? universeIdNum : null

  console.log(`[game-model] placeId=${placeId} universeId=${universeId} from body:`, body.placeId, body.universeId)

  const { error: upsertErr } = await db
    .from("game_models")
    .upsert(
      {
        user_id:     session.user_id,
        model_json:  model,
        place_id:    placeId,
        universe_id: universeId,
        updated_at:  new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )

  if (upsertErr) {
    console.error("[game-model] upsert failed:", upsertErr.message)
    return NextResponse.json({ error: "db error" }, { status: 500 })
  }


  if (placeId) {
    const { data: alreadyLinked } = await db
      .from("projects")
      .select("id")
      .eq("user_id", session.user_id)
      .eq("place_id", placeId)
      .maybeSingle()

    if (!alreadyLinked) {

      const { data: unlinked } = await db
        .from("projects")
        .select("id")
        .eq("user_id", session.user_id)
        .is("place_id", null)

      if (unlinked && unlinked.length > 0) {
        for (const project of unlinked) {
          await db
            .from("projects")
            .update({ place_id: placeId })
            .eq("id", project.id)
          console.log(`[game-model] linked project ${project.id} → place ${placeId}`)
        }
      }
    }
  }

  console.log(`[game-model] stored ${model.length} chars for user ${session.user_id}`)
  return NextResponse.json({ ok: true, bytes: model.length, placeId, universeId })
}

export async function GET(req: NextRequest) {
  const auth  = req.headers.get("authorization") ?? ""
  const token = auth.replace(/^Bearer\s+/i, "").trim()
  if (!token) return NextResponse.json({ error: "no token" }, { status: 401 })

  const db = getAdminSupabase()

  const { data: session } = await db
    .from("plugin_sessions")
    .select("user_id")
    .eq("token", token)
    .maybeSingle()

  if (!session) return NextResponse.json({ error: "invalid token" }, { status: 401 })

  const { data, error } = await db
    .from("game_models")
    .select("model_json, place_id, universe_id, updated_at")
    .eq("user_id", session.user_id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: "db error" }, { status: 500 })
  if (!data)  return NextResponse.json({ model: null })

  return NextResponse.json({
    model:      data.model_json,
    placeId:    data.place_id,
    universeId: data.universe_id,
    updated_at: data.updated_at,
  })
}