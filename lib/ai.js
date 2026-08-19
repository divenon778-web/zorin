import { SYSTEM_PROMPT, STEPS_SYSTEM } from "./prompts.js"

const HCNSEC_BASE  = "https://api.hcnsec.cn/v1/chat/completions"

const HCNSEC_KEY  = "sk-I5e5KLNBS5kXwabGF3y92OrUEF2Tecxkcm1Jse0SY25YE6S5"

export const ALL_MODELS = [
  "kat-coder-pro-v2.5",
  "DeepSeek-V4-Pro",
]

const DEFAULT_MODEL  = "kat-coder-pro-v2.5"
const STEPS_MODEL    = "kat-coder-pro-v2.5"
const THINKING_MODEL = "kat-coder-pro-v2.5"

const MAX_TOKENS = 16384

const MAX_CONVERSATION_CHARS = 64000

const FALLBACK_ORDER = [
  "kat-coder-pro-v2.5",
  "DeepSeek-V4-Pro",
]

export function isValidModel(model) {
  return ALL_MODELS.includes(model)
}

export function getModelProvider() {
  return "hcnsec"
}

const MAX_HISTORY_TURNS = 16

export function scanGameModelForKeywords(gameModel, keywords) {
  if (!gameModel || !keywords?.length) return []

  let parsed
  try {
    parsed = typeof gameModel === "string" ? JSON.parse(gameModel) : gameModel
  } catch {
    return []
  }

  const results = []

  function walk(node, path) {
    if (!node || typeof node !== "object") return

    const name      = node.Name      || node.name      || ""
    const className = node.ClassName || node.className || ""
    const currentPath = path ? `${path}.${name}` : name

    if (name && keywords.some(kw => name.toLowerCase().includes(kw.toLowerCase()))) {
      results.push({ path: currentPath, name, className })
    }

    const children = node.Children || node.children || []
    if (Array.isArray(children)) {
      for (const child of children) walk(child, currentPath)
    }

    if (!Array.isArray(node)) {
      for (const [key, val] of Object.entries(node)) {
        if (
          val &&
          typeof val === "object" &&
          !Array.isArray(val) &&
          key !== "Properties" &&
          key !== "properties" &&
          key !== "Children" &&
          key !== "children"
        ) {
          walk(val, currentPath)
        }
      }
    }
  }

  walk(parsed, "")
  return results
}

export function extractKeywordsFromPrompt(prompt) {
  const stopWords = new Set([
    "the", "they", "when", "then", "want", "make", "have", "will", "should",
    "inside", "into", "with", "from", "that", "this", "player", "script",
    "touch", "reset", "add", "put", "create", "and", "for", "can", "also",
    "like", "just", "get", "set", "use", "give", "let", "run", "its", "all",
    "but", "not", "any", "are", "was", "had", "has", "been", "being", "their",
    "which", "would", "could", "should", "does", "did", "do", "an", "a", "of",
    "to", "in", "on", "at", "by", "if", "so", "or", "is", "it", "be", "as",
  ])

  return [
    ...new Set(
      prompt
        .split(/\s+/)
        .map(w => w.replace(/[^a-zA-Z0-9_]/g, ""))
        .filter(w => w.length > 2 && !stopWords.has(w.toLowerCase()))
    ),
  ]
}

export function buildScanContext(gameModel, prompt) {
  if (!gameModel) return ""

  const keywords = extractKeywordsFromPrompt(prompt)
  const found    = scanGameModelForKeywords(gameModel, keywords)

  if (!found.length) return ""

  const lines = found
    .map(i => `- "${i.name}" (${i.className}) → full path: game.${i.path}`)
    .join("\n")

  return (
    `\n\n## Instances found in the game matching this request:\n${lines}\n\n` +
    `Use these exact paths when writing scripts. ` +
    `If a script should live inside one of these instances, set its "parent" to the full path shown above ` +
    `(e.g. "Workspace.resetblock8"). The plugin will place the script there automatically.`
  )
}

export function summariseAssistantTurn(rawContent) {
  try {
    const d = JSON.parse(rawContent)

    if (d.type === "generation") {
      const parts = []
      if (d.title)   parts.push(`Title: ${d.title}`)
      if (d.summary) parts.push(`Summary: ${d.summary}`)
      if (Array.isArray(d.scripts) && d.scripts.length) {
        for (const s of d.scripts) {
          const name = s.name || s.instanceName || "script"
          const code = s.code || s.source || ""
          if (code) parts.push(`Script (${name}):\n${code}`)
        }
      }
      return parts.join("\n\n") || rawContent
    }

    if (d.type === "clarification") return d.question || rawContent
    if (d.type === "chat")         return d.message  || rawContent

    return rawContent
  } catch {
    return rawContent
  }
}

