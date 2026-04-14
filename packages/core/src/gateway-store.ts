"use client"

import { create } from "zustand"
import type {
  Agent,
  AgentEvent,
  Task,
  Message,
  GatewayMessage,
  GatewayEvent,
  OpenCodeAgentConfig,
  OpenCodeModelInfo,
  ProviderSource,
  ChatSession,
} from "./types"
import { WsClient } from "./ws-client"
import { uid } from "./mock-data"
import { VIEW_BUILDER_PROMPT } from "./prompts/view-builder"
import { ORCHESTRATOR_AGENT_ID, ORCHESTRATOR_PROMPT } from "./prompts/orchestrator"

// --- Media Tool Proxy ---

export const MEDIA_TOOLS_PROMPT = `
You have access to a Media Knowledge Base. You MUST use it proactively:

1. ALWAYS check the knowledge base FIRST when asked about anything — use media.list and media.read before answering.
2. ALWAYS save important information to the knowledge base — research results, conversation summaries, key decisions, action items.
3. ALWAYS organize files into folders: notes/, research/, tasks/, summaries/, etc.

Tool call format — include a JSON block in your response:

\`\`\`tool
{"tool": "media.list", "params": {"path": ""}}
\`\`\`

\`\`\`tool
{"tool": "media.read", "params": {"path": "notes/research.md"}}
\`\`\`

\`\`\`tool
{"tool": "media.write", "params": {"path": "research/topic.md", "content": "# Topic\\n\\nContent here"}}
\`\`\`

\`\`\`tool
{"tool": "media.delete", "params": {"path": "old-file.md"}}
\`\`\`

Available tools:

Media (knowledge base):
- media.list: List files (optional path for subdirectory)
- media.read: Read a file's content
- media.write: Create or update a file (markdown supported)
- media.delete: Delete a file

Tasks (shared todo list):
- todo.add: Add a task (params: text, category: general|bug|feature|research|urgent|idea, agentName)
- todo.list: List all tasks
- todo.complete: Mark a task done (params: id)

${VIEW_BUILDER_PROMPT}

Studio (app integration):
- create_task: Create a task on the Kanban board (params: title, status: "queue"|"in_progress"|"review"|"done")
- open_view: Open a view/tab in the Studio UI (params: view: "kanban"|"agent-manager"|"chats", title)

\`\`\`tool
{"tool": "create_task", "params": {"title": "Fix login bug", "status": "queue"}}
\`\`\`

\`\`\`tool
{"tool": "open_view", "params": {"view": "kanban", "title": "Task Board"}}
\`\`\`

Plugin system (build native UI views):
- plugin.write: Write a source file into a plugin (params: pluginId, filePath, content)
- plugin.build: Compile and install the plugin — opens it as a new tab (params: pluginId, title?, icon?, type?: "standalone"|"override"|"extension", overrides?: string, slots?: string[])
- plugin.list: List all installed plugins (no params)
- plugin.install-deps: Install npm packages for a plugin (params: pluginId, deps: string[])
- view.clone: Read a built-in view's source code so you can fork/extend it (params: viewId: "chats"|"kanban"|"agent-manager"|"settings")

Plugin authoring rules:
- Import React from "react" — it resolves to the shared Studio React instance (no hooks breakage)
- Import stores from "@studio/store": \`import { useGatewayStore, useTabStore } from "@studio/store"\`
- Import icons from "lucide-react"
- The plugin's default export must be a React component: \`export default function MyView(props) { ... }\`
- Props passed to the component: agents, events, tasks, messages, send, models, opencodeModels
- For "override" plugins set type="override" and overrides="chats" (or other built-in viewId)
- For "extension" plugins set type="extension" and slots=["chats.sidebar"] (or other slot name)
- Available slot names: chats.sidebar, chats.toolbar

\`\`\`tool
{"tool": "plugin.write", "params": {"pluginId": "projects", "filePath": "src/index.tsx", "content": "import React from 'react'\\nexport default function ProjectsView() { return <div>Projects</div> }"}}
\`\`\`

\`\`\`tool
{"tool": "plugin.build", "params": {"pluginId": "projects", "title": "Projects", "icon": "folder"}}
\`\`\`

\`\`\`tool
{"tool": "view.clone", "params": {"viewId": "chats"}}
\`\`\`

Tips:
- Use GFM markdown: tables, task lists (- [ ] / - [x]), code blocks, blockquotes
- Organize media into folders: notes/, research/, tasks/, summaries/
- When you discover action items, add them via todo.add AND create_task
- When completing work, mark tasks done via todo.complete

Do NOT wait for the user to ask you to save — proactively write notes, summaries, and findings. Do NOT answer from memory alone — check the knowledge base first.
Always use the \`\`\`tool code fence format for tool calls.
`.trim()

// Track which agents have received the media tools prompt
const mediaPromptSent = new Set<string>()
// Track pending "thinking" placeholder message IDs, keyed by agentId
const _pendingThinkingByAgent = new Map<string, string>()
// Module-level store set accessor (initialized inside create() call)
let _storeSet: ((fn: (s: GatewayState) => Partial<GatewayState>) => void) | null = null

/**
 * Parse tool call blocks from agent message text.
 * Looks for ```tool\n{...}\n``` blocks.
 */
export function parseToolCalls(text: string): Array<{ tool: string; params: Record<string, unknown> }> {
  const results: Array<{ tool: string; params: Record<string, unknown> }> = []
  const regex = /```tool\s*\n([\s\S]*?)```/g
  let match
  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim())
      if (parsed.tool) {
        results.push({ tool: parsed.tool, params: parsed.params ?? {} })
      }
    } catch {
      // not valid JSON, skip
    }
  }
  return results
}

/**
 * Split raw message text into clean display content and structured tool calls.
 * Called at the STORE level so React components never see raw tool blocks.
 */
export function splitContentAndTools(rawText: string): {
  content: string
  toolCalls: Array<{ name: string; input: unknown }>
  isToolStreaming: boolean
  /** Name of tool currently being streamed (extracted from partial JSON) */
  streamingToolName: string | null
} {
  const toolCalls: Array<{ name: string; input: unknown }> = []
  let isToolStreaming = false
  let streamingToolName: string | null = null

  // Split on tool block openings
  const parts = rawText.split(/```tool\s*\n/)
  let content = parts[0] // text before first tool block

  for (let i = 1; i < parts.length; i++) {
    const closeIdx = parts[i].indexOf("```")
    if (closeIdx >= 0) {
      // Complete tool block — parse it
      const json = parts[i].slice(0, closeIdx).trim()
      try {
        const parsed = JSON.parse(json)
        if (parsed.tool) {
          toolCalls.push({ name: parsed.tool, input: parsed.params ?? {} })
        }
      } catch {
        // Invalid JSON — skip
      }
      // Text after closing ``` goes back to content
      content += parts[i].slice(closeIdx + 3)
    } else {
      // Incomplete tool block — still streaming
      isToolStreaming = true
      // Try to extract tool name from partial JSON: {"tool": "media.list"...
      const nameMatch = parts[i].match(/"tool"\s*:\s*"([^"]+)"/)
      if (nameMatch) {
        streamingToolName = nameMatch[1]
      }
    }
  }

  return { content: content.trim(), toolCalls, isToolStreaming, streamingToolName }
}

// View store accessor — set lazily to avoid circular imports
let _viewStoreRegister: ((view: Record<string, unknown>) => void) | null = null
let _viewStoreGet: ((id: string) => Record<string, unknown> | undefined) | null = null
let _openTab: ((viewId: string, title: string, icon: string, state?: Record<string, unknown>) => void) | null = null

export function setViewStoreAccessors(
  register: (view: Record<string, unknown>) => void,
  getView: (id: string) => Record<string, unknown> | undefined,
  openTab?: (viewId: string, title: string, icon: string, state?: Record<string, unknown>) => void
) {
  _viewStoreRegister = register
  _viewStoreGet = getView
  if (openTab) _openTab = openTab
}

/**
 * Execute a tool call locally and return the result.
 */
