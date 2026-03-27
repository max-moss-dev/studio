// Types
export type {
  Agent,
  AgentStatus,
  AgentRole,
  AgentEvent,
  AgentEventType,
  Task,
  TaskStatus,
  Message,
  ToolCall,
  Tab,
  ViewDefinition,
  ViewProps,
  GatewayMessage,
  GatewayEvent,
} from "./types"

// Gateway store
export { useGatewayStore, loadPersistedConfig } from "./gateway-store"

// WebSocket client
export { WsClient } from "./ws-client"

// Mock gateway (for development)
export { MockGateway } from "./mock-gateway"
export {
  MOCK_AGENTS,
  MOCK_TASKS,
  MOCK_MESSAGES,
  MOCK_EVENTS,
  generateRandomEvent,
  uid,
} from "./mock-data"

// Hooks
export { useGateway } from "./hooks/use-gateway"
export { useAgentData } from "./hooks/use-agent-data"
