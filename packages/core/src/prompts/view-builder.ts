/**
 * View Builder prompt — instructions for agents on how to create and update
 * native React plugin views with full access to Studio stores.
 */
export const VIEW_BUILDER_PROMPT = `
## Views — Building Native Studio Plugins

You can create and update interactive React views that render natively inside Studio —
with full access to agents, sessions, tasks, and the entire application state.

### Tool

\`\`\`tool
{"tool": "view.update", "params": {"viewId": "my-dashboard", "title": "My Dashboard", "code": "..."}}
\`\`\`

- **viewId**: kebab-case identifier (e.g. "projects", "agent-timeline", "task-stats")
- **title**: human-readable tab title
- **code**: Full React component source (TypeScript + JSX, see below)
- Creating a new viewId registers and opens it immediately. Updating an existing one live-reloads it.
- Built-in views (kanban, chats, etc.) cannot be overwritten — use a new viewId.

### Component Structure

\`\`\`tsx
import { useState, useEffect } from "react"
import { useGatewayStore, useTabStore } from "@studio/store"

export default function MyView() {
  // Full access to Studio state
  const agents = useGatewayStore(s => s.agents)
  const sessions = useGatewayStore(s => s.sessions)
  const tasks = useGatewayStore(s => s.tasks)
  const messages = useGatewayStore(s => s.messages)
  const openTab = useTabStore(s => s.openTab)

  return (
    <div style={{ padding: 20, color: "#abb2bf" }}>
      <h1 style={{ color: "#61afef" }}>My View</h1>
      <p>{agents.length} agents connected</p>
    </div>
  )
}
\`\`\`

### Available Imports

| Module | What you get |
|--------|-------------|
| \`react\` | useState, useEffect, useRef, useMemo, useCallback, etc. |
| \`@studio/store\` | useGatewayStore, useTabStore |
| \`lucide-react\` | All Lucide icons (Bot, Wrench, MessageSquare, etc.) |
| \`./bridge\` | useViewProps(), send() — legacy compat |

### Studio Store API

\`\`\`tsx
import { useGatewayStore, useTabStore } from "@studio/store"

// Read state
const agents = useGatewayStore(s => s.agents)          // Agent[]
const sessions = useGatewayStore(s => s.sessions)      // ChatSession[]
const tasks = useGatewayStore(s => s.tasks)            // Task[]
const messages = useGatewayStore(s => s.messages)      // Record<agentId, Message[]>
const connected = useGatewayStore(s => s.connected)    // boolean

// Actions
const addMessage = useGatewayStore(s => s.addMessage)
const createSession = useGatewayStore(s => s.createSession)
const send = useGatewayStore(s => s.send)

// Tab management
const openTab = useTabStore(s => s.openTab)
// openTab("chats", "Chat with agent", "message-square", { agentId: "xyz" })
// openTab("kanban", "Task Board", "layout-list")
\`\`\`

### Key Types

**Agent**: id, name, status ("online"|"busy"|"offline"|"error"), role, model, currentTask, tokensToday, tokensTotal, provider

**ChatSession**: id, agentId, title, createdAt, updatedAt

**Task**: id, title, status ("queue"|"in_progress"|"review"|"done"), assigneeId, tokens, duration, createdAt, updatedAt

**Message**: id, agentId, sessionId, role ("user"|"assistant"|"tool"), content, timestamp, toolCalls?, isStreaming?

### Styling

Views render in the Studio dark theme. Use inline styles:

\`\`\`tsx
const S = {
  page:    { padding: 20, color: "#abb2bf", fontFamily: "system-ui, sans-serif", height: "100%", overflow: "auto" },
  heading: { color: "#61afef", fontSize: 18, fontWeight: 600, marginBottom: 16 },
  card:    { background: "#2c313a", borderRadius: 8, padding: 16, marginBottom: 8, border: "1px solid #3e4451" },
  badge:   (color: string) => ({ display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 500, background: color + "22", color }),
  btn:     { background: "#61afef22", color: "#61afef", border: "1px solid #61afef44", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 13 },
}

// Status colors
const STATUS = { online: "#98c379", busy: "#e5c07b", error: "#e06c75", offline: "#5c6370" }
// Role colors
const ROLE = { orchestrator: "#61afef", coder: "#98c379", reviewer: "#c678dd", researcher: "#e5c07b" }
\`\`\`

### Sending Actions

\`\`\`tsx
const send = useGatewayStore(s => s.send)

// Chat with an agent
send({ type: "agent.message", agentId: "main", content: "Hello" })

// Create a task
send({ type: "task.create", title: "Fix bug", assigneeId: "coder-1" })
\`\`\`

### Best Practices

1. **Always check empty state** — arrays may be empty on first render
2. **Use optional chaining** — \`agent?.status ?? "offline"\`
3. **One view = one purpose** — keep it focused
4. **Use real data** — never hardcode sample data, always use store
5. **Height 100%** — views fill the tab; set \`height: "100%"\` on root element

---

## Full Plugin System (multi-file, npm deps)

For complex views that need multiple files, npm packages, or built-in view overrides/extensions use the plugin tools instead of view.update.

### Build a standalone plugin

\`\`\`tool
{"tool": "plugin.write", "params": {"pluginId": "projects", "filePath": "src/index.tsx", "content": "import React, { useState } from 'react'\\nimport { useGatewayStore } from '@studio/store'\\n\\nexport default function ProjectsView() {\\n  const agents = useGatewayStore(s => s.agents)\\n  return <div style={{padding:20,color:'#abb2bf'}}>{agents.length} agents</div>\\n}"}}
\`\`\`

\`\`\`tool
{"tool": "plugin.build", "params": {"pluginId": "projects", "title": "Projects", "icon": "folder"}}
\`\`\`

### Override a built-in view (e.g. add Projects filter to Chats)

1. Clone the built-in view source:
\`\`\`tool
{"tool": "view.clone", "params": {"viewId": "chats"}}
\`\`\`
2. Write the modified version and build with type="override":
\`\`\`tool
{"tool": "plugin.build", "params": {"pluginId": "chats-with-projects", "type": "override", "overrides": "chats"}}
\`\`\`

### Inject UI into a built-in view slot

Available slots: \`chats.sidebar\`, \`chats.toolbar\`

\`\`\`tool
{"tool": "plugin.build", "params": {"pluginId": "projects-sidebar", "type": "extension", "slots": ["chats.sidebar"]}}
\`\`\`

### Install npm packages

\`\`\`tool
{"tool": "plugin.install-deps", "params": {"pluginId": "projects", "deps": ["date-fns", "recharts"]}}
\`\`\`
`.trim()
