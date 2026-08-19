





import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const db = getAdminSupabase();
  const auth  = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";

  if (!token) {
    return NextResponse.json({ error: "missing_token" }, { status: 401 });
  }


  const { data: tokenRow } = await db
    .from("plugin_tokens")
    .select("user_id, authorized, expires_at")
    .eq("token", token)
    .eq("authorized", true)
    .single();

  if (!tokenRow) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  if (new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: "token_expired" }, { status: 401 });
  }


  const { data: message } = await db
    .from("messages")
    .select("content, created_at, project_id")
    .eq("user_id", tokenRow.user_id)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!message) {

    return NextResponse.json({ error: "no_result" }, { status: 404 });
  }


  try {
    const data = JSON.parse(message.content);
    return NextResponse.json({
      ...data,
      _meta: {
        generatedAt: message.created_at,
        projectId:   message.project_id,
      },
    });
  } catch {
    return NextResponse.json({ error: "invalid_content" }, { status: 500 });
  }
}