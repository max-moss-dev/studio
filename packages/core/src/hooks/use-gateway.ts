"use client"

import { useGatewayStore } from "../gateway-store"

export function useGateway() {
  const agents = useGatewayStore((s) => s.agents)
  const events = useGatewayStore((s) => s.events)
  const tasks = useGatewayStore((s) => s.tasks)
  const messages = useGatewayStore((s) => s.messages)
  const connected = useGatewayStore((s) => s.connected)
  const mockMode = useGatewayStore((s) => s.mockMode)
  const send = useGatewayStore((s) => s.send)
  const models = useGatewayStore((s) => s.models)
  const opencodeModels = useGatewayStore((s) => s.opencodeModels)

  return { agents, events, tasks, messages, connected, mockMode, send, models, opencodeModels }
}
