"use client"

import { create } from "zustand"
import type {
  Agent,
  AgentEvent,
  Task,
  Message,
  GatewayMessage,
  GatewayEvent,
} from "./types"
import { WsClient } from "./ws-client"
import { MockGateway } from "./mock-gateway"
import { uid } from "./mock-data"
import { VIEW_BUILDER_PROMPT } from "./prompts/view-builder"

// --- Media Tool Proxy ---

const MEDIA_TOOLS_PROMPT = `
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

Tips:
- Use GFM markdown: tables, task lists (- [ ] / - [x]), code blocks, blockquotes
- Organize media into folders: notes/, research/, tasks/, summaries/
- When you discover action items, add them via todo.add
- When completing work, mark tasks done via todo.complete

Do NOT wait for the user to ask you to save — proactively write notes, summaries, and findings. Do NOT answer from memory alone — check the knowledge base first.
Always use the \`\`\`tool code fence format for tool calls.
`.trim()

// Track which agents have received the media tools prompt
const mediaPromptSent = new Set<string>()

/**
 * Parse tool call blocks from agent message text.
 * Looks for ```tool\n{...}\n``` blocks.
 */
function parseToolCalls(text: string): Array<{ tool: string; params: Record<string, unknown> }> {
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
function splitContentAndTools(rawText: string): {
  content: string
  toolCalls: Array<{ name: string; input: unknown }>
  isToolStreaming: boolean
} {
  const toolCalls: Array<{ name: string; input: unknown }> = []
  let isToolStreaming = false

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
    }
  }

  return { content: content.trim(), toolCalls, isToolStreaming }
}

// View store accessor — set lazily to avoid circular imports
let _viewStoreRegister: ((view: Record<string, unknown>) => void) | null = null
let _viewStoreGet: ((id: string) => Record<string, unknown> | undefined) | null = null

export function setViewStoreAccessors(
  register: (view: Record<string, unknown>) => void,
  getView: (id: string) => Record<string, unknown> | undefined
) {
  _viewStoreRegister = register
  _viewStoreGet = getView
}

/**
 * Execute a tool call locally and return the result.
 */
async function executeMediaTool(tool: string, params: Record<string, unknown>): Promise<unknown> {
  // Handle view.update — update code in view store (localStorage)
  if (tool === "view.update") {
    const viewId = params.viewId as string
    const code = params.code as string
    if (!viewId || !code) return { error: "viewId and code required" }
    if (!_viewStoreGet || !_viewStoreRegister) return { error: "View store not available" }
    const existing = _viewStoreGet(viewId)
    if (existing?.type === "built-in") return { error: "Cannot edit built-in views. Clone it first." }

    // Update in store — Sandpack views render from code in store, no file writes needed
    if (existing) {
      _viewStoreRegister({ ...existing, code } as Record<string, unknown>)
    } else {
      _viewStoreRegister({
        id: viewId,
        title: viewId,
        icon: "sparkles",
        type: "ai-generated",
        code,
        createdAt: Date.now(),
      })
    }
    return { ok: true, viewId, message: "View updated. Changes are live." }
  }

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
  mockMode: boolean
  connectionError: ConnectionError | null

  // Data
  agents: Agent[]
  events: AgentEvent[]
  tasks: Task[]
  messages: Record<string, Message[]>

  // Extra data
  models: string[]
  sessions: unknown[]
  presence: Record<string, unknown>

  // Actions
  connectGateway: (url: string, apiKey: string) => void
  connectMock: () => void
  disconnect: () => void
  clearError: () => void
  send: (msg: GatewayMessage) => void
  sendToGateway: (method: string, params?: Record<string, unknown>) => Promise<unknown>
  addMessage: (agentId: string, message: Message) => void
}

let wsClient: WsClient | null = null
let mockGateway: MockGateway | null = null

