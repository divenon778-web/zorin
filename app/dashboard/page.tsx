"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import DashboardShell from "./shell";
import type { Project, Profile } from "@/lib/supabase";

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log("[Dashboard] Starting auth check...");
        
        // Wait a bit for cookie to be available
        await new Promise(r => setTimeout(r, 300));
        
        console.log("[Dashboard] Checking session...");
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        console.log("[Dashboard] getUser result:", { user: !!user, error: userError?.message });
        
        if (!user || userError) {
          console.log("[Dashboard] No valid user, redirecting to login");
          window.location.replace("/auth/login?redirect=/dashboard");
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        console.log("[Dashboard] getSession result:", { session: !!session });
        
        if (!session) {
          console.log("[Dashboard] No session, redirecting to login");
          window.location.replace("/auth/login?redirect=/dashboard");
          return;
        }

        console.log("[Dashboard] Fetching/creating profile...");
        // Fetch or create profile
        const client = supabase;
        let { data: profileData, error: profileError } = await client
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        // If no profile, create a basic one
        if (!profileData || profileError) {
          console.log("[Dashboard] Profile not found, creating one...");
          const username = user.user_metadata?.username || user.email?.split('@')[0] || `user_${user.id.slice(0, 8)}`;
          const displayName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || `User ${user.id.slice(0, 8)}`;
          
          const { data: newProfile, error: createError } = await client
            .from("profiles")
            .insert({
              id: user.id,
              username,
              display_name: displayName,
              avatar_url: user.user_metadata?.avatar_url || null,
              roblox_user_id: null,
              discord_id: null,
              discord_username: null,
              discord_avatar: null,
              is_admin: false,
              created_at: new Date().toISOString(),
            })
            .select()
            .single();
          
          if (createError) {
            console.log("[Dashboard] Profile create error, using temp:", createError.message);
            // Use temp profile to allow access
            profileData = {
              id: user.id,
              username,
              display_name: displayName,
              avatar_url: null,
              roblox_user_id: null,
              discord_id: null,
              discord_username: null,
              discord_avatar: null,
              is_admin: false,
              created_at: new Date().toISOString(),
            } as Profile;
          } else {
            profileData = newProfile as Profile;
          }
        }

        console.log("[Dashboard] Profile ready:", { profile: !!profileData });
        setProfile(profileData);

        console.log("[Dashboard] Fetching projects...");
        // Fetch projects
        const { data: projectsData, error: projectsError } = await client
          .from("projects")
          .select("id, name, description, created_at, updated_at, user_id, place_id")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false });

        console.log("[Dashboard] Projects fetch result:", { count: projectsData?.length, error: projectsError?.message });
        setProjects((projectsData as Project[]) ?? []);
      } catch (err) {
        console.error("[Dashboard] Unexpected error:", err);
        // Don't redirect on error - let user see dashboard
        console.log("[Dashboard] Allowing access despite error");
        setLoading(false);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <div style={{ 
        minHeight: "100vh", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center",
        background: "#0a0a0c",
        color: "#fff"
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ 
            width: 40, height: 40, margin: "0 auto 16px", 
            border: "3px solid rgba(255,255,255,0.1)", 
            borderTopColor: "#8b7ff5", borderRadius: "50%",
            animation: "spin 1s linear infinite"
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ color: "rgba(255,255,255,0.6)" }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return <DashboardShell profile={profile!} initialProjects={projects} />;
}