export async function executeMediaTool(tool: string, params: Record<string, unknown>): Promise<unknown> {
  // ── Task Management Tools ───────────────────────────────────────────────────

  // task.create — Create a new task on the Kanban board
  if (tool === "task.create" || tool === "create_task") {
    const title = (params.title as string) || "New Task"
    const rawStatus = params.status as string
    const validStatuses = ["queue", "in_progress", "review", "done"]
    const status = (validStatuses.includes(rawStatus) ? rawStatus : "queue") as Task["status"]
    const task: Task = {
      id: uid(),
      title,
      status,
      assigneeId: null,
      tokens: 0,
      duration: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    if (_storeSet) {
      _storeSet((s) => ({ tasks: [...s.tasks, task] }))
    }
    // Auto-open kanban so user can see the new task
    if (_openTab) _openTab("kanban", "Task Board", "layout-list")
    return { ok: true, taskId: task.id, message: `Task "${title}" created on Kanban board` }
  }

  // task.list — Get all tasks and their status
  if (tool === "task.list") {
    const state = useGatewayStore.getState()
    return {
      tasks: state.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        assigneeId: t.assigneeId,
        tokens: t.tokens,
        duration: t.duration,
        createdAt: t.createdAt,
      })),
    }
  }

  // task.update — Update task status
  if (tool === "task.update") {
    const taskId = params.taskId as string
    const updates = params.updates as Record<string, unknown> | undefined

    if (!taskId) {
      return { error: "taskId is required" }
    }

    const state = useGatewayStore.getState()
    const existing = state.tasks.find((t) => t.id === taskId)
    if (!existing) {
      return { error: `Task not found: ${taskId}` }
    }

    const updatedTask: Task = {
      ...existing,
      updatedAt: Date.now(),
    }

    if (updates?.status) {
      const validStatuses = ["queue", "in_progress", "review", "done"]
      const status = updates.status as string
      if (validStatuses.includes(status)) {
        updatedTask.status = status as Task["status"]
      }
    }
    if (updates?.title) {
      updatedTask.title = updates.title as string
    }
    if (updates?.assigneeId !== undefined) {
      updatedTask.assigneeId = updates.assigneeId as string | null
    }
    if (updates?.tokens) {
      updatedTask.tokens = updates.tokens as number
    }
    if (updates?.duration) {
      updatedTask.duration = updates.duration as number
    }

    if (_storeSet) {
      _storeSet((s) => ({
        tasks: s.tasks.map((t) => (t.id === taskId ? updatedTask : t)),
      }))
    }

    return { ok: true, task: updatedTask, message: `Task "${updatedTask.title}" updated` }
  }

  // Handle open_view / view.open — open a tab in the Studio UI
  if (tool === "open_view" || tool === "view.open") {
    const view = (params.view as string) || (params.viewId as string) || "kanban"
    const title = (params.title as string) || view
    const icon = (params.icon as string) || "layout"
    const state = (params.state as Record<string, unknown>) || {}
    if (_openTab) {
      _openTab(view, title, icon, state)
      return { ok: true, message: `Opened "${title}" view` }
    }
    return { error: "Tab opener not available" }
  }

  // Handle view.list — list all views from the client-side view store
  if (tool === "view.list") {
    if (!_viewStoreGet) return { error: "View store not available" }
    // List views by scanning known IDs from localStorage
    try {
      const raw = localStorage.getItem("openclaw-views")
      if (raw) {
        const views = JSON.parse(raw)
        const list = Object.values(views).map((v: unknown) => {
          const view = v as Record<string, unknown>
          return { id: view.id, title: view.title, type: view.type, icon: view.icon }
        })
        return { views: list }
      }
    } catch {
      // ignore
    }
    return { views: [] }
  }

  // Handle view.update — update code in view store (localStorage)
  if (tool === "view.update") {
    const viewId = params.viewId as string
    const code = params.code as string
    if (!viewId || !code) return { error: "viewId and code required" }
    if (!_viewStoreGet || !_viewStoreRegister) return { error: "View store not available" }
    const existing = _viewStoreGet(viewId)
    if (existing?.type === "built-in") return { error: "Cannot edit built-in views. Clone it first." }

    // Update in store — Sandpack views render from code in store, no file writes needed
    const title = (params.title as string) ?? existing?.title ?? viewId
    if (existing) {
      _viewStoreRegister({ ...existing, code, title } as Record<string, unknown>)
    } else {
      _viewStoreRegister({
        id: viewId,
        title,
        icon: "sparkles",
        type: "ai-generated",
        code,
        createdAt: Date.now(),
      })
    }

    // Auto-open the view as a tab so the user can see it immediately
    if (_openTab) {
      _openTab(viewId, title as string, "sparkles")
    }

    return { ok: true, viewId, message: "View updated and opened as a tab. Changes are live." }
  }

  // ── Plugin tools ─────────────────────────────────────────────────────────

  // plugin.write — write a source file into a plugin directory
  if (tool === "plugin.write") {
    const pluginId = params.pluginId as string
    const filePath = (params.filePath as string) || "src/index.tsx"
    const content = params.content as string
    if (!pluginId || !content) return { error: "pluginId and content are required" }

    try {
      const res = await fetch("/api/plugins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "write", pluginId, filePath, content }),
      })
      return await res.json()
    } catch (err) {
      return { error: String(err) }
    }
  }

  // plugin.build — compile plugin via esbuild, then register + open it
  if (tool === "plugin.build") {
    const pluginId = params.pluginId as string
    if (!pluginId) return { error: "pluginId is required" }

    try {
      const res = await fetch("/api/plugins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "build", pluginId }),
      })
      const result = await res.json()
      if (result.error) return result

      // Register plugin in the plugin store and open as a tab
      // The client side handles this via the window.__studioPluginRegister hook
      const manifest: Record<string, unknown> = {
        id: pluginId,
        title: (params.title as string) || pluginId,
        icon: (params.icon as string) || "package",
        type: (params.type as string) || "standalone",
      }
      if (params.overrides) manifest.overrides = params.overrides
      if (params.slots) manifest.slots = params.slots
      if (params.version) manifest.version = params.version
      if (params.description) manifest.description = params.description

      if (typeof window !== "undefined") {
        const g = window as unknown as Record<string, unknown>
        if (typeof g.__studioPluginRegister === "function") {
          const fn = g.__studioPluginRegister as (id: string, manifest: Record<string, unknown>) => void
          fn(pluginId, manifest)
        }
      }

      // Open as a tab only for standalone plugins (not overrides/extensions)
      const pluginType = (params.type as string) || "standalone"
      if (_openTab && pluginType === "standalone") {
        const title = (params.title as string) || pluginId
        _openTab(pluginId, title, (params.icon as string) || "package")
      }

      return { ok: true, pluginId, ...result, message: `Plugin "${pluginId}" built and opened.` }
    } catch (err) {
      return { error: String(err) }
    }
  }

  // plugin.list — list all installed plugins
  if (tool === "plugin.list") {
    try {
      const res = await fetch("/api/plugins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list" }),
      })
      return await res.json()
    } catch (err) {
      return { error: String(err) }
    }
  }

  // plugin.install-deps — install npm packages for a plugin
  if (tool === "plugin.install-deps") {
    const pluginId = params.pluginId as string
    const deps = params.deps as Record<string, string>
    if (!pluginId || !deps) return { error: "pluginId and deps are required" }

    try {
      const res = await fetch("/api/plugins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "install-deps", pluginId, deps }),
      })
      return await res.json()
    } catch (err) {
      return { error: String(err) }
    }
  }

  // view.clone — read built-in view source code so agent can fork it
  if (tool === "view.clone") {
    const viewId = params.viewId as string
    if (!viewId) return { error: "viewId is required" }

    try {
      const res = await fetch("/api/plugins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clone-view", viewId }),
      })
      const data = await res.json() as { source?: string; error?: string; viewId?: string }
      if (data.error) return data

      return {
        ok: true,
        viewId,
        source: data.source,
        message:
          `Source of built-in view "${viewId}" returned. ` +
          `To fork it: plugin.write the code to a new pluginId, then plugin.build.`,
      }
    } catch (err) {
      return { error: String(err) }
    }
  }

  // ── Orchestration tools ──────────────────────────────────────────────────────

  // agent.status — return current state of all agents (excluding orchestrator)
  if (tool === "agent.status") {
    const state = useGatewayStore.getState()
    return {
      agents: state.agents
        .filter((a) => a.id !== ORCHESTRATOR_AGENT_ID)
        .map((a) => ({
          id: a.id,
          name: a.name,
          role: a.role,
          status: a.status,
          currentTask: a.currentTask,
          model: a.model,
          provider: a.provider ?? "openclaw",
        })),
      connected: state.connected,
    }
  }

  // agent.delegate — send a message to another agent on behalf of the orchestrator
  if (tool === "agent.delegate") {
    const agentId = params.agentId as string | undefined
    const agentName = params.agentName as string | undefined
    const message = params.message as string
    const createNewSession = params.createSession as boolean | undefined

    if (!message) return { error: "message is required" }

    const state = useGatewayStore.getState()
    const targetAgent = agentId
      ? state.agents.find((a) => a.id === agentId)
      : state.agents.find((a) => a.name.toLowerCase() === agentName?.toLowerCase())

    if (!targetAgent) {
      return {
        error: `Agent not found: ${agentId ?? agentName}`,
        availableAgents: state.agents
          .filter((a) => a.id !== ORCHESTRATOR_AGENT_ID)
          .map((a) => ({ id: a.id, name: a.name, role: a.role, status: a.status })),
      }
    }

    // Get taskId if provided (for task-agent linking)
    const taskId = params.taskId as string | undefined

    // Get or create a session for the target agent
    let sessionId: string
    if (createNewSession) {
      const title = taskId ? `Task: ${taskId.slice(0, 20)}` : `Delegated: ${message.slice(0, 40)}`
      sessionId = state.createSession(targetAgent.id, title)
    } else {
      const existing = state.sessions
        .filter((s) => s.agentId === targetAgent.id)
        .sort((a, b) => b.updatedAt - a.updatedAt)[0]
      sessionId = existing?.id ?? state.createSession(targetAgent.id)
    }

    // Update task assignee if taskId provided
    if (taskId && _storeSet) {
      _storeSet((s) => ({
        tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, assigneeId: targetAgent.id, status: "in_progress" } : t)),
      }))
    }

    // Add a visible user message to the store so it shows up in ChatsView
    state.addMessage(targetAgent.id, {
      id: uid(),
      agentId: targetAgent.id,
      sessionId,
      role: "user",
      content: taskId
        ? `[Delegated by Orchestrator]\nTask: ${taskId}\n\n${message}`
        : `[Delegated by Orchestrator]\n\n${message}`,
      timestamp: Date.now(),
    })

    // Send to gateway
    state.send({
      type: "agent.message",
      agentId: targetAgent.id,
      sessionId,
      content: message,
    })

    // Auto-open Chats view with this agent
    if (_openTab) {
      _openTab("chats", `Chat: ${targetAgent.name}`, "message-square", {
        agentId: targetAgent.id,
        sessionId,
      })
    }

    return {
      ok: true,
      agentId: targetAgent.id,
      agentName: targetAgent.name,
      sessionId,
      taskId: taskId ?? null,
      message: `Delegated to ${targetAgent.name} (${targetAgent.role})` + (taskId ? ` for task ${taskId}` : ""),
    }
  }

  // chat.open — open the Chats view focused on a specific agent
  if (tool === "chat.open") {
    const agentId = params.agentId as string | undefined
    const agentName = params.agentName as string | undefined
    const sessionId = params.sessionId as string | undefined

    const state = useGatewayStore.getState()
    const targetAgent = agentId
      ? state.agents.find((a) => a.id === agentId)
      : state.agents.find((a) => a.name.toLowerCase() === agentName?.toLowerCase())

    if (!targetAgent) {
      return { error: `Agent not found: ${agentId ?? agentName}` }
    }

    if (_openTab) {
      _openTab("chats", `Chat: ${targetAgent.name}`, "message-square", {
        agentId: targetAgent.id,
        sessionId,
      })
    }

    return { ok: true, agentId: targetAgent.id, agentName: targetAgent.name }
  }

  // ── Media / todo fallback ────────────────────────────────────────────────────

  try {
    const res = await fetch("/api/media/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool, params }),
    })
    return await res.json()
  } catch (err) {
    return { error: String(err) }
  }
}

