export interface SecurityIssue {
  severity: "critical" | "high" | "medium" | "low"
  category: string
  line: number
  description: string
  snippet: string
  fix: string
}

export interface PerformanceIssue {
  severity: "critical" | "high" | "medium" | "low"
  category: string
  line: number
  description: string
  snippet: string
  fix: string
}

export interface ScanResult {
  issues: (SecurityIssue | PerformanceIssue)[]
  score: number
  summary: string
}

const SECURITY_PATTERNS: {
  pattern: RegExp
  severity: SecurityIssue["severity"]
  category: string
  description: string
  fix: string
}[] = [
  {
    pattern: /Player\.leaderstats|\.Coins\b|\.Cash\b|\.Money\b|\.Currency\b|\.Gold\b|\.Gems\b|\.Inventory\b.*\[.*\]\s*=/gi,
    severity: "critical",
    category: "client_authoritative_currency",
    description: "Client-authoritative currency or inventory mutation detected. The client should never directly modify currency or inventory values.",
    fix: "Move this logic to a server Script and fire a RemoteEvent to request the change. Validate all inputs on the server.",
  },
  {
    pattern: /\.Health\s*=\s*\d|Humanoid\.Health\s*=[^=]/gi,
    severity: "high",
    category: "client_authoritative_damage",
    description: "Client directly setting Health. Damage and health changes must be validated and applied by the server.",
    fix: "Fire a RemoteEvent to the server with damage context. Server validates and applies health changes.",
  },
  {
    pattern: /game:GetService\(\s*['"]DataStoreService['"]\s*\)|GetDataStore|GetOrderedDataStore/gi,
    severity: "critical",
    category: "client_datastore_access",
    description: "DataStore access detected. DataStores must never be accessed from LocalScripts or client-side code.",
    fix: "Move all DataStore operations to server Scripts. Use RemoteEvents to communicate data between client and server.",
  },
  {
    pattern: /loadstring\s*\(/gi,
    severity: "critical",
    category: "dynamic_code_execution",
    description: "loadstring() detected. This enables arbitrary code execution and is a severe security risk.",
    fix: "Remove loadstring usage. Refactor to use direct function calls or ModuleScripts for shared logic.",
  },
  {
    pattern: /require\s*\(\s*[^'"][^)]*\)/gi,
    severity: "high",
    category: "dynamic_require",
    description: "Dynamic require() with a variable or expression. This can load arbitrary modules and bypass security.",
    fix: "Use static string paths for require() calls, e.g. require(script.ModuleScript).",
  },
  {
    pattern: /RemoteEvent.*:Fire(AllClients|Server)\s*\(/gi,
    severity: "medium",
    category: "unvalidated_remote_fire",
    description: "RemoteEvent fired without visible argument validation. Always validate remote arguments on the receiving end.",
    fix: "Add type and range checks on all RemoteEvent arguments before processing them.",
  },
  {
    pattern: /:FireServer\s*\([^)]*\)/gi,
    severity: "medium",
    category: "client_remote_fire",
    description: "Client firing RemoteEvent. Ensure the server validates all data received from this remote.",
    fix: "Server-side: add input validation for every argument received from this RemoteEvent.",
  },
  {
    pattern: /tick\(\)|os\.time\(\)|os\.clock\(\)/gi,
    severity: "low",
    category: "timing_manipulation",
    description: "Timing function used. Client-reported timestamps can be manipulated and should not be trusted for security decisions.",
    fix: "Use server-side tick() or os.clock() for authoritative timing. Never trust client timestamps for security.",
  },
  {
    pattern: /HttpService.*:RequestAsync|HttpService.*:GetAsync|HttpService.*:PostAsync/gi,
    severity: "medium",
    category: "http_request",
    description: "HTTP request detected. Ensure API keys and sensitive endpoints are not exposed to clients.",
    fix: "Keep HTTP requests on the server. Validate and sanitize all responses. Never expose API keys in client code.",
  },
  {
    pattern: /while\s+true\s+do/gi,
    severity: "medium",
    category: "infinite_loop_remote_spam",
    description: "Infinite loop detected. If this fires RemoteEvents, it could be used for spam or denial-of-service.",
    fix: "Add task.wait() or task.defer() calls inside loops. Rate-limit any remote calls made within loops.",
  },
]

const PERF_PATTERNS: {
  pattern: RegExp
  severity: PerformanceIssue["severity"]
  category: string
  description: string
  fix: string
}[] = [
  {
    pattern: /RunService\.Heartbeat:Connect\s*\(\s*function|Heartbeat:Connect\s*\(\s*\(/gi,
    severity: "high",
    category: "heartbeat_expensive",
    description: "Heartbeat connection with a function. Expensive operations inside Heartbeat will cause frame drops.",
    fix: "Throttle expensive Heartbeat work with a frame counter or delta-time check. Avoid raycasts, part creation, or complex math every frame.",
  },
  {
    pattern: /RunService\.RenderStepped:Connect\s*\(\s*function|RenderStepped:Connect\s*\(\s*\(/gi,
    severity: "high",
    category: "renderstepped_expensive",
    description: "RenderStepped connection. This runs every render frame — keep work minimal.",
    fix: "Move non-visual logic to Heartbeat. Throttle camera updates and avoid allocations inside RenderStepped.",
  },
  {
    pattern: /while\s+true\s+do[\s\S]*?task\.wait\(\s*\d*\s*\)/gi,
    severity: "medium",
    category: "polling_loop",
    description: "Polling loop with task.wait(). This wastes cycles checking something that could use an event.",
    fix: "Replace polling with event-driven patterns: .Changed, .Touched, ChildAdded, etc.",
  },
  {
    pattern: /while\s+wait\(/gi,
    severity: "medium",
    category: "deprecated_polling",
    description: "Deprecated wait() in a polling loop. Use task.wait() and prefer events over polling.",
    fix: "Replace with task.wait() or preferably an event-driven approach.",
  },
  {
    pattern: /:Connect\s*\([\s\S]*?\)(?![\s\S]*?Disconnect)/gi,
    severity: "medium",
    category: "connection_leak",
    description: "Event connection created without visible Disconnect(). This can cause memory leaks.",
    fix: "Store connections in variables and call :Disconnect() when the connection is no longer needed, or use :Once() for single-fire events.",
  },
  {
    pattern: /workspace:Raycast\s*\(|:FindPartOnRay\s*\(|:FindPartOnRayWithWhitelist|:FindPartOnRayWithIgnoreList/gi,
    severity: "medium",
    category: "unthrottled_raycast",
    description: "Raycast detected. Unthrottled raycasts (every frame) are expensive.",
    fix: "Throttle raycasts with a frame counter or distance check. Cache results when possible. Use Workspace:Blockcast() or Spherecast() for shape queries.",
  },
  {
    pattern: /Instance\.new\s*\([^)]+\)/gi,
    severity: "low",
    category: "runtime_instance_creation",
    description: "Instance.new() at runtime. This is slower than cloning pre-made instances.",
    fix: "Clone pre-made instances from ReplicatedStorage or server storage instead of creating new ones at runtime.",
  },
  {
    pattern: /:GetChildren\(\)|:GetDescendants\(\)/gi,
    severity: "low",
    category: "expensive_collection_query",
    description: "GetChildren/GetDescendants called. These allocate new tables every call.",
    fix: "Cache the result if used repeatedly. Use :WaitForChild() for single lookups. Consider FindFirstChild for specific children.",
  },
  {
    pattern: /for\s+\w+\s*,\s*\w+\s+in\s+pairs\s*\(/gi,
    severity: "low",
    category: "pairs_on_sparse",
    description: "pairs() iteration detected. On arrays, ipairs() is faster and respects order.",
    fix: "Use ipairs() for sequential arrays. Reserve pairs() for dictionaries/hashes.",
  },
  {
    pattern: /table\.insert\s*\(\s*\w+\s*,\s*1\s*,/gi,
    severity: "low",
    category: "front_insert_shift",
    description: "table.insert at index 1 shifts all elements. This is O(n) for large tables.",
    fix: "Use table.insert at the end and iterate in reverse, or use a deque/linked list pattern for frequent front insertions.",
  },
]

function linesFromCode(code: string): string[] {
  return code.split("\n")
}

function findLine(lines: string[], match: RegExp): number {
  for (let i = 0; i < lines.length; i++) {
    match.lastIndex = 0
    if (match.test(lines[i])) return i + 1
  }
  return 0
}

interface LegacySecurityResult {
  script: string
  severity: "low" | "medium" | "high" | "critical"
  category: string
  message: string
  line?: number
}

interface LegacyPerformanceResult {
  script: string
  severity: "low" | "medium" | "high" | "critical"
  category: string
  message: string
  line?: number
}

export function scanSecurity(code: string): ScanResult
export function scanSecurity(scripts: { name: string; code: string; type: string }[]): LegacySecurityResult[]
export function scanSecurity(codeOrScripts: string | { name: string; code: string; type: string }[]): ScanResult | LegacySecurityResult[] {
  if (typeof codeOrScripts === "string") {
    return scanSecuritySingle(codeOrScripts)
  }
  return scanSecurityLegacy(codeOrScripts)
}

export function scanPerformance(code: string): ScanResult
export function scanPerformance(scripts: { name: string; code: string; type: string }[]): LegacyPerformanceResult[]
export function scanPerformance(codeOrScripts: string | { name: string; code: string; type: string }[]): ScanResult | LegacyPerformanceResult[] {
  if (typeof codeOrScripts === "string") {
    return scanPerformanceSingle(codeOrScripts)
  }
  return scanPerformanceLegacy(codeOrScripts)
}

function scanSecurityLegacy(scripts: { name: string; code: string; type: string }[]): LegacySecurityResult[] {
  const results: LegacySecurityResult[] = []
  for (const script of scripts) {
    const lines = script.code.split("\n")
    for (const rule of SECURITY_PATTERNS) {
      for (let i = 0; i < lines.length; i++) {
        rule.pattern.lastIndex = 0
        if (rule.pattern.test(lines[i])) {
          results.push({
            script: script.name,
            severity: rule.severity,
            category: rule.category,
            message: rule.description,
            line: i + 1,
          })
        }
      }
    }
  }
  return results
}

function scanPerformanceLegacy(scripts: { name: string; code: string; type: string }[]): LegacyPerformanceResult[] {
  const results: LegacyPerformanceResult[] = []
  for (const script of scripts) {
    const lines = script.code.split("\n")
    for (const rule of PERF_PATTERNS) {
      for (let i = 0; i < lines.length; i++) {
        rule.pattern.lastIndex = 0
        if (rule.pattern.test(lines[i])) {
          results.push({
            script: script.name,
            severity: rule.severity,
            category: rule.category,
            message: rule.description,
            line: i + 1,
          })
        }
      }
    }
  }
  return results
}

function scanSecuritySingle(code: string): ScanResult {
  const lines = linesFromCode(code)
  const issues: SecurityIssue[] = []

  for (const rule of SECURITY_PATTERNS) {
    const lineNum = findLine(lines, rule.pattern)
    if (lineNum > 0) {
      issues.push({
        severity: rule.severity,
        category: rule.category,
        line: lineNum,
        description: rule.description,
        snippet: lines[lineNum - 1]?.trim().slice(0, 120) ?? "",
        fix: rule.fix,
      })
    }
  }

  const criticalCount = issues.filter(i => i.severity === "critical").length
  const highCount = issues.filter(i => i.severity === "high").length
  const mediumCount = issues.filter(i => i.severity === "medium").length

  let score = 100
  score -= criticalCount * 25
  score -= highCount * 15
  score -= mediumCount * 8
  score -= issues.filter(i => i.severity === "low").length * 3
  score = Math.max(0, score)

  const summary = issues.length === 0
    ? "No security issues detected."
    : `${issues.length} issue(s) found: ${criticalCount} critical, ${highCount} high, ${mediumCount} medium.`

  return { issues, score, summary }
}

function scanPerformanceSingle(code: string): ScanResult {
  const lines = linesFromCode(code)
  const issues: PerformanceIssue[] = []

  for (const rule of PERF_PATTERNS) {
    const lineNum = findLine(lines, rule.pattern)
    if (lineNum > 0) {
      issues.push({
        severity: rule.severity,
        category: rule.category,
        line: lineNum,
        description: rule.description,
        snippet: lines[lineNum - 1]?.trim().slice(0, 120) ?? "",
        fix: rule.fix,
      })
    }
  }

  const criticalCount = issues.filter(i => i.severity === "critical").length
  const highCount = issues.filter(i => i.severity === "high").length
  const mediumCount = issues.filter(i => i.severity === "medium").length

  let score = 100
  score -= criticalCount * 20
  score -= highCount * 12
  score -= mediumCount * 6
  score -= issues.filter(i => i.severity === "low").length * 2
  score = Math.max(0, score)

  const summary = issues.length === 0
    ? "No performance issues detected."
    : `${issues.length} issue(s) found: ${criticalCount} critical, ${highCount} high, ${mediumCount} medium.`

  return { issues, score, summary }
}

export function scanAll(code: string): { security: ScanResult; performance: ScanResult } {
  return {
    security: scanSecurity(code),
    performance: scanPerformance(code),
  }
}
