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

const MAX_EVENTS = 1000

interface GatewayState {
  // Connection
  url: string
  apiKey: string
  connected: boolean
  mockMode: boolean

  // Data
  agents: Agent[]
  events: AgentEvent[]
  tasks: Task[]
  messages: Record<string, Message[]>

  // Raw gateway data (for debugging / future views)
  sessions: unknown[]
  presence: Record<string, unknown>

  // Actions
  connectGateway: (url: string, apiKey: string) => void
  connectMock: () => void
  disconnect: () => void
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
    id: entry.id,
    name: entry.identity?.name ?? entry.name ?? entry.id,
    status: "offline",
    role: mapSessionRole(entry),
    model: entry.model ?? "unknown",
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
    model: session.model ?? session.agent?.model ?? "unknown",
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
      set({ connected: true })
      // Fetch initial data after handshake
      fetchInitialData()
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
        const agentId = payload.sessionKey
        const messageId = payload.runId ?? uid()
        const state = payload.state as string

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
          }

          if (agentId && text) {
            set((s) => {
              const agentMsgs = s.messages[agentId] ?? []
              const existing = agentMsgs.find((m) => m.id === messageId)
              if (existing) {
                // For delta: replace entire content (gateway sends cumulative text)
                // For final: set final content
                return {
                  messages: {
                    ...s.messages,
                    [agentId]: agentMsgs.map((m) =>
                      m.id === messageId ? { ...m, content: text } : m
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
                      content: text,
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
          const agentId = payload.sessionKey ?? payload.agentId ?? payload.from
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
          const agentId = payload.sessionKey ?? payload.agentId
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
          const agentId = payload.sessionKey ?? payload.agentId
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

      default: {
        // Log unknown events for debugging, store as generic events
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const agentEntries = (agentsRes as any)?.agents ?? []
      const agents = agentEntries.map(agentEntryToAgent)
      set({ agents })

      // Fetch sessions for raw data (conversations, not agent list)
      try {
        const sessionsRes = await wsClient.request("sessions.list", {})
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sessions = (sessionsRes as any)?.sessions ?? (sessionsRes as any)?.items ?? []
        set({ sessions })
      } catch {
        // sessions might not be available
      }

      // Fetch presence
      try {
        const presenceRes = await wsClient.request("system.presence", {})
        set({ presence: (presenceRes ?? {}) as Record<string, unknown> })
      } catch {
        // presence might not be available
      }
    } catch (err) {
      console.error("[Gateway] Failed to fetch initial data:", err)
    }
  }

  return {
    url: "",
    apiKey: "",
    connected: false,
    mockMode: false,
    agents: [],
    events: [],
    tasks: [],
    messages: {},
    sessions: [],
    presence: {},

    connectGateway(url: string, apiKey: string) {
      // Clean up existing connections
      get().disconnect()

      wsClient = new WsClient()
      wsClient.onMessage(handleGatewayFrame)

      set({ url, apiKey, mockMode: false })
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
        agents: [],
        events: [],
        tasks: [],
        messages: {},
        sessions: [],
        presence: {},
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
        case "agent.message":
          wsClient.request("chat.send", {
            sessionKey: msg.agentId,
            message: msg.content,
            idempotencyKey: uid(),
          }).catch((e) => console.error("[Gateway] chat.send failed:", e))
          break

        case "agent.command":
          wsClient.request("sessions.send", {
            sessionKey: msg.agentId,
            command: msg.command,
          }).catch((e) => console.error("[Gateway] sessions.send failed:", e))
          break

        case "agent.create":
          wsClient.request("sessions.create", {
            ...msg.config,
          }).catch((e) => console.error("[Gateway] sessions.create failed:", e))
          break

        case "agent.delete":
          wsClient.request("sessions.delete", {
            sessionKey: msg.agentId,
          }).catch((e) => console.error("[Gateway] sessions.delete failed:", e))
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
