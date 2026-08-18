import { createServerSupabase } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase";
import { LinkPluginClient } from "./client";

export default async function LinkPluginPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let username: string | null = null;
  let avatarUrl: string | null = null;
  let robloxUserId: number | null = null;

  if (user) {
    const admin = getAdminSupabase();
    const { data: profile } = await admin
      .from("profiles")
      .select("username, display_name, avatar_url, roblox_user_id")
      .eq("id", user.id)
      .single();

    username =
      profile?.username?.trim() ||
      profile?.display_name?.trim() ||
      user.email?.split("@")[0] ||
      "user";

    avatarUrl = profile?.avatar_url ?? null;
    robloxUserId = profile?.roblox_user_id ?? null;
  }

  return (
    <LinkPluginClient
      code={code ?? null}
      user={
        user
          ? {
              username: username ?? "user",
              userId: user.id,
              avatarUrl,
              robloxUserId,
            }
          : null
      }
    />
  );
}