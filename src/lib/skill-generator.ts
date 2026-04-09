/**
 * Auto-generates a skill markdown document from view source code.
 *
 * The skill describes what the view does, what data it uses,
 * what dependencies it has, and how to modify it.
 * This is included in agent prompts when modifying views.
 */

interface SkillContext {
  title: string
  code: string
  dependencies?: Record<string, string>
}

/**
 * Analyze which ViewProps fields are used in the code.
 */
function detectUsedProps(code: string): string[] {
  const props = ["agents", "events", "tasks", "messages", "models"]
  return props.filter((p) => code.includes(p))
}

/**
 * Detect which sub-properties of agents are accessed.
 */
function detectAgentFields(code: string): string[] {
  const fields = [
    "name", "status", "role", "model", "currentTask",
    "tokensToday", "tokensTotal", "uptime", "id", "config",
  ]
  return fields.filter((f) => {
    // Match patterns like: agent.name, a.name, .name, ["name"]
    const regex = new RegExp(`\\.${f}\\b|\\["${f}"\\]`)
    return regex.test(code)
  })
}

/**
 * Detect which task fields are accessed.
 */
function detectTaskFields(code: string): string[] {
  const fields = [
    "title", "status", "assigneeId", "tokens", "duration",
    "createdAt", "updatedAt", "id",
  ]
  return fields.filter((f) => {
    const regex = new RegExp(`\\.${f}\\b|\\["${f}"\\]`)
    return regex.test(code)
  })
}

/**
 * Check if the view calls send().
 */
function usesSend(code: string): boolean {
  return /\bsend\s*\(/.test(code)
}

/**
 * Detect React hooks used.
 */
function detectHooks(code: string): string[] {
  const hooks = [
    "useState", "useEffect", "useMemo", "useCallback",
    "useRef", "useContext", "useReducer",
  ]
  return hooks.filter((h) => code.includes(h))
}

/**
 * Detect imported packages (from import statements).
 */
function detectImports(code: string): string[] {
  const imports: string[] = []
  const regex = /from\s+["']([^"'./][^"']*)["']/g
  let match
  while ((match = regex.exec(code)) !== null) {
    const pkg = match[1]
    // Skip react and bridge imports
    if (pkg === "react" || pkg === "react-dom" || pkg === "./bridge") continue
    imports.push(pkg)
  }
  return [...new Set(imports)]
}

/**
 * Detect JSX component names (capitalized tags).
 */
function detectComponents(code: string): string[] {
  const regex = /<([A-Z][a-zA-Z0-9]*)/g
  const components = new Set<string>()
  let match
  while ((match = regex.exec(code)) !== null) {
    components.add(match[1])
  }
  return [...components]
}

/**
 * Generate a skill markdown document for a view.
 */
export function generateSkill({ title, code, dependencies }: SkillContext): string {
  const usedProps = detectUsedProps(code)
  const agentFields = detectAgentFields(code)
  const taskFields = detectTaskFields(code)
  const sends = usesSend(code)
  const hooks = detectHooks(code)
  const imports = detectImports(code)
  const components = detectComponents(code)

  const lines: string[] = []

  lines.push(`# ${title}`)
  lines.push("")

  // What it shows
  lines.push("## What it shows")
  if (components.length > 0) {
    lines.push(`Uses components: ${components.join(", ")}`)
  }
  if (usedProps.length > 0) {
    lines.push(`Displays data from: ${usedProps.join(", ")}`)
  }
  lines.push("")

  // Data used
  lines.push("## Data used")
  if (usedProps.includes("agents") && agentFields.length > 0) {
    lines.push(`- agents[]: ${agentFields.map((f) => `\`${f}\``).join(", ")}`)
  } else if (usedProps.includes("agents")) {
    lines.push("- agents[]")
  }
  if (usedProps.includes("tasks") && taskFields.length > 0) {
    lines.push(`- tasks[]: ${taskFields.map((f) => `\`${f}\``).join(", ")}`)
  } else if (usedProps.includes("tasks")) {
    lines.push("- tasks[]")
  }
  if (usedProps.includes("events")) {
    lines.push("- events[]")
  }
  if (usedProps.includes("messages")) {
    lines.push("- messages (Record<agentId, Message[]>)")
  }
  if (usedProps.includes("models")) {
    lines.push("- models[]")
  }
  if (sends) {
    lines.push("- send() — sends GatewayMessage to host")
  }
  lines.push("")

  // Dependencies
  if (dependencies && Object.keys(dependencies).length > 0) {
    lines.push("## Dependencies")
    for (const [pkg, version] of Object.entries(dependencies)) {
      lines.push(`- ${pkg} ${version}`)
    }
    lines.push("")
  } else if (imports.length > 0) {
    lines.push("## Imports")
    for (const pkg of imports) {
      lines.push(`- ${pkg}`)
    }
    lines.push("")
  }

  // Hooks used
  if (hooks.length > 0) {
    lines.push("## React hooks")
    lines.push(hooks.join(", "))
    lines.push("")
  }

  // How to modify
  lines.push("## How to modify")
  lines.push("- Import from './bridge': `import { useViewProps, send } from './bridge'`")
  lines.push("- useViewProps() returns: { agents, events, tasks, messages, models }")
  lines.push("- Use any npm package (add to dependencies)")
  lines.push("- Use inline styles or import CSS-in-JS libraries")
  lines.push("- Theme: OneDark (#282c34 bg, #2c313a surface, #abb2bf text)")
  lines.push("")

  return lines.join("\n")
}
