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
  planner:     "DeepSeek-V4-Pro",
  code:        "DeepSeek-V4-Pro",
  world:       "DeepSeek-V4-Pro",
  ui:          "DeepSeek-V4-Pro",
  test:        "minimaxai/minimax-m3",
  reviewer:    "DeepSeek-V4-Pro",
  performance: "nvidia/nemotron-3-ultra-550b-a55b",
  security:    "nvidia/nemotron-3-ultra-550b-a55b",
  economy:     "minimaxai/minimax-m3",
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

  return "DeepSeek-V4-Pro"
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
    return "minimaxai/minimax-m3"
  }
  return MODEL_MAP[taskType] ?? "DeepSeek-V4-Pro"
}

export function getModelInfo(model: string): { name: string; provider: string; strengths: string } {
  const info: Record<string, { name: string; provider: string; strengths: string }> = {
    "DeepSeek-V4-Pro": {
      name: "DeepSeek V4 Pro",
      provider: "hcnsec.cn",
      strengths: "Primary model — code generation, planning, review, creative tasks",
    },
    "nvidia/nemotron-3-ultra-550b-a55b": {
      name: "Nemotron 3 Ultra 550B",
      provider: "NVIDIA",
      strengths: "Complex reasoning, security analysis, performance optimization",
    },
    "z-ai/glm-5.2": {
      name: "GLM 5.2",
      provider: "NVIDIA",
      strengths: "Creative generation, UI/world building",
    },
    "minimaxai/minimax-m3": {
      name: "MiniMax M3",
      provider: "NVIDIA",
      strengths: "Fast all-rounder, testing, economy calculations",
    },
  }

  return info[model] || { name: model, provider: "unknown", strengths: "General purpose" }
}
