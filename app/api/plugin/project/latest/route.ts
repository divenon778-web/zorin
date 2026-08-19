import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    const projectId = req.nextUrl.searchParams.get("projectId");

    if (!token) {
      return NextResponse.json({ error: "missing_token" }, { status: 401 });
    }

    if (!projectId) {
      return NextResponse.json({ error: "missing_project_id" }, { status: 400 });
    }

    const db = getAdminSupabase();

    const { data: tokenRow, error: tokenError } = await db
      .from("plugin_tokens")
      .select("user_id, authorized, expires_at")
      .eq("token", token)
      .single();

    if (tokenError || !tokenRow) {
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }

    if (!tokenRow.authorized || !tokenRow.user_id) {
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      return NextResponse.json({ error: "expired_token" }, { status: 401 });
    }

    const { data: project, error: projectError } = await db
      .from("projects")
      .select("id, user_id, name")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (project.user_id !== tokenRow.user_id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { data: messages, error: messagesError } = await db
      .from("messages")
      .select("role, content, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (messagesError) {
      return NextResponse.json(
        { error: "failed", details: messagesError.message },
        { status: 500 }
      );
    }

    const latestAssistant = (messages ?? []).find((m) => m.role === "assistant");

    if (!latestAssistant) {
      return NextResponse.json({ error: "no_output" }, { status: 404 });
    }

    let parsed: any = null;

    try {
      parsed = JSON.parse(latestAssistant.content);
    } catch {
      parsed = {
        title: project.name,
        summary: latestAssistant.content,
        scripts: [],
        notes: [],
        warnings: [],
      };
    }

    return NextResponse.json(parsed);
  } catch (err) {
    return NextResponse.json(
      {
        error: "failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}