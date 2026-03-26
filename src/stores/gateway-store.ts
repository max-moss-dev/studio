"use client"

import { create } from "zustand"
import type {
  Agent,
  AgentEvent,
  Task,
  Message,
  GatewayMessage,
  GatewayEvent,
} from "@/lib/types"
import { WsClient } from "@/lib/ws-client"
import { MockGateway } from "@/lib/mock-gateway"

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

  // Actions
  connectGateway: (url: string, apiKey: string) => void
  connectMock: () => void
  disconnect: () => void
  send: (msg: GatewayMessage) => void
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

export const useGatewayStore = create<GatewayState>((set, get) => {
  function handleEvent(event: GatewayEvent) {
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
          // New streaming message
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
        // No-op
        break

      case "error":
        console.error(`[Gateway Error] ${event.code}: ${event.message}`)
        break
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

    connectGateway(url: string, apiKey: string) {
      // Clean up existing connections
      get().disconnect()

      wsClient = new WsClient()
      wsClient.onMessage((data) => {
        if (
          data &&
          typeof data === "object" &&
          "type" in (data as Record<string, unknown>)
        ) {
          const typed = data as GatewayEvent | { type: string }
          if (typed.type === "_connected") {
            set({ connected: true })
            wsClient?.send({
              type: "subscribe",
              channels: ["agents", "events", "tasks", "messages"],
            })
            return
          }
          if (typed.type === "_disconnected") {
            set({ connected: false })
            return
          }
          handleEvent(typed as GatewayEvent)
        }
      })

      set({ url, apiKey, mockMode: false })
      persistConfig(url, apiKey, false)
      wsClient.connect(url, apiKey)
    },

    connectMock() {
      get().disconnect()

      mockGateway = new MockGateway()
      mockGateway.onMessage(handleEvent)

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
      })
    },

    send(msg: GatewayMessage) {
      if (get().mockMode && mockGateway) {
        mockGateway.send(msg)
      } else if (wsClient) {
        wsClient.send(msg)
      }
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
