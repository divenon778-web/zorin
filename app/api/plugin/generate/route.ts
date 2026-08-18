




import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const db = getAdminSupabase();
  const auth  = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 401 });

  const { data: rowData } = await db
    .from("plugin_tokens")
    .select("user_id, authorized, expires_at, profiles(username, display_name)")
    .eq("token", token)
    .eq("authorized", true)
    .single();

  const row = rowData as { user_id: string; authorized: boolean; expires_at: string; profiles: { username: string; display_name: string }[] | null } | null;

  if (!row)                                    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  if (new Date(row.expires_at) < new Date())   return NextResponse.json({ error: "token_expired" }, { status: 401 });

  const profileRaw = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const profile = profileRaw as { username: string; display_name: string } | null;

  let prompt = "";
  let model  = "toolbaz-v4.5-fast";
  try { const body = await req.json(); prompt = body?.prompt ?? ""; if (body?.model) model = body.model; }
  catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }


  if (prompt === "__ping__") {
    return NextResponse.json({ _meta: { generatedBy: profile?.display_name ?? "User", username: profile?.username } });
  }

  if (!prompt.trim()) return NextResponse.json({ error: "missing_prompt" }, { status: 400 });

  try {
    const aiRes = await fetch(process.env.AI_API_URL ?? "https://zorinai.vercel.app/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prompt.trim(), model, mode: "generate" }),
    });
    if (!aiRes.ok) return NextResponse.json({ error: "ai_error" }, { status: 502 });
    const data = await aiRes.json();
    return NextResponse.json({ ...data, _meta: { generatedBy: profile?.display_name ?? "User", username: profile?.username } });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
