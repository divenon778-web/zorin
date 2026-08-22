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
  planner:     "gpt-5.6-sol",
  code:        "gpt-5.6-sol",
  world:       "gpt-5.6-sol",
  ui:          "gpt-5.6-sol",
  test:        "gpt-5.6-sol",
  reviewer:    "gpt-5.6-sol",
  performance: "gpt-5.6-sol",
  security:    "gpt-5.6-sol",
  economy:     "gpt-5.6-sol",
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

  return "gpt-5.6-sol"
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
  return MODEL_MAP[taskType] ?? "gpt-5.6-sol"
}

export function getModelInfo(model: string): { name: string; provider: string; strengths: string } {
  const info: Record<string, { name: string; provider: string; strengths: string }> = {
    "gpt-5.6-sol": {
      name: "GPT 5.6 Sol",
      provider: "seekai",
      strengths: "Advanced reasoning, code generation, Luau/Roblox scripting, complex architecture",
    },
    "claude-opus-5-thinking": {
      name: "Claude Opus 5 Thinking (legacy)",
      provider: "tabitoken",
      strengths: "Advanced reasoning, code generation, Luau/Roblox scripting, complex architecture (legacy)",
    },
    "qwen/qwen3.8-max-free": {
      name: "Qwen 3.8 Max (legacy)",
      provider: "tokenrouter",
      strengths: "Advanced reasoning, code generation, Luau/Roblox scripting, complex architecture (legacy id)",
    },
    // legacy alias
    "deepseek/deepseek-v4-pro-free": {
      name: "DeepSeek V4 (legacy)",
      provider: "orcarouter",
      strengths: "Advanced reasoning, code generation, Luau/Roblox scripting, complex architecture (legacy id)",
    },
  }

  return info[model] || { name: model, provider: "unknown", strengths: "General purpose" }
}
