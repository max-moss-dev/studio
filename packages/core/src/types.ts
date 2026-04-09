// ── Agent ──────────────────────────────────────────────
export type AgentStatus = "online" | "offline" | "busy" | "error"

export type AgentRole =
  | "orchestrator"
  | "coder"
  | "reviewer"
  | "researcher"
  | "custom"

export interface Agent {
  id: string
  name: string
  status: AgentStatus
  role: AgentRole
  model: string
  currentTask: string | null
  tokensToday: number
  tokensTotal: number
  uptime: number // seconds
  config: Record<string, unknown>
}

// ── Events ────────────────────────────────────────────
export type AgentEventType =
  | "task_start"
  | "task_complete"
  | "message"
  | "tool_call"
  | "error"
  | "status_change"

export interface AgentEvent {
  id: string
  agentId: string
  type: AgentEventType
  data: Record<string, unknown>
  timestamp: number
}

// ── Tasks ─────────────────────────────────────────────
export type TaskStatus = "queue" | "in_progress" | "review" | "done"

export interface Task {
  id: string
  title: string
  status: TaskStatus
  assigneeId: string | null
  tokens: number
  duration: number // seconds
  createdAt: number
  updatedAt: number
}

// ── Messages ──────────────────────────────────────────
export interface ToolCall {
  name: string
  input: unknown
  output?: unknown
}

export interface Message {
  id: string
  agentId: string
  role: "user" | "assistant" | "tool"
  content: string
  toolCall?: ToolCall
  timestamp: number
}

// ── Views & Tabs ──────────────────────────────────────
export interface Tab {
  id: string
  viewId: string
  title: string
  icon?: string
  state?: Record<string, unknown>
}

export interface ViewDefinition {
  id: string
  title: string
  icon: string
  type: "built-in" | "ai-generated" | "plugin"
  code?: string // JSX source for AI-generated / plugin views
  dependencies?: Record<string, string> // npm packages, e.g. { "recharts": "^2.8.0" }
  skill?: string // auto-generated agent instructions (markdown)
  createdAt?: number
  // Plugin metadata
  description?: string
  author?: string
  version?: string
  sourceUrl?: string // URL this plugin was installed from
  sourceEntry?: string // entry filename, e.g. "view.tsx"
}

export interface ViewProps {
  agents: Agent[]
  events: AgentEvent[]
  tasks: Task[]
  messages: Record<string, Message[]>
  models: string[]
  send: (msg: GatewayMessage) => void
}

// ── Gateway Protocol ──────────────────────────────────
export type GatewayMessage =
  // Client → Gateway
  | { type: "subscribe"; channels: string[] }
  | { type: "ping" }
  | { type: "agent.command"; agentId: string; command: string }
  | { type: "agent.message"; agentId: string; content: string }
  | { type: "agent.create"; config: Partial<Agent> }
  | { type: "agent.update"; agentId: string; config: Partial<Agent> }
  | { type: "agent.delete"; agentId: string }
  | { type: "task.create"; title: string; assigneeId?: string }
  | { type: "task.update"; taskId: string; updates: Partial<Task> }
  | { type: "view.generate"; prompt: string; requestId: string }

export type GatewayEvent =
  // Gateway → Client
  | { type: "agents.snapshot"; agents: Agent[] }
  | { type: "agent.updated"; agent: Agent }
  | { type: "agent.removed"; agentId: string }
  | { type: "tasks.snapshot"; tasks: Task[] }
  | { type: "task.updated"; task: Task }
  | { type: "event"; event: AgentEvent }
  | { type: "message"; message: Message }
  | { type: "message.stream"; agentId: string; messageId: string; delta: string }
  | { type: "message.stream.end"; agentId: string; messageId: string }
  | { type: "view.generated"; requestId: string; code: string; dependencies?: Record<string, string>; skill?: string; title?: string }
  | { type: "view.generate.error"; requestId: string; error: string }
  | { type: "error"; code: string; message: string }
  | { type: "pong" }
