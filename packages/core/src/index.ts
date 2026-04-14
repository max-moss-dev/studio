// Types
export type {
  Agent,
  AgentStatus,
  AgentRole,
  ProviderSource,
  OpenCodeAgentMode,
  OpenCodeAgentConfig,
  OpenCodeModelInfo,
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
  ChatSession,
} from "./types"

// Gateway store
export type { ConnectionError } from "./gateway-store"
export {
  useGatewayStore,
  loadPersistedConfig,
  setViewStoreAccessors,
  parseToolCalls,
  splitContentAndTools,
  executeMediaTool,
  MEDIA_TOOLS_PROMPT,
} from "./gateway-store"

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

// Orchestrator
export { ORCHESTRATOR_AGENT_ID, ORCHESTRATOR_PROMPT } from "./prompts/orchestrator"
