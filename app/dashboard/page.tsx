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
        // Wait a bit for cookie to be available
        await new Promise(r => setTimeout(r, 300));
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          window.location.replace("/auth/login?redirect=/dashboard");
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          window.location.replace("/auth/login?redirect=/dashboard");
          return;
        }

        // Fetch profile
        const client = supabase;
        const { data: profileData } = await client
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (!profileData) {
          window.location.replace("/auth/login?redirect=/dashboard");
          return;
        }

        setProfile(profileData);

        // Fetch projects
        const { data: projectsData } = await client
          .from("projects")
          .select("id, name, description, created_at, updated_at, user_id, place_id")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false });

        setProjects((projectsData as Project[]) ?? []);
      } catch (err) {
        console.error("Dashboard load error:", err);
        window.location.replace("/auth/login?redirect=/dashboard");
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