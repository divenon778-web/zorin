import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  roblox_user_id: number | null;
  discord_id: string | null;
  discord_username: string | null;
  discord_avatar: string | null;
  is_admin: boolean;
  unlimited_prompts?: boolean;
  created_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  place_id: number | null 
}

export interface Message {
  id: string;
  project_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}