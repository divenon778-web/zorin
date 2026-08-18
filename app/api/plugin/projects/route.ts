import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

    if (!token) {
      return NextResponse.json({ error: "missing_token" }, { status: 401 });
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

    const { data: projects, error: projectsError } = await db
      .from("projects")
      .select("id, name, updated_at")
      .eq("user_id", tokenRow.user_id)
      .order("updated_at", { ascending: false });

    if (projectsError) {
      return NextResponse.json(
        { error: "failed", details: projectsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ projects: projects ?? [] });
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