import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const { code, discordId } = await req.json();

  if (!code || !discordId) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }

  const { error } = await supabase
    .from("discord_verify_codes")
    .insert({
      code,
      discord_id: discordId,
      verified: false,
      expires_at: new Date(Date.now() + 1000 * 60 * 10).toISOString(),
    });

  if (error) {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}