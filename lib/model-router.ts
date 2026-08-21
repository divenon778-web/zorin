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
  planner:     "deepseek-v4-pro-0813",
  code:        "deepseek-v4-pro-0813",
  world:       "deepseek-v4-pro-0813",
  ui:          "deepseek-v4-pro-0813",
  test:        "deepseek-v4-pro-0813",
  reviewer:    "deepseek-v4-pro-0813",
  performance: "deepseek-v4-pro-0813",
  security:    "deepseek-v4-pro-0813",
  economy:     "deepseek-v4-pro-0813",
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

  return "deepseek-v4-pro-0813"
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
  return MODEL_MAP[taskType] ?? "deepseek-v4-pro-0813"
}

export function getModelInfo(model: string): { name: string; provider: string; strengths: string } {
  const info: Record<string, { name: string; provider: string; strengths: string }> = {
    "deepseek-v4-pro-0813": {
      name: "GPT-5.6 Sol",
      provider: "openai",
      strengths: "Advanced reasoning, code generation, Luau/Roblox scripting, complex architecture",
    },
  }

  return info[model] || { name: model, provider: "unknown", strengths: "General purpose" }
}
