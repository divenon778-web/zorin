import { SYSTEM_PROMPT, STEPS_SYSTEM } from "./prompts.js"

const SEEKAI_BASE = "https://seekai.cc/v1/chat/completions"
const SEEKAI_MODEL = "gpt-5.6-sol"
const SEEKAI_API_KEY = process.env.NEW_API_KEY || process.env.SEEKAI_API_KEY || process.env.TABITOKEN_API_KEY || process.env.TOKENROUTER_API_KEY || process.env.ORCAROUTER_API_KEY || ""

const TABI_BASE = SEEKAI_BASE
const TABI_MODEL = SEEKAI_MODEL
const TABI_API_KEY = SEEKAI_API_KEY

// Keep legacy names for backwards compat
const OLLAMA_BASE = TABI_BASE
const OLLAMA_MODEL = TABI_MODEL
const OLLAMA_API_KEY = TABI_API_KEY

export const ALL_MODELS = [
  "gpt-5.6-sol",
  // legacy aliases — still accepted
  "claude-opus-5-thinking",
  "deepseek/deepseek-v4-pro-free",
  "qwen/qwen3.8-max-free",
]

const DEFAULT_MODEL  = "gpt-5.6-sol"
const STEPS_MODEL    = "gpt-5.6-sol"
const THINKING_MODEL = "gpt-5.6-sol"

const MAX_TOKENS = 16384

const MAX_CONVERSATION_CHARS = 64000

export function stripThinkingTags(text) {
  if (!text) return text
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim()
}

const FALLBACK_ORDER = [
  "gpt-5.6-sol",
  "claude-opus-5-thinking",
  "qwen/qwen3.8-max-free",
]

export function isValidModel(model) {
  return ALL_MODELS.includes(model)
}

export function getModelProvider() {
  return "seekai"
}

