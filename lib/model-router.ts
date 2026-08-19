import { GROQ_MODELS } from "./ai.js"

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
  planner:     "openai/gpt-oss-120b",
  code:        "openai/gpt-oss-120b",
  world:       "openai/gpt-oss-120b",
  ui:          "openai/gpt-oss-120b",
  test:        "openai/gpt-oss-20b",
  reviewer:    "openai/gpt-oss-120b",
  performance: "openai/gpt-oss-120b",
  security:    "openai/gpt-oss-120b",
  economy:     "openai/gpt-oss-120b",
}

const FAST_TASKS: TaskType[] = ["test", "economy"]

const ESTIMATED_TOKENS: Record<TaskType, number> = {
  planner:     800,
  code:        2048,
  world:       1024,
  ui:          1024,
  test:        600,
  reviewer:    1200,
  performance: 1000,
  security:    1200,
  economy:     800,
}

export function routeModel(taskType: string, preference?: string): string {
  if (preference && GROQ_MODELS.includes(preference)) return preference

  const mapped = MODEL_MAP[taskType as TaskType]
  if (mapped) return mapped

  return "openai/gpt-oss-120b"
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
  if (fast && FAST_TASKS.includes(taskType)) {
    return "openai/gpt-oss-20b"
  }
  return MODEL_MAP[taskType] ?? "openai/gpt-oss-120b"
}
