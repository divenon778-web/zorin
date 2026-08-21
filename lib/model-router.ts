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
  planner:     "gpt-4.1-free",
  code:        "gpt-4.1-free",
  world:       "gpt-4.1-free",
  ui:          "gpt-4.1-free",
  test:        "gpt-4.1-free",
  reviewer:    "gpt-4.1-free",
  performance: "gpt-4.1-free",
  security:    "gpt-4.1-free",
  economy:     "gpt-4.1-free",
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

  return "gpt-4.1-free"
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
    "gpt-4.1-free": {
      name: "GPT-4.1",
      provider: "openai",
      strengths: "Advanced reasoning, code generation, Luau/Roblox scripting, complex architecture",
    },
    "gpt-4o-free": {
      name: "GPT-4o",
      provider: "openai",
      strengths: "Fast all-rounder, good code generation, Luau/Roblox scripting",
    },
    "gemini-3.7-flash-free": {
      name: "Gemini 3.7 Flash",
      provider: "google",
      strengths: "Fast inference, good code generation, Luau/Roblox scripting",
    },
  }

  return info[model] || { name: model, provider: "unknown", strengths: "General purpose" }
}