// --- Streaming throttle ---
// Buffer the latest cumulative text per runId, flush to store at ~50ms intervals.
// Prevents React from re-rendering on every single token (which freezes the UI).
const _streamBuffer = new Map<string, { agentId: string; messageId: string; rawText: string }>()
let _streamFlushScheduled = false
const STREAM_THROTTLE_MS = 150

// Track executed tool calls to avoid duplicate execution
const _executedToolCalls = new Set<string>()
// Idle timer per message — if no new tokens for 3s, mark streaming as done
const _streamIdleTimers = new Map<string, ReturnType<typeof setTimeout>>()
const STREAM_IDLE_TIMEOUT_MS = 3000

function scheduleStreamFlush(set: (fn: (s: GatewayState) => Partial<GatewayState>) => void) {
  if (_streamFlushScheduled) return
  _streamFlushScheduled = true

  setTimeout(() => {
    _streamFlushScheduled = false
    if (_streamBuffer.size === 0) return

    // Take a snapshot and clear
    const entries = Array.from(_streamBuffer.values())
    _streamBuffer.clear()

    set((s) => {
      let messages = s.messages
      for (const { agentId, messageId, rawText } of entries) {
        const { content, toolCalls, isToolStreaming, streamingToolName } = splitContentAndTools(rawText)
        const agentMsgs = messages[agentId] ?? []
        const existing = agentMsgs.find((m) => m.id === messageId)
        const msgData = {
          content,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          isToolStreaming,
          streamingToolName,
          isStreaming: true,
        }

        if (existing) {
          messages = {
            ...messages,
            [agentId]: agentMsgs.map((m) =>
              m.id === messageId ? { ...m, ...msgData } : m
            ),
          }
        } else {
          messages = {
            ...messages,
            [agentId]: [
              ...agentMsgs,
              {
                id: messageId,
                agentId,
                role: "assistant" as const,
                ...msgData,
                timestamp: Date.now(),
              },
            ],
          }
        }

        // Execute complete tool calls immediately (don't wait for chat final)
        if (toolCalls.length > 0 && !isToolStreaming) {
          executeToolCallsFromStream(agentId, messageId, rawText, set)
        }
      }
      return { messages }
    })
  }, STREAM_THROTTLE_MS)
}

/**
 * Execute tool calls found in streamed text. Deduplicates to avoid running same tool twice.
 */