export function buildMessages(system, userContent, history = []) {
  const messages = []

  const recentHistory = (history || []).slice(-MAX_HISTORY_TURNS * 2)

  for (const msg of recentHistory) {
    const { role, content } = msg
    if (!content) continue

    if (role === "user") {
      messages.push({ role: "user", content })
    } else if (role === "assistant") {
      messages.push({ role: "assistant", content: summariseAssistantTurn(content) })
    }
  }

  messages.push({ role: "user", content: userContent })

  const trimmedMessages = trimToCharLimit(messages, MAX_CONVERSATION_CHARS - system.length)

  return { system, messages: trimmedMessages }
}

function trimToCharLimit(messages, maxChars) {
  const total = () => messages.reduce((sum, m) => sum + (m.content?.length || 0), 0)

  let droppedPairs = 0
  const startTotal = total()

  while (total() > maxChars && messages.length > 1) {
    if (messages[0].role === "user" && messages[1]?.role === "assistant") {
      messages.splice(0, 2)
      droppedPairs++
    } else {
      messages.splice(0, 1)
    }
  }

  if (droppedPairs > 0) {
    console.warn(
      `[trimToCharLimit] dropped ${droppedPairs} oldest turn(s) — ` +
      `started at ${startTotal} chars, cap is ${maxChars}. ` +
      `If this fires often, scripts are getting evicted from context — consider raising MAX_CONVERSATION_CHARS further.`
    )
  }

  if (total() > maxChars && messages.length) {
    const last = messages[messages.length - 1]
    const over = total() - maxChars
    last.content = last.content.slice(0, Math.max(0, last.content.length - over))
    console.warn(`[trimToCharLimit] truncated the current user message by ${over} chars to fit the cap.`)
  }

  return messages
}

async function callHcnsec(system, messages, model, timeoutMs = 60000) {
  console.log("[callHcnsec] model:", model, "messages:", messages.length)

  const controller = new AbortController()
  const timer      = setTimeout(() => controller.abort(), timeoutMs)

  const body = {
    model,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "system", content: system }, ...messages],
    temperature: 0.7,
    top_p: 0.95,
  }

  try {
    const res = await fetch(HCNSEC_BASE, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${HCNSEC_KEY}`,
        "accept": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!res.ok) {
      const err = await res.text()
      const e = new Error(`${model} returned ${res.status}: ${err}`)
      e.isRateLimit = res.status === 429
      e.isAuthError = res.status === 401 || res.status === 403
      e.status = res.status
      throw e
    }

    const data    = await res.json()
    const message = data.choices?.[0]?.message || {}
    const output    = message.content || ""
    const reasoning = message.reasoning_content || message.reasoning || ""

    console.log("[callHcnsec] succeeded — output length:", output.length, "reasoning length:", reasoning.length)
    return { output, reasoning }
  } catch (e) {
    if (e.name === "AbortError") {
      const timeoutErr     = new Error(`${model} timed out after ${timeoutMs}ms`)
      timeoutErr.isTimeout = true
      throw timeoutErr
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}

async function callWithFallback(system, messages, timeoutMs = 60000, preferredModel) {
  const preferred = preferredModel || DEFAULT_MODEL
  const modelOrder = [preferred, ...FALLBACK_ORDER.filter(m => m !== preferred)]

  let lastError

  for (const model of modelOrder) {
    const isDeepSeek = model === "DeepSeek-V4-Pro"
    const modelTimeout = isDeepSeek ? 90000 : timeoutMs

    try {
      console.log(`[callWithFallback] trying "${model}" (${modelTimeout}ms timeout)`)
      const result = await callHcnsec(system, messages, model, modelTimeout)
      if (result.output) {
        if (model !== preferred) {
          console.warn(`[callWithFallback] fell back from "${preferred}" to "${model}"`)
        }
        return { output: result.output, reasoning: result.reasoning, model, fellBack: model !== preferred }
      }
      console.warn(`[callWithFallback] model ${model} returned empty, trying next...`)
    } catch (e) {
      console.warn(`[callWithFallback] model ${model} failed:`, e.message)
      lastError = e
      continue
    }
  }

  throw new Error(`All models failed.${lastError ? " Last error: " + lastError.message : ""}`)
}

export async function callNvidiaWithFallback(system, messages, timeoutMs = 60000, preferredModel) {
  return callWithFallback(system, messages, timeoutMs, preferredModel)
}

export function repairJson(partial) {
  const start = partial.indexOf("{")
  if (start === -1) return partial
  const text = partial.slice(start)

  let inString  = false
  let escapeNext = false
  const stack   = []

  for (const ch of text) {
    if (escapeNext)               { escapeNext = false; continue }
    if (ch === "\\" && inString)  { escapeNext = true;  continue }
    if (ch === '"')               { inString = !inString; continue }
    if (inString)                 continue
    if (ch === "{" || ch === "[") stack.push(ch)
    else if (ch === "}" && stack.at(-1) === "{") stack.pop()
    else if (ch === "]" && stack.at(-1) === "[") stack.pop()
  }

  let closing = inString ? '"' : ""
  for (const opener of [...stack].reverse()) {
    closing += opener === "{" ? "}" : "]"
  }

  return text + closing
}

export function extractJson(raw) {
  console.log("[extractJson] raw length:", raw.length)
  let text = raw.trim()
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/```\s*$/m, "")
    .trim()

  try {
    const result = JSON.parse(text)
    console.log("[extractJson] direct parse succeeded")
    return result
  } catch {}

  const start = text.indexOf("{")
  const end   = text.lastIndexOf("}")
  if (start !== -1 && end > start) {
    try {
      const result = JSON.parse(text.slice(start, end + 1))
      console.log("[extractJson] slice parse succeeded")
      return result
    } catch {}
  }

  try {
    const result      = JSON.parse(repairJson(text))
    result.__repaired = true
    console.log("[extractJson] repair parse succeeded")
    return result
  } catch {}

  console.error("[extractJson] all strategies failed — raw sample:", raw.slice(0, 300))
  return {
    type:          "chat",
    message:       "Something went wrong parsing the response. Please try again.",
    __parse_failed: true,
  }
}

