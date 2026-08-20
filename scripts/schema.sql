-- =============================================================================
-- Wisp AI Database Schema Migration
-- =============================================================================
-- This migration creates all tables needed for Wisp AI features.
-- Existing tables (plugin_tokens, plugin_sessions, plugin_heartbeats, profiles,
-- projects, messages) are NOT recreated.
-- =============================================================================

-- =============================================================================
-- 1. task_runs — Individual orchestration runs
-- =============================================================================
CREATE TABLE IF NOT EXISTS task_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id),
  project_id UUID REFERENCES projects(id),
  prompt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'partial', 'failed', 'rolled_back')),
  mode TEXT NOT NULL DEFAULT 'default' CHECK (mode IN ('default', 'advanced')),
  task_graph JSONB DEFAULT '[]',
  merged_output JSONB,
  warnings TEXT[] DEFAULT '{}',
  summary TEXT,
  model TEXT,
  tokens_used INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- =============================================================================
-- 2. checkpoints — Change snapshots for rollback
-- =============================================================================
CREATE TABLE IF NOT EXISTS checkpoints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES task_runs(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id),
  project_id UUID REFERENCES projects(id),
  label TEXT NOT NULL DEFAULT '',
  changes JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'rolled_back')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 3. project_memory — Persistent project knowledge
-- =============================================================================
CREATE TABLE IF NOT EXISTS project_memory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  architecture JSONB DEFAULT '{"services": [], "patterns": [], "namingConventions": []}',
  rules JSONB DEFAULT '[]',
  decisions JSONB DEFAULT '[]',
  dependencies JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id)
);

-- =============================================================================
-- 4. agent_skills — Reusable agent skills
-- =============================================================================
CREATE TABLE IF NOT EXISTS agent_skills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('combat', 'inventory', 'tycoon', 'ui', 'npc', 'round', 'moderation', 'analytics', 'economy', 'datastore', 'custom')),
  description TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  rules TEXT[] DEFAULT '{}',
  tests JSONB DEFAULT '[]',
  expected_structure JSONB DEFAULT '{}',
  is_public BOOLEAN DEFAULT false,
  verified BOOLEAN DEFAULT false,
  test_pass_rate FLOAT DEFAULT 0,
  install_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 5. skill_installs — Tracks which projects use which skills
-- =============================================================================
CREATE TABLE IF NOT EXISTS skill_installs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  skill_id UUID NOT NULL REFERENCES agent_skills(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  installed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(skill_id, project_id)
);

-- =============================================================================
-- 6. scan_results — Security/performance scan history
-- =============================================================================
CREATE TABLE IF NOT EXISTS scan_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id),
  run_id UUID REFERENCES task_runs(id) ON DELETE SET NULL,
  scan_type TEXT NOT NULL CHECK (scan_type IN ('security', 'performance', 'both')),
  results JSONB DEFAULT '{"security": [], "performance": [], "summary": ""}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 7. change_log — Human-readable change history
-- =============================================================================
CREATE TABLE IF NOT EXISTS change_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id),
  run_id UUID REFERENCES task_runs(id) ON DELETE SET NULL,
  task_id TEXT,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'rolled_back')),
  target_type TEXT NOT NULL CHECK (target_type IN ('script', 'instance', 'checkpoint', 'memory_rule')),
  target_name TEXT NOT NULL,
  before_data JSONB,
  after_data JSONB,
  diff TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- Indexes for performance
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_task_runs_user ON task_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_task_runs_project ON task_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_run ON checkpoints(run_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_project ON checkpoints(project_id);
CREATE INDEX IF NOT EXISTS idx_project_memory_project ON project_memory(project_id);
CREATE INDEX IF NOT EXISTS idx_agent_skills_category ON agent_skills(category);
CREATE INDEX IF NOT EXISTS idx_agent_skills_public ON agent_skills(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_scan_results_user ON scan_results(user_id);
CREATE INDEX IF NOT EXISTS idx_change_log_run ON change_log(run_id);
CREATE INDEX IF NOT EXISTS idx_change_log_user ON change_log(user_id);

-- =============================================================================
-- 8. credits — Per-user credit balance
-- =============================================================================
-- Run this manually in Supabase SQL Editor:
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 50;
-- UPDATE profiles SET credits = 70000000 WHERE id IN (SELECT id FROM profiles WHERE email = 'divenon778@gmail.com');