function persistConfig(url: string, apiKey: string, mockMode: boolean) {
  try {
    localStorage.setItem(
      "openclaw-gateway-config",
      JSON.stringify({ url, apiKey, mockMode })
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
  mockMode: boolean
} | null {
  try {
    const raw = localStorage.getItem("openclaw-gateway-config")
    if (raw) return JSON.parse(raw)
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
  return {
    id: entry.id ?? entry.agentId ?? uid(),
    name: entry.identity?.name ?? entry.name ?? entry.id,
    status: "offline",
    role: mapSessionRole(entry),
    model: typeof entry.model === "string" ? entry.model : entry.model?.primary ?? entry.model?.id ?? "unknown",
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
  return {
    id: session.id ?? session.sessionKey ?? uid(),
    name: session.name ?? session.label ?? session.id ?? "Agent",
    status: mapSessionStatus(session.status ?? session.state),
    role: mapSessionRole(session),
    model: (typeof session.model === "string" ? session.model : session.model?.primary ?? session.agent?.model?.primary ?? session.model?.id ?? session.agent?.model ?? "unknown") as string,
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

export const useGatewayStore = create<GatewayState>((set, get) => {
  /**
   * Handle events from the mock gateway (our custom protocol).
   */
  function handleMockEvent(event: GatewayEvent) {
    switch (event.type) {
      case "agents.snapshot":
        set({ agents: event.agents })
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
                    ? { ...m, content: m.content + event.delta }
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
      case "message.stream.end":
        break

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
            ;(async () => {
              const results: string[] = []
              for (const tc of toolCalls) {
                const result = await executeMediaTool(tc.tool, tc.params)
                results.push(`Tool ${tc.tool} result:\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``)
              }
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
            const { content, toolCalls: parsedTools, isToolStreaming } = splitContentAndTools(text)

            set((s) => {
              const agentMsgs = s.messages[agentId] ?? []
              const existing = agentMsgs.find((m) => m.id === messageId)
              const msgData = {
                content,
                toolCalls: parsedTools.length > 0 ? parsedTools : undefined,
                isToolStreaming,
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
      case "agent": {
        if (!payload?.data?.text || payload.stream !== "assistant") break
        const agentId = extractAgentId(payload.sessionKey)
        const messageId = payload.runId
        const rawText = payload.data.text as string

        if (agentId && messageId && rawText) {
          // Split text into clean content + structured tool calls at store level
          const { content, toolCalls, isToolStreaming } = splitContentAndTools(rawText)

          set((s) => {
            const agentMsgs = s.messages[agentId] ?? []
            const existing = agentMsgs.find((m) => m.id === messageId)
            const msgData = {
              content,
              toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
              isToolStreaming,
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
                    timestamp: Date.now(),
                  },
                ],
              },
            }
          })
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
      set({ agents })

      // Fetch sessions and aggregate token usage per agent
      try {
        const sessionsRes = await wsClient.request("sessions.list", {})
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sessions = (sessionsRes as any)?.sessions ?? (sessionsRes as any)?.items ?? []
        set({ sessions })

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
    sessions: [],
    presence: {},
    models: [] as string[],

    clearError() {
      set({ connectionError: null })
    },

    connectGateway(url: string, apiKey: string) {
      // Clean up existing connections
      get().disconnect()

      wsClient = new WsClient()
      wsClient.onMessage(handleGatewayFrame)

      set({ url, apiKey, mockMode: false, connectionError: null, messages: loadPersistedMessages() })
      persistConfig(url, apiKey, false)
      wsClient.connect(url, apiKey)
    },

    connectMock() {
      get().disconnect()

      mockGateway = new MockGateway()
      mockGateway.onMessage(handleMockEvent)

      const initialMessages = mockGateway.getMessages()
      set({
        url: "mock://localhost",
        apiKey: "",
        connected: true,
        mockMode: true,
        messages: initialMessages,
      })
      persistConfig("mock://localhost", "", true)
      mockGateway.connect()
    },

    disconnect() {
      if (wsClient) {
        wsClient.disconnect()
        wsClient = null
      }
      if (mockGateway) {
        mockGateway.disconnect()
        mockGateway = null
      }
      set({
        connected: false,
        connectionError: null,
        agents: [],
        events: [],
        tasks: [],
        messages: {},
        sessions: [],
        presence: {},
        models: [],
      })
    },

    /**
     * Send a message using the appropriate protocol.
     * Mock mode uses our custom protocol; live mode translates to OpenClaw RPC.
     */
    send(msg: GatewayMessage) {
      if (get().mockMode && mockGateway) {
        mockGateway.send(msg)
        return
      }

      if (!wsClient) return

      // Translate our GatewayMessage types to OpenClaw RPC calls
      switch (msg.type) {
        case "agent.message": {
          // Prepend media tools prompt on first message to each agent
          let messageContent = msg.content
          if (!mediaPromptSent.has(msg.agentId)) {
            messageContent = `[System: ${MEDIA_TOOLS_PROMPT}]\n\n${msg.content}`
            mediaPromptSent.add(msg.agentId)
          }

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
          // agents.create accepts: workspace (required), name
          const cfg = msg.config ?? {}
          const agentName = cfg.name ?? "agent"
          const params: Record<string, unknown> = {
            workspace: cfg.config?.workspace ?? `~/.openclaw/agents/${agentName.toLowerCase().replace(/\s+/g, "-")}`,
          }

          if (cfg.name) params.name = cfg.name

          wsClient.request("agents.create", params).then(() => {
            // Refetch full agent list to get complete data including model
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

    addMessage(agentId: string, message: Message) {
      set((s) => ({
        messages: {
          ...s.messages,
          [agentId]: [...(s.messages[agentId] ?? []), message],
        },
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