export function buildContext(projectName, datamodel, gameModel) {
  const parts = []

  if (projectName) parts.push(`Project name: ${projectName}`)

  if (datamodel && Object.keys(datamodel).length > 0) {
    parts.push("\n## DataModel snapshot (from Studio plugin)")
    for (const [service, children] of Object.entries(datamodel)) {
      const list = Array.isArray(children) ? children.slice(0, 20) : []
      parts.push(list.length ? `- ${service}: ${list.join(", ")}` : `- ${service}: (empty)`)
    }
  }

  if (gameModel) {
    try {
      const parsed  = JSON.parse(gameModel)
      let compact   = JSON.stringify(parsed)
      if (compact.length > 8000) compact = compact.slice(0, 8000) + "... (truncated)"
      parts.push(`\n## Full game model JSON\n${compact}`)
    } catch {}
  }

  return parts.join("\n")
}

export function normaliseResponse(result, model, reasoning = "", fellBack = false) {
  result.__model         = model
  result.__provider      = "hcnsec.cn"
  result.__fallback_used = fellBack
  const type             = result.type || "generation"
  console.log("[normaliseResponse] type:", type, "model:", model, "fellBack:", fellBack)

  if (type === "generation") {
    for (const key of ["title", "summary"]) {
      if (result[key] == null) result[key] = ""
    }
    for (const key of ["scripts", "instances", "notes", "warnings", "suggestions", "thoughts", "plan", "thinking_steps"]) {
      if (result[key] == null) result[key] = []
    }
    if (reasoning && result.thinking_steps.length === 0) {
      result.thinking_steps = reasoning
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean)
        .slice(0, 12)
    }
    if (result.__repaired) {
      if (!result.warnings) result.warnings = []
      if (!result.warnings.some(w => w.toLowerCase().includes("truncated"))) {
        result.warnings.push(
          "Response was truncated and partially recovered. Some script code may be incomplete — try regenerating."
        )
      }
      delete result.__repaired
    }
  } else if (type === "clarification") {
    if (result.question == null) result.question = "Can you give me more details?"
    if (result.options  == null) result.options  = []
  } else if (type === "chat") {
    if (result.message == null) result.message = ""
  }

  delete result.__parse_failed
  return result
}

