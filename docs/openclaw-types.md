# OpenClaw Type Definitions

All types are defined in `packages/core/src/types.ts`.

## Agent

```typescript
type AgentStatus = "online" | "offline" | "busy" | "error"
type AgentRole = "orchestrator" | "coder" | "reviewer" | "researcher" | "custom"

interface Agent {
  id: string              // Session key or agent ID
  name: string
  status: AgentStatus
  role: AgentRole
  model: string           // e.g. "claude-sonnet-4-6"
  currentTask: string | null
  tokensToday: number
  tokensTotal: number
  uptime: number          // seconds
  config: Record<string, unknown>
}
```

### Status Mapping (from OpenClaw)
| OpenClaw status | Agent status |
|---|---|
| `active`, `running`, `idle` | `online` |
| `busy`, `working`, `thinking` | `busy` |
| `error`, `failed` | `error` |
| `stopped`, `offline`, `closed` | `offline` |

### Role Mapping (from agent config)
| Config contains | Role |
|---|---|
| "orchestrat..." | `orchestrator` |
| "code" or "dev" | `coder` |
| "review" | `reviewer` |
| "research" | `researcher` |
| (other) | `custom` |

## Task

```typescript
type TaskStatus = "queue" | "in_progress" | "review" | "done"

interface Task {
  id: string
  title: string
  status: TaskStatus
  assigneeId: string | null   // Agent ID
  tokens: number
  duration: number            // seconds
  createdAt: number
  updatedAt: number
}
```

## Message

```typescript
interface ToolCall {
  name: string
  input: unknown
  output?: unknown
}

interface Message {
  id: string
  agentId: string             // Session key
  role: "user" | "assistant" | "tool"
  content: string
  toolCall?: ToolCall
  timestamp: number
}
```

## Agent Event

```typescript
type AgentEventType = "task_start" | "task_complete" | "message" | "tool_call" | "error" | "status_change"

interface AgentEvent {
  id: string
  agentId: string
  type: AgentEventType
  data: Record<string, unknown>
  timestamp: number
}
```

## Gateway Messages (Client -> Gateway)

```typescript
type GatewayMessage =
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
```

## Gateway Events (Gateway -> Client)

```typescript
type GatewayEvent =
  | { type: "agents.snapshot"; agents: Agent[] }
  | { type: "agent.updated"; agent: Agent }
  | { type: "agent.removed"; agentId: string }
  | { type: "tasks.snapshot"; tasks: Task[] }
  | { type: "task.updated"; task: Task }
  | { type: "event"; event: AgentEvent }
  | { type: "message"; message: Message }
  | { type: "message.stream"; agentId: string; messageId: string; delta: string }
  | { type: "message.stream.end"; agentId: string; messageId: string }
  | { type: "view.generated"; requestId: string; code: string }
  | { type: "view.generate.error"; requestId: string; error: string }
  | { type: "error"; code: string; message: string }
  | { type: "pong" }
```

## Message → RPC Mapping

The gateway store translates `GatewayMessage` types to OpenClaw RPC calls:

| GatewayMessage type | RPC method |
|---|---|
| `agent.message` | `chat.send` |
| `agent.command` | `sessions.send` |
| `agent.create` | `sessions.create` |
| `agent.delete` | `sessions.delete` |
| `task.create` | `tasks.create` |
| `task.update` | `tasks.update` |
| `view.generate` | `chat.send` (with metadata) |
