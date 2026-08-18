import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.json({ 
      error: "Missing code or state", 
      received: { 
        hasCode: !!code, 
        hasState: !!state,
        fullUrl: req.url 
      } 
    }, { status: 400 });
  }

  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI!,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return NextResponse.json({ error: "Token exchange failed" }, { status: 400 });

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const discordUser = await userRes.json();

    await fetch(`https://discord.com/api/v10/guilds/1483532383805505649/members/${discordUser.id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
        "User-Agent": "ZorinApp (https://zorinai.vercel.app, 1.0.0)",
      },
      body: JSON.stringify({
        access_token: tokenData.access_token,
      }),
    });

    const admin = getAdminSupabase();
    const { error: dbError } = await admin
      .from("profiles")
      .update({
        discord_id: discordUser.id,
        discord_username: discordUser.username,
        discord_avatar: discordUser.avatar,
      })
      .eq("id", state);

    if (dbError) throw dbError;

    return NextResponse.redirect(new URL("/dashboard", req.url));
  } catch (err) {
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}