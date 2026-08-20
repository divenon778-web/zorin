import { NextRequest, NextResponse } from "next/server";

const DASH_URL  = "https://wispai.vercel.app";
const ERROR_URL = `${DASH_URL}/oautherror`;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");


  if (error) {
    return NextResponse.redirect(`${ERROR_URL}?error=access_denied`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${ERROR_URL}?error=missing_params`);
  }


  const storedState = req.cookies.get("roblox_oauth_state")?.value;

  if (!storedState) {

    console.error("CSRF cookie missing. Cookies present:", req.cookies.getAll().map(c => c.name));
    return NextResponse.redirect(`${ERROR_URL}?error=invalid_state`);
  }

  if (storedState !== state) {
    console.error("CSRF mismatch. Expected:", storedState, "Got:", state);
    return NextResponse.redirect(`${ERROR_URL}?error=invalid_state`);
  }

  try {

    const tokenRes = await fetch("https://apis.roblox.com/oauth/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "authorization_code",
        code,
        redirect_uri:  process.env.ROBLOX_REDIRECT_URI!,
        client_id:     process.env.ROBLOX_CLIENT_ID!,
        client_secret: process.env.ROBLOX_CLIENT_SECRET!,
      }),
    });

    if (!tokenRes.ok) {
      console.error("Token exchange failed:", await tokenRes.text());
      return NextResponse.redirect(`${ERROR_URL}?error=token_exchange`);
    }

    const tokenData   = await tokenRes.json();
    const accessToken = tokenData.access_token as string;


    const userRes = await fetch("https://apis.roblox.com/oauth/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userRes.ok) {
      return NextResponse.redirect(`${ERROR_URL}?error=userinfo_failed`);
    }

    const userInfo = await userRes.json();

    const session = {
      userId:      userInfo.sub,
      username:    userInfo.preferred_username ?? userInfo.name ?? userInfo.nickname,
      displayName: userInfo.name ?? userInfo.preferred_username,
      avatar:      userInfo.picture ?? null,
      accessToken,
      expiresAt:   Date.now() + tokenData.expires_in * 1000,
    };

    const response = NextResponse.redirect(DASH_URL);


    response.cookies.set("wisp_session", JSON.stringify(session), {
      httpOnly: true,
      secure:   true,
      sameSite: "none",
      maxAge:   tokenData.expires_in,
      path:     "/",
domain:   "wispai.vercel.app",
    });

    response.cookies.set("roblox_oauth_state", "", {
      httpOnly: true,
      secure:   true,
      sameSite: "none",
      maxAge:   0,
      path:     "/",
      domain:   "wispai.vercel.app",
    });

    return response;

  } catch (err) {
    console.error("OAuth callback error:", err);
    return NextResponse.redirect(`${ERROR_URL}?error=server_error`);
  }
}