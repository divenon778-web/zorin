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
  planner:     "kat-coder-pro-v2.5",
  code:        "kat-coder-pro-v2.5",
  world:       "kat-coder-pro-v2.5",
  ui:          "kat-coder-pro-v2.5",
  test:        "kat-coder-pro-v2.5",
  reviewer:    "kat-coder-pro-v2.5",
  performance: "kat-coder-pro-v2.5",
  security:    "kat-coder-pro-v2.5",
  economy:     "kat-coder-pro-v2.5",
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

  return "kat-coder-pro-v2.5"
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
