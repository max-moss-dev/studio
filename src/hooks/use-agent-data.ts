"use client"

import { useGatewayStore } from "@/stores/gateway-store"
import type { Agent, AgentEvent, Task, Message, GatewayMessage } from "@/lib/types"

interface AgentData {
  agents: Agent[]
  events: AgentEvent[]
  tasks: Task[]
  messages: Record<string, Message[]>
  send: (msg: GatewayMessage) => void
}

/**
 * Hook for AI-generated views to access gateway data.
 * Provides stable references via Zustand selectors.
 */
export function useAgentData(): AgentData {
  const agents = useGatewayStore((s) => s.agents)
  const events = useGatewayStore((s) => s.events)
  const tasks = useGatewayStore((s) => s.tasks)
  const messages = useGatewayStore((s) => s.messages)
  const send = useGatewayStore((s) => s.send)

  return { agents, events, tasks, messages, send }
}