function executeToolCallsFromStream(
  agentId: string,
  messageId: string,
  rawText: string,
  set: (fn: (s: GatewayState) => Partial<GatewayState>) => void
) {
  const toolCalls = parseToolCalls(rawText)
  if (toolCalls.length === 0) return

  for (let i = 0; i < toolCalls.length; i++) {
    const dedupeKey = `${messageId}:${toolCalls[i].tool}:${i}`
    if (_executedToolCalls.has(dedupeKey)) continue
    _executedToolCalls.add(dedupeKey)

    const tc = toolCalls[i]
    ;(async () => {
      const result = await executeMediaTool(tc.tool, tc.params)
      const resultMessage = `Tool ${tc.tool} result:\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``

      set((s) => ({
        messages: {
          ...s.messages,
          [agentId]: [
            ...(s.messages[agentId] ?? []),
            {
              id: uid(),
              agentId,
              role: "tool" as const,
              content: resultMessage,
              timestamp: Date.now(),
            },
          ],
        },
      }))
    })()
  }
}

/**
 * Reset idle timer for a streaming message. If no new tokens arrive for 3s,
 * mark the message as done (handles cases where chat final event never arrives).
 */
function resetStreamIdleTimer(
  messageId: string,
  agentId: string,
  set: (fn: (s: GatewayState) => Partial<GatewayState>) => void
) {
  const existing = _streamIdleTimers.get(messageId)
  if (existing) clearTimeout(existing)

  _streamIdleTimers.set(messageId, setTimeout(() => {
    _streamIdleTimers.delete(messageId)
    // Mark message as no longer streaming
    set((s) => {
      const agentMsgs = s.messages[agentId] ?? []
      return {
        messages: {
          ...s.messages,
          [agentId]: agentMsgs.map((m) =>
            m.id === messageId ? { ...m, isStreaming: false, isToolStreaming: false } : m
          ),
        },
      }
    })
  }, STREAM_IDLE_TIMEOUT_MS))
}

const MAX_EVENTS = 1000

export interface ConnectionError {
  code: string
  message: string
  details?: Record<string, unknown>
}

interface GatewayState {
  // Connection
  url: string
  apiKey: string
  connected: boolean
  connectionError: ConnectionError | null

  // Data
  agents: Agent[]
  events: AgentEvent[]
  tasks: Task[]
  messages: Record<string, Message[]>
  sessions: ChatSession[]

  // Extra data
  models: string[]
  opencodeModels: OpenCodeModelInfo[]
  opencodeSessions: unknown[]
  presence: Record<string, unknown>

  // Actions
  connectGateway: (url: string, apiKey: string) => void
  disconnect: () => void
  clearError: () => void
  send: (msg: GatewayMessage) => void
  sendToGateway: (method: string, params?: Record<string, unknown>) => Promise<unknown>
  addMessage: (agentId: string, message: Message) => void
  clearMessages: (agentId: string) => void
  fetchOpenCodeAgents: (serverUrl: string) => Promise<void>
  createOpenCodeAgent: (serverUrl: string, config: OpenCodeAgentConfig) => Promise<void>
  fetchOpenCodeModels: (serverUrl: string) => Promise<void>
  // Session management
  createSession: (agentId: string, title?: string) => string
  deleteSession: (sessionId: string) => void
  updateSession: (sessionId: string, updates: Partial<ChatSession>) => void
}

let wsClient: WsClient | null = null

function persistConfig(url: string, apiKey: string) {
  try {
    localStorage.setItem(
      "openclaw-gateway-config",
      JSON.stringify({ url, apiKey })
    )
  } catch {
    // localStorage unavailable
  }
}

const MESSAGES_KEY = "openclaw-messages"

function persistMessages(messages: Record<string, Message[]>) {
  try {
    // Keep only last 100 messages per agent to avoid bloating localStorage
    const trimmed: Record<string, Message[]> = {}
    for (const [id, msgs] of Object.entries(messages)) {
      trimmed[id] = msgs.slice(-100)
    }
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(trimmed))
  } catch {
    // ignore
  }
}

function loadPersistedMessages(): Record<string, Message[]> {
  try {
    const raw = localStorage.getItem(MESSAGES_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return {}
}

export function loadPersistedConfig(): {
  url: string
  apiKey: string
} | null {
  try {
    const raw = localStorage.getItem("openclaw-gateway-config")
    if (raw) {
      const parsed = JSON.parse(raw)
      return { url: parsed.url ?? "", apiKey: parsed.apiKey ?? "" }
    }
  } catch {
    // ignore
  }
  return null
}

/**
 * Map an OpenClaw agent entry (from agents.list) to our Agent model.
 * These are configured agents, not historical sessions.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function agentEntryToAgent(entry: any): Agent {
  // Handle model that could be a string or an object
  let modelStr = "unknown"
  const rawModel = entry.model
  if (typeof rawModel === "string") {
    modelStr = rawModel
  } else if (rawModel && typeof rawModel === "object") {
    modelStr = rawModel.primary ?? rawModel.modelID ?? rawModel.id ??
               (rawModel.providerID && rawModel.modelID ? `${rawModel.providerID}/${rawModel.modelID}` : null) ??
               "unknown"
  }

  return {
    id: entry.id ?? entry.agentId ?? uid(),
    name: entry.identity?.name ?? entry.name ?? entry.id,
    status: "offline",
    role: mapSessionRole(entry),
    model: modelStr,
    currentTask: null,
    tokensToday: 0,
    tokensTotal: 0,
    uptime: 0,
    config: entry,
  }
}

/**
 * Map an OpenClaw session to our Agent model.
 * Used for session.created / session.updated events.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sessionToAgent(session: any): Agent {
  // Handle model that could be a string or an object with providerID/modelID
  let modelStr = "unknown"
  const rawModel = session.model ?? session.agent?.model
  if (typeof rawModel === "string") {
    modelStr = rawModel
  } else if (rawModel && typeof rawModel === "object") {
    // Handle {providerID, modelID} or {primary, id, ...} structures
    modelStr = rawModel.primary ?? rawModel.modelID ?? rawModel.id ??
               (rawModel.providerID && rawModel.modelID ? `${rawModel.providerID}/${rawModel.modelID}` : null) ??
               "unknown"
  }

  return {
    id: session.id ?? session.sessionKey ?? uid(),
    name: session.name ?? session.label ?? session.id ?? "Agent",
    status: mapSessionStatus(session.status ?? session.state),
    role: mapSessionRole(session),
    model: modelStr,
    currentTask: session.currentTask ?? session.lastMessage?.content?.slice(0, 80) ?? null,
    tokensToday: session.metrics?.tokensToday ?? session.usage?.tokens ?? 0,
    tokensTotal: session.metrics?.tokensTotal ?? session.usage?.totalTokens ?? 0,
    uptime: session.uptime ?? 0,
    config: session.config ?? session.agent ?? {},
  }
}

function mapSessionStatus(status: string | undefined): Agent["status"] {
  switch (status) {
    case "active":
    case "running":
    case "idle":
      return "online"
    case "busy":
    case "working":
    case "thinking":
      return "busy"
    case "error":
    case "failed":
      return "error"
    case "stopped":
    case "offline":
    case "closed":
    default:
      return "offline"
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSessionRole(session: any): Agent["role"] {
  const role = session.role ?? session.agent?.role ?? session.type ?? ""
  if (role.includes("orchestrat")) return "orchestrator"
  if (role.includes("code") || role.includes("dev")) return "coder"
  if (role.includes("review")) return "reviewer"
  if (role.includes("research")) return "researcher"
  return "custom"
}

function mapOpenCodeMode(mode: string): Agent["role"] {
  switch (mode) {
    case "primary": return "orchestrator"
    case "subagent": return "custom"
    default: return "custom"
  }
}

/**
 * Extract the relevant agent/sender ID from a sessionKey.
 * Format: "agent:{targetAgent}:{sender}" e.g. "agent:main:test"
 * For webchat sessions, the sender part identifies which agent initiated the chat,
 * so we use the 3rd segment if it matches a known agent, otherwise fall back to 2nd.
 */
function extractAgentId(sessionKey: string | undefined): string {
  if (!sessionKey) return "unknown"
  if (sessionKey.startsWith("agent:")) {
    const parts = sessionKey.split(":")
    // parts[1] = target agent (usually "main"), parts[2] = sender/context
    // For webchat: "agent:main:test" → return "test" (the sender)
    // For simple: "agent:main:main" → return "main"
    return parts[2] ?? parts[1] ?? sessionKey
  }
  return sessionKey
}

/**
 * Ensure the Studio orchestrator agent always exists in the agents list.
 * Called after connect (mock or live) and preserved through disconnects.
 */
function ensureOrchestratorAgent() {
  if (!_storeSet) return
  _storeSet((s) => {
    if (s.agents.some((a) => a.id === ORCHESTRATOR_AGENT_ID)) return {}
    return {
      agents: [
        {
          id: ORCHESTRATOR_AGENT_ID,
          name: "Studio",
          status: "online" as const,
          role: "orchestrator" as const,
          model: "claude-sonnet-4-6",
          currentTask: null,
          tokensToday: 0,
          tokensTotal: 0,
          uptime: 0,
          config: { reserved: true },
          provider: undefined,
        },
        ...s.agents,
      ],
    }
  })
}

export const useGatewayStore = create<GatewayState>((set, get) => {
  // Initialize module-level store accessor so executeMediaTool can mutate state
  _storeSet = set
  // Ensure the orchestrator agent exists on every store initialization
  // (deferred to next tick so _storeSet is set first)
  setTimeout(ensureOrchestratorAgent, 0)

  /**
   * Handle events from the mock gateway (our custom protocol).
   */
  function handleMockEvent(event: GatewayEvent) {
    switch (event.type) {
      case "agents.snapshot":
        // Preserve OpenCode agents and the orchestrator agent
        set((s) => ({
          agents: [
            ...s.agents.filter((a) => a.provider === "opencode" || a.id === ORCHESTRATOR_AGENT_ID),
            ...event.agents,
          ],
        }))
        break

      case "agent.updated": {
        set((s) => ({
          agents: s.agents.some((a) => a.id === event.agent.id)
            ? s.agents.map((a) => (a.id === event.agent.id ? event.agent : a))
            : [...s.agents, event.agent],
        }))
        break
      }

      case "agent.removed":
        set((s) => ({
          agents: s.agents.filter((a) => a.id !== event.agentId),
        }))
        break

      case "tasks.snapshot":
        set({ tasks: event.tasks })
        break

      case "task.updated": {
        set((s) => ({
          tasks: s.tasks.some((t) => t.id === event.task.id)
            ? s.tasks.map((t) => (t.id === event.task.id ? event.task : t))
            : [...s.tasks, event.task],
        }))
        break
      }

      case "event":
        set((s) => ({
          events: [...s.events, event.event].slice(-MAX_EVENTS),
        }))
        break

      case "message": {
        const msg = event.message
        set((s) => ({
          messages: {
            ...s.messages,
            [msg.agentId]: [...(s.messages[msg.agentId] ?? []), msg],
          },
        }))
        break
      }

      case "message.stream": {
        set((s) => {
          const agentMsgs = s.messages[event.agentId] ?? []
          const existing = agentMsgs.find((m) => m.id === event.messageId)
          if (existing) {
            return {
              messages: {
                ...s.messages,
                [event.agentId]: agentMsgs.map((m) =>
                  m.id === event.messageId
                    ? { ...m, content: m.content + event.delta, isStreaming: true }
                    : m
                ),
              },
            }
          }
          const newMsg: Message = {
            id: event.messageId,
            agentId: event.agentId,
            role: "assistant",
            content: event.delta,
            isStreaming: true,
            timestamp: Date.now(),
          }
          return {
            messages: {
              ...s.messages,
              [event.agentId]: [...agentMsgs, newMsg],
            },
          }
        })
        break
      }

      case "view.generated": {
        // Register the generated view in the view store
        if (_viewStoreRegister) {
          const viewId = `ai-${event.requestId}`
          _viewStoreRegister({
            id: viewId,
            title: event.title ?? "AI View",
            icon: "sparkles",
            type: "ai-generated",
            code: event.code,
            dependencies: event.dependencies ?? {},
            skill: event.skill ?? "",
            createdAt: Date.now(),
          })
        }
        break
      }

      case "view.generate.error":
        console.error(`[View Generate Error] ${event.requestId}: ${event.error}`)
        break

      case "pong":
        break

      case "message.stream.end": {
        // Mark the streamed message as complete
        const endAgentId = event.agentId
        const endMsgId = (event as { messageId?: string }).messageId
        if (endAgentId && endMsgId) {
          set((s) => {
            const agentMsgs = s.messages[endAgentId] ?? []
            return {
              messages: {
                ...s.messages,
                [endAgentId]: agentMsgs.map((m) =>
                  m.id === endMsgId ? { ...m, isStreaming: false } : m
                ),
              },
            }
          })
        }
        break
      }

      case "error":
        console.error(`[Gateway Error] ${event.code}: ${event.message}`)
        break
    }
  }

  /**
   * Handle a raw frame from the real OpenClaw Gateway WebSocket.
   * Frames follow the OpenClaw protocol: {type:"event", event:"...", payload:{}}
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleGatewayFrame(frame: any) {
    if (!frame || typeof frame !== "object") return

    // Internal signals from WsClient
    if (frame.type === "_connected") {
      set({ connected: true, connectionError: null })
      // Fetch initial data after handshake
      fetchInitialData()
      ensureOrchestratorAgent()
      return
    }
    if (frame.type === "_error") {
      set({ connectionError: frame.error ?? { code: "UNKNOWN", message: "Connection error" } })
      return
    }
    if (frame.type === "_disconnected") {
      set({ connected: false })
      return
    }

    // Real OpenClaw events
    if (frame.type === "event") {
      handleOpenClawEvent(frame.event, frame.payload, frame.seq)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleOpenClawEvent(eventName: string, payload: any, seq?: number) {
    console.log("[Gateway] event:", eventName, payload ? JSON.stringify(payload).slice(0, 200) : "")
    // Map OpenClaw events to our store
    switch (eventName) {
      // Session/presence events
      case "system-presence":
      case "presence": {
        set({ presence: payload ?? {} })

        // Update agent statuses from presence data
        if (payload && typeof payload === "object") {
          set((s) => {
            const updatedAgents = s.agents.map((agent) => {
              const presenceEntry = Object.values(payload).find(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (p: any) => p.sessionKey === agent.id || p.deviceId === agent.id
              )
              if (presenceEntry) {
                return { ...agent, status: "online" as const }
              }
              return agent
            })
            return { agents: updatedAgents }
          })
        }
        break
      }

      case "session.created":
      case "session.updated": {
        if (payload) {
          const agent = sessionToAgent(payload)
          set((s) => ({
            agents: s.agents.some((a) => a.id === agent.id)
              ? s.agents.map((a) => (a.id === agent.id ? agent : a))
              : [...s.agents, agent],
          }))
        }
        break
      }

      case "session.deleted":
      case "session.closed": {
        const sessionId = payload?.id ?? payload?.sessionKey
        if (sessionId) {
          set((s) => ({
            agents: s.agents.filter((a) => a.id !== sessionId),
          }))
        }
        break
      }

      // OpenClaw chat events — the gateway broadcasts event name "chat"
      // with payload: { runId, sessionKey, seq, state, message?, errorMessage? }
      // state is "delta" (streaming), "final" (complete), "error", or "aborted"
      case "chat": {
        if (!payload) break
        // sessionKey format: "agent:main:main" — extract agent ID
        const agentId = extractAgentId(payload.sessionKey)
        const messageId = payload.runId ?? uid()
        const state = payload.state as string

        // On final message: refresh tokens + check for tool calls
        if (state === "final") {
          fetchInitialData()

          // Extract text and check for media tool calls
          const finalMsg = payload.message
          let finalText = ""
          if (finalMsg?.content && Array.isArray(finalMsg.content)) {
            finalText = finalMsg.content
              .filter((c: { type: string }) => c.type === "text")
              .map((c: { text: string }) => c.text ?? "")
              .join("")
          }

          const toolCalls = parseToolCalls(finalText)
          if (toolCalls.length > 0 && agentId) {
            // Execute tool calls locally and send results back
            // Skip already-executed ones (may have been run from agent events)
            ;(async () => {
              const results: string[] = []
              for (let i = 0; i < toolCalls.length; i++) {
                const tc = toolCalls[i]
                const dedupeKey = `${messageId}:${tc.tool}:${i}`
                if (_executedToolCalls.has(dedupeKey)) continue
                _executedToolCalls.add(dedupeKey)

                const result = await executeMediaTool(tc.tool, tc.params)
                results.push(`Tool ${tc.tool} result:\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``)
              }

              if (results.length === 0) return // All already executed

              const resultMessage = `[Tool Results]\n\n${results.join("\n\n")}`

              // Add tool result as a system message in UI
              set((s) => ({
                messages: {
                  ...s.messages,
                  [agentId]: [
                    ...(s.messages[agentId] ?? []),
                    {
                      id: uid(),
                      agentId,
                      role: "tool" as const,
                      content: resultMessage,
                      timestamp: Date.now(),
                    },
                  ],
                },
              }))

              // Send result back to agent so it knows the outcome
              if (wsClient) {
                wsClient.request("chat.send", {
                  sessionKey: agentId,
                  message: resultMessage,
                  idempotencyKey: uid(),
                }).catch((e) => console.error("[Gateway] tool result send failed:", e))
              }
            })()
          }

          // Clear idle timer — chat final is the authoritative end signal
          const idleTimer = _streamIdleTimers.get(messageId)
          if (idleTimer) {
            clearTimeout(idleTimer)
            _streamIdleTimers.delete(messageId)
          }
        }

        if (state === "delta" || state === "final") {
          // Extract text from message.content array: [{ type: "text", text: "..." }]
          const msgObj = payload.message
          let text = ""
          if (msgObj?.content && Array.isArray(msgObj.content)) {
            text = msgObj.content
              .filter((c: { type: string }) => c.type === "text")
              .map((c: { text: string }) => c.text ?? "")
              .join("")
          } else if (typeof msgObj?.content === "string") {
            text = msgObj.content
          } else if (typeof payload.text === "string") {
            // Fallback: some gateway versions use payload.text directly
            text = payload.text
          } else if (typeof payload.content === "string") {
            text = payload.content
          }

          if (agentId && text) {
            // Split into clean content + tool calls at store level
            const { content, toolCalls: parsedTools, isToolStreaming, streamingToolName } = splitContentAndTools(text)
            const isFinal = state === "final"

            // Flush any pending stream buffer for this message on final
            if (isFinal) {
              _streamBuffer.delete(messageId)
            }

            // Resolve thinking placeholder ID (if any) for this agent — remove it atomically
            const thinkingIdToRemove = _pendingThinkingByAgent.get(agentId)
            if (thinkingIdToRemove) _pendingThinkingByAgent.delete(agentId)

            set((s) => {
              let agentMsgs = s.messages[agentId] ?? []
              // Atomically remove thinking placeholder
              if (thinkingIdToRemove) {
                agentMsgs = agentMsgs.filter((m) => m.id !== thinkingIdToRemove)
              }
              const existing = agentMsgs.find((m) => m.id === messageId)
              const msgData = {
                content,
                toolCalls: parsedTools.length > 0 ? parsedTools : undefined,
                isToolStreaming,
                streamingToolName,
                isStreaming: !isFinal,
              }

              if (existing) {
                return {
                  messages: {
                    ...s.messages,
                    [agentId]: agentMsgs.map((m) =>
                      m.id === messageId ? { ...m, ...msgData } : m
                    ),
                  },
                }
              }
              return {
                messages: {
                  ...s.messages,
                  [agentId]: [
                    ...agentMsgs,
                    {
                      id: messageId,
                      agentId,
                      role: "assistant" as const,
                      ...msgData,
                      timestamp: msgObj?.timestamp ?? Date.now(),
                    },
                  ],
                },
              }
            })
          }
        } else if (state === "error" && agentId) {
          const errorText = payload.errorMessage ?? "Agent error"
          set((s) => ({
            messages: {
              ...s.messages,
              [agentId]: [
                ...(s.messages[agentId] ?? []),
                {
                  id: messageId,
                  agentId,
                  role: "assistant" as const,
                  content: `⚠️ ${errorText}`,
                  timestamp: Date.now(),
                },
              ],
            },
          }))
        }
        break
      }

      // Legacy chat / message events (kept for compatibility)
      case "message.received":
      case "chat.message": {
        if (payload) {
          const agentId = extractAgentId(payload.sessionKey) ?? payload.agentId ?? payload.from
          const msg: Message = {
            id: payload.id ?? uid(),
            agentId: agentId ?? "unknown",
            role: payload.role === "user" ? "user" : "assistant",
            content: payload.content ?? payload.text ?? "",
            timestamp: payload.timestamp ? new Date(payload.timestamp).getTime() : Date.now(),
          }
          set((s) => ({
            messages: {
              ...s.messages,
              [msg.agentId]: [...(s.messages[msg.agentId] ?? []), msg],
            },
          }))
        }
        break
      }

      // Legacy streaming tokens (kept for compatibility)
      case "message.chunk":
      case "chat.chunk": {
        if (payload) {
          const agentId = extractAgentId(payload.sessionKey) ?? payload.agentId
          const messageId = payload.messageId ?? payload.id
          const delta = payload.content ?? payload.chunk ?? payload.delta ?? ""
          if (agentId && messageId) {
            set((s) => {
              const agentMsgs = s.messages[agentId] ?? []
              const existing = agentMsgs.find((m) => m.id === messageId)
              if (existing) {
                return {
                  messages: {
                    ...s.messages,
                    [agentId]: agentMsgs.map((m) =>
                      m.id === messageId
                        ? { ...m, content: m.content + delta }
                        : m
                    ),
                  },
                }
              }
              return {
                messages: {
                  ...s.messages,
                  [agentId]: [
                    ...agentMsgs,
                    {
                      id: messageId,
                      agentId,
                      role: "assistant" as const,
                      content: delta,
                      timestamp: Date.now(),
                    },
                  ],
                },
              }
            })
          }
        }
        break
      }

      // Task events
      case "task.created":
      case "task.updated": {
        if (payload) {
          const task: Task = {
            id: payload.id ?? uid(),
            title: payload.title ?? payload.description ?? "",
            status: payload.status ?? "queue",
            assigneeId: payload.assigneeId ?? payload.sessionKey ?? null,
            tokens: payload.tokens ?? 0,
            duration: payload.duration ?? 0,
            createdAt: payload.createdAt ? new Date(payload.createdAt).getTime() : Date.now(),
            updatedAt: payload.updatedAt ? new Date(payload.updatedAt).getTime() : Date.now(),
          }
          set((s) => ({
            tasks: s.tasks.some((t) => t.id === task.id)
              ? s.tasks.map((t) => (t.id === task.id ? task : t))
              : [...s.tasks, task],
          }))
        }
        break
      }

      // Agent status changes
      case "agent.status_changed": {
        if (payload) {
          const agentId = extractAgentId(payload.sessionKey) ?? payload.agentId
          const newStatus = mapSessionStatus(payload.status)
          set((s) => ({
            agents: s.agents.map((a) =>
              a.id === agentId ? { ...a, status: newStatus } : a
            ),
          }))
        }
        break
      }

      // Exec approval events (show as events in the feed)
      case "exec.approval.requested": {
        const evt: AgentEvent = {
          id: uid(),
          agentId: payload?.sessionKey ?? "system",
          type: "tool_call",
          data: { approval: true, command: payload?.command, ...payload },
          timestamp: Date.now(),
        }
        set((s) => ({
          events: [...s.events, evt].slice(-MAX_EVENTS),
        }))
        break
      }

      // Agent streaming events — real-time token-by-token updates
      // Format: { runId, stream: "assistant", data: { text, delta }, sessionKey, seq }
      // Throttled: buffer latest text per runId, flush to store every ~50ms
      case "agent": {
        if (!payload?.data?.text || payload.stream !== "assistant") break
        const agentId = extractAgentId(payload.sessionKey)
        const messageId = payload.runId
        const rawText = payload.data.text as string

        if (agentId && messageId && rawText) {
          // Remove thinking placeholder atomically before buffering first token
          const thinkingId = _pendingThinkingByAgent.get(agentId)
          if (thinkingId) {
            _pendingThinkingByAgent.delete(agentId)
            set((s) => {
              const msgs = (s.messages[agentId] ?? []).filter((m) => m.id !== thinkingId)
              return {
                messages: {
                  ...s.messages,
                  [agentId]: [
                    ...msgs,
                    // seed an empty streaming placeholder so UI shows cursor immediately
                    { id: messageId, agentId, role: "assistant" as const, content: "", isStreaming: true, timestamp: Date.now() },
                  ],
                },
              }
            })
          }
          _streamBuffer.set(messageId, { agentId, messageId, rawText })
          scheduleStreamFlush(set)
          // Reset idle timer — if no new tokens for 3s, auto-finalize
          resetStreamIdleTimer(messageId, agentId, set)
        }
        break
      }

      default: {
        console.log(`[OpenClaw Event] ${eventName}`, payload)
        const evt: AgentEvent = {
          id: uid(),
          agentId: payload?.sessionKey ?? payload?.agentId ?? "system",
          type: "status_change",
          data: { event: eventName, ...payload },
          timestamp: Date.now(),
        }
        set((s) => ({
          events: [...s.events, evt].slice(-MAX_EVENTS),
        }))
      }
    }
  }

  /**
   * After handshake, fetch sessions list and presence to populate the UI.
   */
  async function fetchInitialData() {
    if (!wsClient) return

    try {
      // Fetch configured agents (not historical sessions)
      const agentsRes = await wsClient.request("agents.list", {})
      console.log("[Gateway] agents.list response:", JSON.stringify(agentsRes, null, 2))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const agentEntries = (agentsRes as any)?.agents ?? []
      const agents = agentEntries.map(agentEntryToAgent)
      set((s) => ({
        agents: [...s.agents.filter((a) => a.provider === "opencode"), ...agents]
      }))

      // Fetch sessions and aggregate token usage per agent
      try {
        const sessionsRes = await wsClient.request("sessions.list", {})
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sessions = (sessionsRes as any)?.sessions ?? (sessionsRes as any)?.items ?? []
        // Do NOT overwrite Studio chat sessions with gateway sessions — they are different things.
        // Gateway sessions are used only for token aggregation below.

        // Aggregate token usage from sessions into agents
        // Session key format: "agent:{agentId}:{sender}"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tokensByAgent: Record<string, { input: number; output: number; total: number }> = {}
        for (const s of sessions) {
          const sk = s.key as string ?? ""
          const senderId = extractAgentId(sk)
          if (!tokensByAgent[senderId]) {
            tokensByAgent[senderId] = { input: 0, output: 0, total: 0 }
          }
          tokensByAgent[senderId].input += s.inputTokens ?? 0
          tokensByAgent[senderId].output += s.outputTokens ?? 0
          tokensByAgent[senderId].total += s.totalTokens ?? 0
        }

        set((state) => ({
          agents: state.agents.map((a) => {
            const usage = tokensByAgent[a.id]
            if (usage) {
              return { ...a, tokensToday: usage.output, tokensTotal: usage.input }
            }
            return a
          }),
        }))
      } catch {
        // sessions might not be available
      }

      // Fetch available models
      try {
        const modelsRes = await wsClient.request("models.list", {})
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const modelsData = modelsRes as any
        const models: string[] = (modelsData?.models ?? modelsData?.data ?? []).map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (m: any) => typeof m === "string" ? m : m.id ?? m.name ?? ""
        ).filter(Boolean)
        set({ models })
      } catch {
        // models.list might not be available
      }

      // Presence is received via events (system-presence / presence),
      // no need to poll — the gateway pushes updates.
    } catch (err) {
      console.error("[Gateway] Failed to fetch initial data:", err)
      const errObj = err as Record<string, unknown> | undefined
      const code = errObj?.code as string | undefined
      const details = errObj?.details as Record<string, unknown> | undefined
      if (code || details?.code) {
        set({
          connectionError: {
            code: code ?? (details?.code as string) ?? "FETCH_FAILED",
            message: (errObj?.message as string) ?? "Failed to fetch data from gateway",
            details: details,
          },
        })
      }
    }
  }

  return {
    url: "",
    apiKey: "",
    connected: false,
    mockMode: false,
    connectionError: null,
    agents: [],
    events: [],
    tasks: [],
    messages: {},
    sessions: loadPersistedSessions(),
    presence: {},
    models: [] as string[],
    opencodeModels: [] as OpenCodeModelInfo[],
    opencodeSessions: [],

    clearError() {
      set({ connectionError: null })
    },

    connectGateway(url: string, apiKey: string) {
      // Clean up existing connections
      get().disconnect()

      wsClient = new WsClient()
      wsClient.onMessage(handleGatewayFrame)

      set({ url, apiKey, connectionError: null, messages: loadPersistedMessages() })
      persistConfig(url, apiKey)
      wsClient.connect(url, apiKey)
    },

    disconnect() {
      if (wsClient) {
        wsClient.disconnect()
        wsClient = null
      }
      set((s) => ({
        connected: false,
        connectionError: null,
        // Keep the orchestrator agent so it's always accessible
        agents: s.agents.filter((a) => a.id === ORCHESTRATOR_AGENT_ID),
        events: [],
        tasks: [],
        messages: {},
        // sessions intentionally preserved across disconnect so chat history survives reconnects
        presence: {},
        models: [],
      }))
    },

    /**
     * Send a message using the OpenClaw RPC protocol.
     */
    send(msg: GatewayMessage) {

      if (!wsClient) return

      // Translate our GatewayMessage types to OpenClaw RPC calls
      switch (msg.type) {
        case "agent.message": {
          // Prepend system prompt on first message to each agent
          // Orchestrator gets a richer coordination-focused prompt; others get the standard media tools prompt
          let messageContent = msg.content
          if (!mediaPromptSent.has(msg.agentId)) {
            const systemPrompt = msg.agentId === ORCHESTRATOR_AGENT_ID ? ORCHESTRATOR_PROMPT : MEDIA_TOOLS_PROMPT
            messageContent = `[System: ${systemPrompt}]\n\n${msg.content}`
            mediaPromptSent.add(msg.agentId)
          }

          // Add "Thinking..." placeholder so the user sees immediate feedback
          const thinkingId = uid()
          set((s) => ({
            messages: {
              ...s.messages,
              [msg.agentId]: [
                ...(s.messages[msg.agentId] ?? []),
                {
                  id: thinkingId,
                  agentId: msg.agentId,
                  sessionId: (msg as { sessionId?: string }).sessionId,
                  role: "assistant" as const,
                  content: "",
                  isStreaming: true,
                  timestamp: Date.now(),
                },
              ],
            },
          }))
          _pendingThinkingByAgent.set(msg.agentId, thinkingId)

          wsClient.request("chat.send", {
            sessionKey: msg.agentId,
            message: messageContent,
            idempotencyKey: uid(),
          }).catch((e) => console.error("[Gateway] chat.send failed:", e))
          break
        }

        case "agent.command":
          wsClient.request("sessions.send", {
            key: msg.agentId,
            message: msg.command,
          }).catch((e) => console.error("[Gateway] sessions.send failed:", e))
          break

        case "agent.create": {
          const createMsg = msg as { type: "agent.create"; config: Partial<Agent>; provider?: ProviderSource; opencodeConfig?: OpenCodeAgentConfig }
          if (createMsg.provider === "opencode" && createMsg.opencodeConfig) {
            // Route to OpenCode proxy
            try {
              const providers = typeof window !== "undefined"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ? (JSON.parse(localStorage.getItem("studio-providers") ?? "{}") as any)
                : {}
              const serverUrl = providers?.opencode?.url ?? "http://localhost:4096"
              get().createOpenCodeAgent(serverUrl, createMsg.opencodeConfig).catch((e: unknown) => {
                console.error("[Gateway] OpenCode agent.create failed:", e)
              })
            } catch (e) {
              console.error("[Gateway] OpenCode agent.create failed:", e)
            }
            break
          }

          // OpenClaw: agents.create accepts: workspace (required), name
          const cfg = msg.config ?? {}
          const agentName = cfg.name ?? "agent"
          const params: Record<string, unknown> = {
            workspace: cfg.config?.workspace ?? `~/.openclaw/agents/${agentName.toLowerCase().replace(/\s+/g, "-")}`,
          }

          if (cfg.name) params.name = cfg.name

          wsClient.request("agents.create", params).then(() => {
            fetchInitialData()
          }).catch((e) => {
            const msg = e?.message ?? (typeof e === "object" ? JSON.stringify(e) : String(e))
            console.error("[Gateway] agents.create failed:", msg, e)
          })
          break
        }

        case "agent.delete":
          wsClient.request("agents.delete", {
            agentId: msg.agentId,
          }).then(() => {
            set((s) => ({
              agents: s.agents.filter((a) => a.id !== msg.agentId),
            }))
          }).catch((e) => console.error("[Gateway] agents.delete failed:", e))
          break

        case "task.create":
          wsClient.request("tasks.create", {
            title: msg.title,
            assigneeId: msg.assigneeId,
          }).catch((e) => console.error("[Gateway] tasks.create failed:", e))
          break

        case "task.update":
          wsClient.request("tasks.update", {
            taskId: msg.taskId,
            ...msg.updates,
          }).catch((e) => console.error("[Gateway] tasks.update failed:", e))
          break

        case "view.generate":
          wsClient.request("chat.send", {
            content: msg.prompt,
            metadata: { type: "view-generate", requestId: msg.requestId },
          }).catch((e) => console.error("[Gateway] view.generate failed:", e))
          break

        default:
          // Pass through as generic request
          wsClient.request(msg.type, msg as Record<string, unknown>)
            .catch((e) => console.error(`[Gateway] ${msg.type} failed:`, e))
      }
    },

    /**
     * Direct RPC call to the Gateway (for advanced use).
     */
    async sendToGateway(method: string, params: Record<string, unknown> = {}) {
      if (!wsClient) throw new Error("Not connected")
      return wsClient.request(method, params)
    },

    async fetchOpenCodeAgents(serverUrl: string) {
      try {
        // Fetch global config first to get the default model fallback
        let defaultModel = "unknown"
        try {
          const cfgRes = await fetch("/api/agent/opencode", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-opencode-url": serverUrl },
            body: JSON.stringify({ action: "ping" }),
          })
          if (cfgRes.ok) {
            const cfgData = await cfgRes.json()
            const rawDefault = cfgData?.config?.model
            if (typeof rawDefault === "string" && rawDefault) defaultModel = rawDefault
          }
        } catch { /* ignore — default stays "unknown" */ }

        const res = await fetch("/api/agent/opencode", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-opencode-url": serverUrl },
          body: JSON.stringify({ action: "agents" }),
        })
        if (!res.ok) throw new Error(`Failed to fetch agents: ${res.status}`)
        const data = await res.json()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const agentList = Array.isArray(data) ? data : data.agents ?? data.data ?? []

        // Create a default agent if no agents exist
        let finalAgentList = agentList
        if (agentList.length === 0) {
          // Create a default agent
          const defaultAgent = {
            name: "assistant",
            description: "General purpose coding assistant",
            mode: "primary",
            prompt: "You are a helpful coding assistant.",
          }
          try {
            const createRes = await fetch("/api/agent/opencode", {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-opencode-url": serverUrl },
              body: JSON.stringify({ action: "create-agent", agent: defaultAgent }),
            })
            if (createRes.ok) {
              // Re-fetch to get the newly created agent
              const refetchRes = await fetch("/api/agent/opencode", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-opencode-url": serverUrl },
                body: JSON.stringify({ action: "agents" }),
              })
              if (refetchRes.ok) {
                const refetchData = await refetchRes.json()
                finalAgentList = Array.isArray(refetchData) ? refetchData : refetchData.agents ?? refetchData.data ?? []
              }
            }
          } catch (err) {
            console.error("[Gateway] Failed to create default agent:", err)
          }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const opencodeAgents: Agent[] = finalAgentList.map((a: any) => {
          // Handle model that could be a string or an object; fall back to global default
          let modelStr = defaultModel
          if (typeof a.model === "string" && a.model) {
            modelStr = a.model
          } else if (a.model && typeof a.model === "object") {
            modelStr = a.model.primary ?? a.model.modelID ?? a.model.id ??
                       (a.model.providerID && a.model.modelID ? `${a.model.providerID}/${a.model.modelID}` : null) ??
                       defaultModel
          }

          return {
            id: `opencode-${a.name ?? a.id ?? uid()}`,
            name: a.name ?? a.id ?? "Agent",
            status: ("online" as Agent["status"]),
            role: mapOpenCodeMode(a.mode),
            model: modelStr,
            currentTask: null,
            tokensToday: 0,
            tokensTotal: 0,
            uptime: 0,
            config: a,
            provider: "opencode" as const,
          }
        })

        set((s) => {
          const existing = s.agents.filter((a) => a.provider !== "opencode")
          return { agents: [...existing, ...opencodeAgents] }
        })
      } catch (err) {
        console.error("[Gateway] fetchOpenCodeAgents failed:", err)
      }
    },

    async createOpenCodeAgent(serverUrl: string, config: OpenCodeAgentConfig) {
      try {
        const res = await fetch("/api/agent/opencode", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-opencode-url": serverUrl },
          body: JSON.stringify({ action: "create-agent", agent: config }),
        })
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error ?? `Failed to create agent: ${res.status}`)
        }
        // Re-fetch agents to include the newly created one
        await get().fetchOpenCodeAgents(serverUrl)
      } catch (err) {
        console.error("[Gateway] createOpenCodeAgent failed:", err)
        throw err
      }
    },

    async fetchOpenCodeModels(serverUrl: string) {
      try {
        const res = await fetch("/api/agent/opencode", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-opencode-url": serverUrl },
          body: JSON.stringify({ action: "models" }),
        })
        if (!res.ok) throw new Error(`Failed to fetch models: ${res.status}`)
        const data = await res.json()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const providers = data.providers ?? data.data ?? []
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const defaults = data.default ?? data.defaults ?? {}
        const models: OpenCodeModelInfo[] = []
        for (const p of providers) {
          const pId = p.id ?? p.providerID ?? p.name
          const pModels = p.models ?? p.modelIDs ?? []
          // Handle case where pModels is an object like { providerID, modelIDs: [...] }
          const modelList = Array.isArray(pModels) ? pModels : (pModels.modelIDs ?? [])
          for (const m of modelList) {
            const mId = typeof m === "string" ? m : m.id ?? m.modelID ?? m.name
            models.push({
              providerId: pId,
              modelId: mId,
              label: typeof m === "string" ? `${pId}/${m}` : (m.name ?? mId),
            })
          }
          // Also add the default model for this provider
          const defaultModel = defaults[pId]
          if (defaultModel && !models.some((x) => x.modelId === defaultModel && x.providerId === pId)) {
            models.push({
              providerId: pId,
              modelId: defaultModel,
              label: `${pId}/${defaultModel} (default)`,
            })
          }
        }
        set({ opencodeModels: models })
      } catch (err) {
        console.error("[Gateway] fetchOpenCodeModels failed:", err)
      }
    },

    addMessage(agentId: string, message: Message) {
      set((s) => {
        const msgs = s.messages[agentId] ?? []
        // Avoid duplicates - skip if message with same ID already exists
        if (msgs.some((m) => m.id === message.id)) {
          return s
        }
        return {
          messages: {
            ...s.messages,
            [agentId]: [...msgs, message],
          },
        }
      })
    },

    clearMessages(agentId: string) {
      set((s) => {
        const newMessages = { ...s.messages }
        delete newMessages[agentId]
        persistMessages(newMessages)
        return { messages: newMessages }
      })
    },

    createSession(agentId: string, title?: string) {
      const sessionId = `session-${uid()}`
      const agent = get().agents.find((a) => a.id === agentId)
      const sessionTitle = title ?? `Chat with ${agent?.name ?? "Agent"}`
      const now = Date.now()
      const newSession: ChatSession = {
        id: sessionId,
        agentId,
        title: sessionTitle,
        createdAt: now,
        updatedAt: now,
        messageCount: 0,
      }
      set((s) => ({
        sessions: [newSession, ...s.sessions],
      }))
      return sessionId
    },

    deleteSession(sessionId: string) {
      set((s) => ({
        sessions: s.sessions.filter((sesh) => sesh.id !== sessionId),
      }))
    },

    updateSession(sessionId: string, updates: Partial<ChatSession>) {
      set((s) => ({
        sessions: s.sessions.map((sesh) =>
          sesh.id === sessionId ? { ...sesh, ...updates } : sesh
        ),
      }))
    },
  }
})

// Persist messages on change (debounced)
let _persistTimer: ReturnType<typeof setTimeout> | null = null
useGatewayStore.subscribe((state, prev) => {
  if (state.messages !== prev.messages) {
    if (_persistTimer) clearTimeout(_persistTimer)
    _persistTimer = setTimeout(() => persistMessages(state.messages), 500)
  }
})

// Persist sessions on change
const SESSIONS_KEY = "openclaw-sessions"
let _sessionsPersistTimer: ReturnType<typeof setTimeout> | null = null
useGatewayStore.subscribe((state, prev) => {
  if (state.sessions !== prev.sessions) {
    if (_sessionsPersistTimer) clearTimeout(_sessionsPersistTimer)
    _sessionsPersistTimer = setTimeout(() => {
      try {
        localStorage.setItem(SESSIONS_KEY, JSON.stringify(state.sessions))
      } catch {
        // ignore
      }
    }, 500)
  }
})

// Load persisted sessions on init (if any)
function loadPersistedSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return []
}