const MAX_HISTORY_TURNS = 6

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

    // handle array roots (gameData is array of services)
    if (Array.isArray(node)) {
      for (const child of node) walk(child, path)
      return
    }

    const name      = node.Name      || node.name      || ""
    const className = node.ClassName || node.className || ""
    // skip empty or "Game"/"DataModel" root names from path
    const isRootGame = !path && (name.toLowerCase() === "game" || name.toLowerCase() === "datamodel")
    const currentPath = isRootGame ? "" : (path ? `${path}.${name}` : name)

    if (name && !isRootGame && keywords.some(kw => name.toLowerCase().includes(kw.toLowerCase()))) {
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

export function enforceScanParent(parsed, gameModel, prompt) {
  try {
    if (!parsed || parsed.type !== "generation" || !Array.isArray(parsed.scripts) || !parsed.scripts.length) return parsed
    if (!gameModel || !prompt) return parsed
    const keywords = extractKeywordsFromPrompt(prompt)
    const found = scanGameModelForKeywords(gameModel, keywords)
    if (!found.length) return parsed

    const scannedLower = new Set(found.map(f => (f.path || "").toLowerCase()))
    const hasCorrect = parsed.scripts.some(s => scannedLower.has(((s.parent || "").toLowerCase())))
    if (hasCorrect) return parsed

    const promptLower = prompt.toLowerCase()
    // find best scanned match mentioned in prompt
    let best = found.find(f => promptLower.includes((f.name || "").toLowerCase())) || found[0]
    if (!best) return parsed
    let bestPath = (best.path || "").replace(/^game\./i, "").replace(/^\.+/, "")
    if (!bestPath) return parsed

    for (const script of parsed.scripts) {
      const parentLower = (script.parent || "").toLowerCase()
      const isGenericService = ["workspace","serverscriptservice","replicatedstorage","startergui","starterplayerscripts","startercharacterscripts","serverstorage","lighting","replicatedfirst","players","starterpack"].includes(parentLower)
      if (!isGenericService) continue
      const codeLower = (script.code || "").toLowerCase()
      const mentions = found.some(f => codeLower.includes((f.name || "").toLowerCase()) || codeLower.includes((f.path || "").toLowerCase().split(".").pop().toLowerCase()))
      const promptMentions = promptLower.includes((best.name || "").toLowerCase())
      if (mentions || promptMentions || isGenericService) {
        const oldParent = script.parent
        script.parent = bestPath
        if (!parsed.notes) parsed.notes = []
        // avoid duplicate note
        const note = `Auto-corrected script "${script.name}" parent from "${oldParent}" to scanned instance "${bestPath}"`
        if (!parsed.notes.includes(note)) parsed.notes.push(note)
        console.log(`[enforceScanParent] fixed "${script.name}" parent ${oldParent} -> ${bestPath} (scanned: ${best.name} ${best.className})`)
        break
      }
    }
  } catch (e) {
    console.warn("[enforceScanParent] failed:", e.message)
  }
  return parsed
}

export function enforceParentForType(parsed) {
  try {
    if (!parsed || parsed.type !== "generation" || !Array.isArray(parsed.scripts)) return parsed
    for (const script of parsed.scripts) {
      const typeLower = (script.type || "").toLowerCase().replace(/\s+/g, "")
      const parentLower = (script.parent || "").toLowerCase()
      const code = (script.code || "").toLowerCase()
      let fixedParent = null
      let reason = ""

      // LocalScript should NEVER be in ServerScriptService / ServerStorage / ReplicatedStorage
      if (typeLower === "localscript") {
        if (parentLower === "serverscriptservice" || parentLower === "serverstorage" || parentLower === "replicatedstorage") {
          // decide between StarterCharacterScripts vs StarterPlayerScripts vs StarterGui
          const isCharacterScript = code.includes("character") || code.includes("humanoid") || code.includes("characteradded") || code.includes("startercharacterscripts") || code.includes("walkspeed") || code.includes("jumppower") || code.includes("script.parent") && (code.includes("humanoid") || code.includes("character"))
          const isGuiScript = code.includes("screengui") || code.includes("frame") || code.includes("textlabel") || code.includes("imagebutton") || code.includes("startergui") || (code.includes("guiservice") && !isCharacterScript)
          if (isCharacterScript) {
            fixedParent = "StarterCharacterScripts"
            reason = "LocalScript with character/humanoid logic belongs in StarterCharacterScripts (resets on respawn)"
          } else if (isGuiScript) {
            fixedParent = "StarterGui"
            reason = "LocalScript with UI logic belongs in StarterGui"
          } else {
            fixedParent = "StarterPlayerScripts"
            reason = "LocalScript belongs in StarterPlayerScripts (persists across respawn)"
          }
        }
        // also catch startercharacterscripts misplacement: if script is meant for character but parent is starterplayerscripts, should move?
        // keep as is for now, but log
      }

      // Script (server) should NEVER be in Starter* / StarterGui
      if (typeLower === "script") {
        if (parentLower === "starterplayerscripts" || parentLower === "startercharacterscripts" || parentLower === "startergui" || parentLower === "starterpack") {
          fixedParent = "ServerScriptService"
          reason = "Script (server) cannot run in client container " + script.parent + " -> moved to ServerScriptService"
        }
      }

      if (fixedParent && fixedParent.toLowerCase() !== parentLower) {
        const old = script.parent
        script.parent = fixedParent
        if (!parsed.notes) parsed.notes = []
        const note = `Auto-corrected "${script.name}" (${script.type}) parent from "${old}" to "${fixedParent}" -- ${reason}`
        if (!parsed.notes.includes(note)) parsed.notes.push(note)
        console.log(`[enforceParentForType] fixed "${script.name}" ${old} -> ${fixedParent} (${reason})`)
      }
    }
  } catch (e) {
    console.warn("[enforceParentForType] failed:", e.message)
  }
  return parsed
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

function getProviderConfig(model) {
  // legacy qwen fallback uses tokenrouter
  if (model && model.startsWith("qwen/")) {
    const tokenRouterBase = "https://api.tokenrouter.com/v1/chat/completions"
    const tokenRouterKey = process.env.TOKENROUTER_API_KEY || process.env.NEW_API_KEY || ""
    return { base: tokenRouterBase, provider: "tokenrouter", model, apiKey: tokenRouterKey }
  }
  if (model && model.startsWith("claude-")) {
    return { base: "https://tabitoken.com/v1/chat/completions", provider: "tabitoken", model, apiKey: process.env.TABITOKEN_API_KEY || process.env.NEW_API_KEY || TABI_API_KEY }
  }
  return { base: SEEKAI_BASE, provider: "seekai", model: SEEKAI_MODEL, apiKey: SEEKAI_API_KEY }
}

function createThinkingStripTransform(encoder, metaLine, onFirstChunk) {
  let inThinking = false
  let metaSent = false
  let ollamaBuffer = ""

  function processText(text) {
    let output = ""
    let i = 0

    while (i < text.length) {
      if (inThinking) {
        const endIdx = text.indexOf("</think>", i)
        if (endIdx === -1) {
          break
        }
        inThinking = false
        i = endIdx + "</think>".length
      } else {
        const startIdx = text.indexOf("<think>", i)
        if (startIdx === -1) {
          output += text.slice(i)
          break
        }
        output += text.slice(i, startIdx)
        inThinking = true
        i = startIdx + "<think>".length
      }
    }

    return output
  }

  let chunkCount = 0
  let rawLinesLogged = 0
  return new TransformStream({
    transform(chunk, controller) {
      if (!metaSent) {
        controller.enqueue(encoder.encode(metaLine))
        metaSent = true
        onFirstChunk()
      }

      const raw = ollamaBuffer + new TextDecoder().decode(chunk)
      const lines = raw.split("\n")
      ollamaBuffer = lines.pop() || ""

      for (const line of lines) {
        const data = line.trim()
        if (!data || data === "data: [DONE]") {
          if (data === "data: [DONE]") {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"))
          }
          continue
        }

        const jsonStr = data.startsWith("data: ") ? data.slice(6) : data

        if (rawLinesLogged < 5) {
          rawLinesLogged++
          try {
            const debugParsed = JSON.parse(jsonStr)
            const debugDelta = debugParsed.choices?.[0]?.delta
            console.log(`[stream raw line ${rawLinesLogged}] delta:`, JSON.stringify(debugDelta).slice(0, 300))
          } catch {
            console.log(`[stream raw line ${rawLinesLogged}] parse error, raw:`, jsonStr.slice(0, 300))
          }
        }

        try {
          const parsed = JSON.parse(jsonStr)
          const content = parsed.choices?.[0]?.delta?.content || ""

          if (parsed.choices?.[0]?.finish_reason) {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"))
            continue
          }

          if (content) {
            chunkCount++
            if (chunkCount <= 5) console.log(`[stream content ${chunkCount}]`, content.slice(0, 100))
            const cleaned = processText(content)
            if (!cleaned && !inThinking) continue
            const openaiChunk = { choices: [{ delta: { content: cleaned } }] }
            controller.enqueue(encoder.encode("data: " + JSON.stringify(openaiChunk) + "\n\n"))
          }
        } catch {
          if (rawLinesLogged <= 5) console.log(`[stream parse fail]`, jsonStr.slice(0, 200))
        }
      }
    },

    flush(controller) {
      if (ollamaBuffer) {
        const data = ollamaBuffer.trim()
        if (data) {
          try {
            const jsonStr = data.startsWith("data: ") ? data.slice(6) : data
            const parsed = JSON.parse(jsonStr)
            if (parsed.choices?.[0]?.finish_reason) {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"))
            }
          } catch {}
        }
      }
    },
  })
}

export function callHcnsecStream(system, messages, model, timeoutMs = 120000) {
  const { base, provider, model: actualModel, apiKey } = getProviderConfig(model)
  console.log(`[callHcnsecStream] model: ${actualModel} (${provider}), messages: ${messages.length}`)
  if (!apiKey) {
    const e = new Error("Missing TABITOKEN_API_KEY env var (fallback ORCAROUTER_API_KEY also missing)")
    e.isAuthError = true
    e.status = 500
    return Promise.reject(e)
  }

  const controller = new AbortController()
  const timer      = setTimeout(() => controller.abort(), timeoutMs)

  let origin = ""
  try { origin = new URL(base).origin } catch {}
  const headers = {
    "content-type": "application/json",
    "Accept": "application/json, text/event-stream",
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
    "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="139", "Google Chrome";v="139"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
  }
  if (origin) {
    headers["Origin"] = origin
    headers["Referer"] = origin + "/"
  }
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`

  const fullMessages = []
  if (system) fullMessages.push({ role: "system", content: system })
  for (const m of messages) fullMessages.push({ role: m.role, content: m.content })

  const body = {
    model: actualModel,
    messages: fullMessages,
    stream: true,
    max_tokens: MAX_TOKENS,
    temperature: 0.7,
  }
  console.log(`[callHcnsecStream] POST ${base} model=${actualModel} apiKey=${apiKey ? "SET" : "MISSING"}`)

  const p = fetch(base, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: controller.signal,
  })

  return p.then(res => {
    clearTimeout(timer)
    if (!res.ok) {
      return res.text().then(err => {
        console.error(`[callHcnsecStream] HTTP ${res.status}: ${err}`)
        const e = new Error(`${model} returned ${res.status}: ${err}`)
        e.isRateLimit = res.status === 429
        e.isAuthError = res.status === 401 || res.status === 403
        e.status = res.status
        throw e
      })
    }
    console.log(`[callHcnsecStream] connected — status ${res.status}`)
    const contentType = res.headers.get("content-type") || ""
    console.log(`[callHcnsecStream] content-type: ${contentType}`)
    return { stream: res.body, model, provider }
  }).catch(e => {
    clearTimeout(timer)
    if (e.name === "AbortError") {
      const timeoutErr     = new Error(`${model} timed out after ${timeoutMs}ms`)
      timeoutErr.isTimeout = true
      throw timeoutErr
    }
    console.error(`[callHcnsecStream] fetch error: ${e.message}`)
    throw e
  })
}

export async function runGenerateStream({
  prompt,
  model,
  projectName = "",
  datamodel,
  gameModel,
  history,
}) {
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
  let { system: sys, messages } = buildMessages(system, prompt, cleanHistory)
  messages.unshift({ role: "assistant", content: "{" })

  const requestedModel = model && isValidModel(model) ? model : DEFAULT_MODEL
  const preferred = requestedModel || DEFAULT_MODEL
  const modelOrder = [preferred, ...FALLBACK_ORDER.filter(m => m !== preferred)]

  const encoder = new TextEncoder()
  let metaSent = false

  for (const m of modelOrder) {
    try {
      const { stream, provider } = await callHcnsecStream(sys, messages, m, 120000)
      if (!stream) continue

      const metaLine = "data: " + JSON.stringify({ __model: m, __provider: provider }) + "\n\n"

      const transform = createThinkingStripTransform(encoder, metaLine, () => { if (!metaSent) metaSent = true })

      return { stream: stream.pipeThrough(transform), model: m }
    } catch (e) {
      console.warn(`[runGenerateStream] model ${m} failed:`, e.message)
      continue
    }
  }

  return null
}

async function callHcnsec(system, messages, model, timeoutMs = 120000) {
  const { base, provider, model: actualModel, apiKey } = getProviderConfig(model)
  console.log(`[callHcnsec] model: ${actualModel} (${provider}), messages: ${messages.length}`)
  if (!apiKey) throw Object.assign(new Error("Missing TABITOKEN_API_KEY env var (fallback ORCAROUTER_API_KEY also missing)"), { isAuthError: true, status: 500 })

  const controller = new AbortController()
  const timer      = setTimeout(() => controller.abort(), timeoutMs)

  let origin = ""
  try { origin = new URL(base).origin } catch {}
  const headers = {
    "content-type": "application/json",
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
    "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="139", "Google Chrome";v="139"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
  }
  if (origin) {
    headers["Origin"] = origin
    headers["Referer"] = origin + "/"
  }
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`

  const fullMessages = []
  if (system) fullMessages.push({ role: "system", content: system })
  for (const m of messages) fullMessages.push({ role: m.role, content: m.content })

  const body = {
    model: actualModel,
    messages: fullMessages,
    stream: false,
    max_tokens: MAX_TOKENS,
    temperature: 0.7,
  }

  try {
    const res = await fetch(base, {
      method: "POST",
      headers,
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
    console.log("[callHcnsec] raw response:", JSON.stringify(data).slice(0, 500))
    const rawOutput = data.choices?.[0]?.message?.content || ""
    const reasoning = ""

    const output = stripThinkingTags(rawOutput)

    console.log("[callHcnsec] succeeded — output length:", output.length)
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

async function callWithFallback(system, messages, timeoutMs = 30000, preferredModel) {
  const preferred = preferredModel || DEFAULT_MODEL
  const modelOrder = [preferred, ...FALLBACK_ORDER.filter(m => m !== preferred)]

  let lastError

  for (const model of modelOrder) {
    try {
      console.log(`[callWithFallback] trying "${model}" (${timeoutMs}ms timeout)`)
      const result = await callHcnsec(system, messages, model, timeoutMs)
      if (result.output) {
        if (model !== preferred) {
          console.warn(`[callWithFallback] fell back from "${preferred}" to "${model}"`)
        }
        return { output: result.output, reasoning: result.reasoning, model, fellBack: model !== preferred, provider: getProviderConfig(model).provider }
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
  const text = raw.trim()

  const codeBlockRegex = /```[\s\S]*?\n([\s\S]*?)```/g
  const scripts = []
  let match
  let scriptIndex = 0
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const code = match[1].trim()
    if (code) {
      scriptIndex++
      const isLocal = code.includes("LocalPlayer") || code.includes("StarterPlayer") || code.includes("UserInputService")
      scripts.push({
        name: `Script${scriptIndex > 1 ? scriptIndex : ""}`,
        type: isLocal ? "LocalScript" : "Script",
        parent: "ServerScriptService",
        code,
      })
    }
  }

  if (scripts.length > 0) {
    console.log("[extractJson] constructed generation response from", scripts.length, "code blocks")
    return {
      type: "generation",
      title: "Here is ur Scripts",
      summary: "",
      notes: [],
      warnings: [],
      suggestions: [],
      instances: [],
      deletions: [],
      scripts,
      thoughts: [],
      plan: [],
      thinking_steps: [],
      __repaired: true,
    }
  }

  let cleaned = text
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/```\s*$/m, "")
    .trim()

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const result = JSON.parse(jsonMatch[0])
      console.log("[extractJson] regex match parse succeeded")
      return result
    } catch {}
  }

  try {
    const result = JSON.parse(cleaned)
    console.log("[extractJson] direct parse succeeded")
    return result
  } catch {}

  const start = cleaned.indexOf("{")
  const end   = cleaned.lastIndexOf("}")
  if (start !== -1 && end > start) {
    try {
      const result = JSON.parse(cleaned.slice(start, end + 1))
      console.log("[extractJson] slice parse succeeded")
      return result
    } catch {}
  }

  try {
    const result      = JSON.parse(repairJson(cleaned))
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

export function normaliseResponse(result, model, reasoning = "", fellBack = false, provider = "seekai") {
  result.__model         = model
  result.__provider      = provider
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

const JSON_ONLY_SUFFIX = `\n\nIMPORTANT: Your ENTIRE response must be a single valid JSON object. Start with { and end with }. No text, no markdown, no code fences, no explanation before or after. Just the raw JSON.`

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
  let provider       = getProviderConfig(requestedModel).provider

  try {
    const { output, reasoning, model: pickedModel, fellBack: didFallBack, provider: pickedProvider } =
      await callWithFallback(sys, messages, 120000, requestedModel)
    raw           = output
    usedReasoning = reasoning || ""
    usedModel     = pickedModel
    fellBack      = didFallBack
    provider      = pickedProvider
  } catch (e) {
    console.error("[runGenerate] all models failed:", e)
    return {
      type:              "chat",
      message:           e.isTimeout
        ? "The AI is taking too long to respond. Please try a shorter prompt or try again in a moment."
        : `Generation failed: ${e.message}`,
      __model:           requestedModel,
      __provider:        provider,
      __fallback_used:   false,
    }
  }

  console.log("[runGenerate] raw output:", raw.slice(0, 500))

  let parsed = extractJson(raw)
  console.log("[runGenerate] parsed type:", parsed.type)
  console.log("[runGenerate] parse_failed:", parsed.__parse_failed)

  if (parsed.__parse_failed) {
    console.log("[runGenerate] retrying with stronger JSON instruction...")
    const retrySys = sys + JSON_ONLY_SUFFIX
    const retryMessages = [
      ...messages.filter(m => m.role !== "assistant"),
      { role: "assistant", content: "{" },
    ]
    try {
      const { output: retryOutput } = await callWithFallback(retrySys, retryMessages, 120000, requestedModel)
      let retryParsed = extractJson(retryOutput)
      console.log("[runGenerate] retry parsed type:", retryParsed.type)
      if (!retryParsed.__parse_failed) {
        retryParsed = enforceScanParent(retryParsed, gameModel, prompt)
        retryParsed = enforceParentForType(retryParsed)
        return normaliseResponse(retryParsed, usedModel, usedReasoning, fellBack, provider)
      }
    } catch (retryErr) {
      console.error("[runGenerate] retry failed:", retryErr.message)
    }
  }

  parsed = enforceScanParent(parsed, gameModel, prompt)
  parsed = enforceParentForType(parsed)
  return normaliseResponse(parsed, usedModel, usedReasoning, fellBack, provider)
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

    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) {
        return parsed.slice(0, 6).map(String).filter(s => s.trim())
      }
    } catch {}

    const lines = text.split("\n").map(l => l.replace(/^\d+[\.\)]\s*/, "").trim()).filter(Boolean)
    if (lines.length > 0) {
      return lines.slice(0, 6)
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
      await callWithFallback(sys, messages, 120000, requestedModel)

    const steps = (reasoning || output)
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean)
      .slice(0, 20)

    return {
      type:            "thinking",
      thinking_steps:  steps,
      __model:         usedModel,
      __provider:      getProviderConfig(usedModel).provider,
      __fallback_used: fellBack,
    }
  } catch (e) {
    console.error("[runThinking] all models failed:", e)
    return {
      type:            "thinking",
      thinking_steps:  [],
      __error:         `Thinking pass failed: ${e.message}`,
      __model:         requestedModel,
      __provider:      getProviderConfig(requestedModel).provider,
      __fallback_used: false,
    }
  }
}
