import { isValidModel } from "./ai.js"

export type TaskType =
  | "planner"
  | "code"
  | "world"
  | "ui"
  | "test"
  | "reviewer"
  | "performance"
  | "security"
  | "economy"

const MODEL_MAP: Record<TaskType, string> = {
  planner:     "nvidia/nemotron-3-ultra-550b-a55b",
  code:        "nvidia/nemotron-3-ultra-550b-a55b",
  world:       "nvidia/nemotron-3-ultra-550b-a55b",
  ui:          "nvidia/nemotron-3-ultra-550b-a55b",
  test:        "nvidia/nemotron-3-ultra-550b-a55b",
  reviewer:    "nvidia/nemotron-3-ultra-550b-a55b",
  performance: "nvidia/nemotron-3-ultra-550b-a55b",
  security:    "nvidia/nemotron-3-ultra-550b-a55b",
  economy:     "nvidia/nemotron-3-ultra-550b-a55b",
}

const FAST_TASKS: TaskType[] = ["test", "economy"]

const ESTIMATED_TOKENS: Record<TaskType, number> = {
  planner:     1200,
  code:        4096,
  world:       2048,
  ui:          2048,
  test:        800,
  reviewer:    1600,
  performance: 1400,
  security:    1400,
  economy:     800,
}

export function routeModel(taskType: string, preference?: string): string {
  if (preference && isValidModel(preference)) return preference

  const mapped = MODEL_MAP[taskType as TaskType]
  if (mapped) return mapped

  return "nvidia/nemotron-3-ultra-550b-a55b"
}

export function isFastTask(taskType: string): boolean {
  return FAST_TASKS.includes(taskType as TaskType)
}

export function estimateCost(taskType: string): { model: string; estimatedTokens: number } {
  const model = routeModel(taskType)
  const estimatedTokens = ESTIMATED_TOKENS[taskType as TaskType] ?? 1000
  return { model, estimatedTokens }
}

export function getSpecialistModel(taskType: TaskType, fast?: boolean): string {
  return MODEL_MAP[taskType] ?? "kat-coder-pro-v2.5"
}

export function getModelInfo(model: string): { name: string; provider: string; strengths: string } {
  const info: Record<string, { name: string; provider: string; strengths: string }> = {
    "nvidia/nemotron-3-ultra-550b-a55b": {
      name: "Nemotron 3 Ultra 550B",
      provider: "nvidia",
      strengths: "Smart — complex reasoning, code generation, Lua/Roblox scripting",
    },
    "deepseek-v4-flash": {
      name: "DeepSeek V4 Flash",
      provider: "api.b.ai",
      strengths: "Fast — code generation, planning, all tasks",
    },
    "kat-coder-pro-v2.5": {
      name: "Kat Coder Pro v2.5",
      provider: "hcnsec.cn",
      strengths: "Fast — code generation, planning, all tasks",
    },
    "DeepSeek-V4-Pro": {
      name: "DeepSeek V4 Pro (Nemotron 3 Ultra)",
      provider: "hcnsec.cn",
      strengths: "High quality fallback — complex reasoning, better code (slower)",
    },
  }

  return info[model] || { name: model, provider: "unknown", strengths: "General purpose" }
}
