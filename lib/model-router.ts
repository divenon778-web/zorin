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
  planner:     "claude-opus-5-thinking",
  code:        "claude-opus-5-thinking",
  world:       "claude-opus-5-thinking",
  ui:          "claude-opus-5-thinking",
  test:        "claude-opus-5-thinking",
  reviewer:    "claude-opus-5-thinking",
  performance: "claude-opus-5-thinking",
  security:    "claude-opus-5-thinking",
  economy:     "claude-opus-5-thinking",
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

  return "claude-opus-5-thinking"
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
  return MODEL_MAP[taskType] ?? "claude-opus-5-thinking"
}

export function getModelInfo(model: string): { name: string; provider: string; strengths: string } {
  const info: Record<string, { name: string; provider: string; strengths: string }> = {
    "claude-opus-5-thinking": {
      name: "Claude Opus 5 Thinking",
      provider: "tabitoken",
      strengths: "Advanced reasoning, code generation, Luau/Roblox scripting, complex architecture",
    },
    "qwen/qwen3.8-max-free": {
      name: "Qwen 3.8 Max (legacy)",
      provider: "tokenrouter",
      strengths: "Advanced reasoning, code generation, Luau/Roblox scripting, complex architecture (legacy id)",
    },
    // legacy alias
    "deepseek/deepseek-v4-pro-free": {
      name: "Claude Opus 5 Thinking",
      provider: "tabitoken",
      strengths: "Advanced reasoning, code generation, Luau/Roblox scripting, complex architecture (legacy id)",
    },
  }

  return info[model] || { name: model, provider: "unknown", strengths: "General purpose" }
}
