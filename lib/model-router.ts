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
  planner:     "kimi-k2.7-code",
  code:        "kimi-k2.7-code",
  world:       "kimi-k2.7-code",
  ui:          "kimi-k2.7-code",
  test:        "kimi-k2.7-code",
  reviewer:    "kimi-k2.7-code",
  performance: "kimi-k2.7-code",
  security:    "kimi-k2.7-code",
  economy:     "kimi-k2.7-code",
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

  return "kimi-k2.7-code"
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
  return MODEL_MAP[taskType] ?? "deepseek/deepseek-v4-pro-free"
}

export function getModelInfo(model: string): { name: string; provider: string; strengths: string } {
  const info: Record<string, { name: string; provider: string; strengths: string }> = {
    "kimi-k2.7-code": {
      name: "Kimi K2.7 Code",
      provider: "aihubmix",
      strengths: "Advanced reasoning, code generation, Luau/Roblox scripting, complex architecture",
    },
    "kimi-k3": {
      name: "Kimi K3",
      provider: "aihubmix",
      strengths: "Advanced reasoning, code generation, Luau/Roblox scripting, complex architecture",
    },
  }

  return info[model] || { name: model, provider: "unknown", strengths: "General purpose" }
}
