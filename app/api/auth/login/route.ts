import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req: NextRequest) {

  // Guard against missing env vars up front, so we fail fast instead of
  // building a broken authorize URL later.
  if (!process.env.ROBLOX_CLIENT_ID || !process.env.ROBLOX_REDIRECT_URI) {
    console.error("Missing required env vars for Roblox OAuth start route");
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const state = crypto.randomBytes(16).toString("hex");

  const params = new URLSearchParams({
    client_id:     process.env.ROBLOX_CLIENT_ID!,
    redirect_uri:  process.env.ROBLOX_REDIRECT_URI!,
    response_type: "code",
    scope:         "openid profile",
    state,
  });

  const authUrl = `https://apis.roblox.com/oauth/v1/authorize?${params.toString()}`;

  const response = NextResponse.json({ url: authUrl });

  response.cookies.set("roblox_oauth_state", state, {
    httpOnly: true,
    secure:   true,
    sameSite: "none",
    maxAge:   60 * 10,
    path:     "/",
    domain:   "localhost",
  });

  return response;
}