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
  planner:     "deepseek/deepseek-v4-pro-free",
  code:        "deepseek/deepseek-v4-pro-free",
  world:       "deepseek/deepseek-v4-pro-free",
  ui:          "deepseek/deepseek-v4-pro-free",
  test:        "deepseek/deepseek-v4-pro-free",
  reviewer:    "deepseek/deepseek-v4-pro-free",
  performance: "deepseek/deepseek-v4-pro-free",
  security:    "deepseek/deepseek-v4-pro-free",
  economy:     "deepseek/deepseek-v4-pro-free",
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

  return "deepseek/deepseek-v4-pro-free"
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
    "deepseek/deepseek-v4-pro-free": {
      name: "DeepSeek V4 Pro",
      provider: "anthropic",
      strengths: "Advanced reasoning, code generation, Luau/Roblox scripting, complex architecture",
    },
  }

  return info[model] || { name: model, provider: "unknown", strengths: "General purpose" }
}