export async function runGenerate({
  prompt,
  model,
  projectName = "",
  datamodel,
  gameModel,
  history,
}) {
  console.log("[runGenerate] start — prompt:", prompt.slice(0, 100), "model:", model)

  const cleanHistory = (history || []).filter(msg => {
    if (msg.role === "user") return true
    if (msg.role === "assistant") {
      try {
        const d = JSON.parse(msg.content)
        return d.type === "generation" || d.type === "clarification" || d.type === "chat"
      } catch { return false }
    }
    return false
  })

  const context     = buildContext(projectName, datamodel, gameModel)
  const scanContext = buildScanContext(gameModel, prompt)
  const system      = SYSTEM_PROMPT + (context ? `\n\n${context}` : "") + scanContext
  const { system: sys, messages } = buildMessages(system, prompt, cleanHistory)

  const requestedModel = model && isValidModel(model) ? model : DEFAULT_MODEL

  let raw           = ""
  let usedModel      = requestedModel
  let usedReasoning  = ""
  let fellBack       = false

  try {
    const { output, reasoning, model: pickedModel, fellBack: didFallBack } =
      await callWithFallback(sys, messages, 60000, requestedModel)
    raw           = output
    usedReasoning = reasoning || ""
    usedModel     = pickedModel
    fellBack      = didFallBack
  } catch (e) {
    console.error("[runGenerate] all models failed:", e)
    return {
      type:              "chat",
      message:           `Generation failed: ${e.message}`,
      __model:           requestedModel,
      __provider:        "hcnsec.cn",
      __fallback_used:   false,
    }
  }

  console.log("[runGenerate] raw output:", raw.slice(0, 500))

  const parsed = extractJson(raw)
  console.log("[runGenerate] parsed type:", parsed.type)
  console.log("[runGenerate] parse_failed:", parsed.__parse_failed)

  return normaliseResponse(parsed, usedModel, usedReasoning, fellBack)
}

export async function runFetchSteps(prompt) {
  console.log("[runFetchSteps] prompt:", prompt.slice(0, 100))

  const { system, messages } = buildMessages(STEPS_SYSTEM, prompt, [])

  try {
    const { output } = await callWithFallback(system, messages, 60000, STEPS_MODEL)
    const text = output.trim()
      .replace(/^```(?:json)?\s*/m, "")
      .replace(/```\s*$/m, "")
      .trim()
    console.log("[runFetchSteps] raw output:", text.slice(0, 200))
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) {
      return parsed.slice(0, 6).map(String).filter(s => s.trim())
    }
  } catch (e) {
    console.error("[runFetchSteps] all models failed:", e)
  }

  return []
}

export async function runThinking({
  prompt,
  model,
  projectName = "",
  datamodel,
  gameModel,
  history,
}) {
  console.log("[runThinking] start — prompt:", prompt.slice(0, 100))

  const cleanHistory = (history || []).filter(msg => {
    if (msg.role === "user") return true
    if (msg.role === "assistant") {
      try {
        const d = JSON.parse(msg.content)
        return d.type === "generation" || d.type === "clarification" || d.type === "chat"
      } catch { return false }
    }
    return false
  })

  const context     = buildContext(projectName, datamodel, gameModel)
  const scanContext = buildScanContext(gameModel, prompt)
  const system =
    SYSTEM_PROMPT +
    (context ? `\n\n${context}` : "") +
    scanContext +
    "\n\nDo not write the full response yet. Think through the request carefully: " +
    "what the user wants, what Roblox/Luau systems are involved, " +
    "what edge cases or ambiguities exist, and the implementation approach you'll take."

  const { system: sys, messages } = buildMessages(system, prompt, cleanHistory)

  const requestedModel = model && isValidModel(model) ? model : THINKING_MODEL

  try {
    const { output, reasoning, model: usedModel, fellBack } =
      await callWithFallback(sys, messages, 60000, requestedModel)

    const steps = (reasoning || output)
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean)
      .slice(0, 20)

    return {
      type:            "thinking",
      thinking_steps:  steps,
      __model:         usedModel,
      __provider:      "hcnsec.cn",
      __fallback_used: fellBack,
    }
  } catch (e) {
    console.error("[runThinking] all models failed:", e)
    return {
      type:            "thinking",
      thinking_steps:  [],
      __error:         `Thinking pass failed: ${e.message}`,
      __model:         requestedModel,
      __provider:      "hcnsec.cn",
      __fallback_used: false,
    }
  }
}
