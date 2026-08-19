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
  planner:     "gpt-5.6-luna",
  code:        "gpt-5.6-luna",
  world:       "gpt-5.6-luna",
  ui:          "gpt-5.6-luna",
  test:        "minimaxai/minimax-m3",
  reviewer:    "gpt-5.6-luna",
  performance: "DeepSeek-V4-Pro",
  security:    "DeepSeek-V4-Pro",
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

  return "gpt-5.6-luna"
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
  return MODEL_MAP[taskType] ?? "gpt-5.6-luna"
}

export function getModelInfo(model: string): { name: string; provider: string; strengths: string } {
  const info: Record<string, { name: string; provider: string; strengths: string }> = {
    "gpt-5.6-luna": {
      name: "GPT-5.6 Luna",
      provider: "SeekAI",
      strengths: "Primary — code generation, planning, review, creative tasks",
    },
    "DeepSeek-V4-Pro": {
      name: "DeepSeek V4 Pro",
      provider: "hcnsec.cn",
      strengths: "Performance analysis, security scanning, complex reasoning",
    },
    "nvidia/nemotron-3-ultra-550b-a55b": {
      name: "Nemotron 3 Ultra 550B",
      provider: "NVIDIA",
      strengths: "Fallback reasoning (requires NVIDIA_API_KEY)",
    },
    "z-ai/glm-5.2": {
      name: "GLM 5.2",
      provider: "NVIDIA",
      strengths: "Fallback creative (requires NVIDIA_API_KEY)",
    },
    "minimaxai/minimax-m3": {
      name: "MiniMax M3",
      provider: "NVIDIA",
      strengths: "Fast all-rounder, testing, economy (requires NVIDIA_API_KEY)",
    },
  }

  return info[model] || { name: model, provider: "unknown", strengths: "General purpose" }
}
