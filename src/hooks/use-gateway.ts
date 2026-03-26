"use client"

import { useGatewayStore } from "@/stores/gateway-store"

export function useGateway() {
  const agents = useGatewayStore((s) => s.agents)
  const events = useGatewayStore((s) => s.events)
  const tasks = useGatewayStore((s) => s.tasks)
  const messages = useGatewayStore((s) => s.messages)
  const connected = useGatewayStore((s) => s.connected)
  const mockMode = useGatewayStore((s) => s.mockMode)
  const send = useGatewayStore((s) => s.send)

  return { agents, events, tasks, messages, connected, mockMode, send }
}
