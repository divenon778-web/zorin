import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import siteConfig from "@/site.config.json";

const ALLOWED_TESTERS = new Set(["troojin", "balarinabebe1", "lilbanksj32"]);

const ACTIONS_ALLOWED_PATHS = [
  "/generate",
  "/generate/thinking",
  "/thinking-steps",
  "/models",
  "/health",
];

export async function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const pathname = req.nextUrl.pathname;

  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/assets/")) {
    const res = NextResponse.next();
    res.headers.set("Cache-Control", "public, max-age=31536000, immutable");
    return res;
  }

  if (host === "glxm.cdn.troojin.com") {
    const isImage = /\.(png|jpg|jpeg|gif|webp|svg|avif)$/i.test(pathname);
    if (!isImage || pathname.endsWith("/")) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    const res = NextResponse.next();
    res.headers.set("Cache-Control", "public, max-age=31536000, immutable");
    return res;
  }

  if (host.startsWith("discord.zorin.lol")) {
    return NextResponse.redirect("https://discord.gg/cdwvahVP5j");
  }

  if (host.startsWith("server.error")) {
    return NextResponse.rewrite(new URL("/server-error", req.url));
  }

  if (host === "actions.zorin.lol") {
    if (req.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    const isAllowed = ACTIONS_ALLOWED_PATHS.some(
      (p) => pathname === p || pathname.startsWith(p + "/")
    );

    if (!isAllowed) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const rewrites: Record<string, string> = {
      "/generate":          "/api/actions/generate",
      "/generate/thinking": "/api/actions/thinking",
      "/thinking-steps":    "/api/actions/thinking-steps",
      "/models":            "/api/actions/models",
      "/health":            "/api/actions/health",
    };

    const destination = rewrites[pathname];
    if (destination) {
      const res = NextResponse.rewrite(new URL(destination, req.url));
      res.headers.set("Access-Control-Allow-Origin", "*");
      res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      return res;
    }

    return NextResponse.next();
  }

  if (host === "g.end.lat") {
    const code = pathname.slice(1);

    if (!code || code.length !== 4 || !/^\d+$/.test(code)) {
      return NextResponse.rewrite(new URL("/link-plugin/invalid", req.url));
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data } = await adminSupabase
      .from("plugin_tokens")
      .select("token")
      .eq("device_code", code)
      .eq("authorized", false)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (!data?.token) {
      return NextResponse.rewrite(new URL("/link-plugin/invalid", req.url));
    }

    return NextResponse.redirect(
      `https://zorinai.vercel.app/link-plugin?code=${code}`,
      { status: 307 }
    );
  }

  let response = NextResponse.next({
    request: { headers: req.headers },
  });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        path: "/",
        sameSite: "none",
        secure: true,
        domain: "zorinai.vercel.app",
      },
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options?: object }[]) => {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: req.headers } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, { ...options, domain: "zorinai.vercel.app", sameSite: "none", secure: true } as any)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: { username: string; banned: boolean; ban_reason: string } | null = null;

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("username, banned, ban_reason")
      .eq("id", user.id)
      .single();

    profile = data;
  }

  const isTester = ALLOWED_TESTERS.has(profile?.username ?? "");
  const isMaintenance = (siteConfig as { maintenance?: boolean }).maintenance;

  if (isMaintenance && !isTester && !host.startsWith("server.error")) {
    return NextResponse.redirect("https://server.error.zorin.lol", { status: 307 });
  }

  if (host === "zorin.lol" || host === "www.zorin.lol") {
    if (pathname.startsWith("/auth/")) {
      return NextResponse.redirect(`https://zorinai.vercel.app${pathname}`);
    }

    return NextResponse.next();
  }

  if (host === "dash.zorin.lol" || host.includes("zorinai.vercel.app")) {
    if (profile?.banned && !isTester && !pathname.startsWith("/banned")) {
      const url = new URL("/banned", req.url);
      url.searchParams.set("reason", profile.ban_reason ?? "violation");
      return NextResponse.redirect(url);
    }

    if (pathname === "/") {
      const url = new URL(user ? "/dashboard" : "/auth/login", req.url);
      if (!user) url.searchParams.set("redirect", "/dashboard");
      return NextResponse.redirect(url);
    }

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|icons/|api/|auth/).*)"],
  //                                                              ^^^^^^^^^^^ also excludes /auth/* at the matcher level
};