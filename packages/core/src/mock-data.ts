import type { Agent, Task, Message, AgentEvent } from "./types"

let _idCounter = 0
export function uid(): string {
  return `${Date.now().toString(36)}-${(++_idCounter).toString(36)}`
}

// ── Mock Agents ───────────────────────────────────────
export const MOCK_AGENTS: Agent[] = [
  {
    id: "agent-orchestrator",
    name: "Maestro",
    status: "online",
    role: "orchestrator",
    model: "claude-sonnet-4-6",
    currentTask: "Coordinating sprint #14 tasks",
    tokensToday: 45_200,
    tokensTotal: 1_230_000,
    uptime: 86400,
    config: { maxConcurrent: 5, priority: "high" },
  },
  {
    id: "agent-coder-1",
    name: "Atlas",
    status: "busy",
    role: "coder",
    model: "claude-sonnet-4-6",
    currentTask: "Implementing auth middleware",
    tokensToday: 128_400,
    tokensTotal: 3_450_000,
    uptime: 72000,
    config: { language: "typescript", framework: "next.js" },
  },
  {
    id: "agent-coder-2",
    name: "Nova",
    status: "online",
    role: "coder",
    model: "claude-sonnet-4-6",
    currentTask: null,
    tokensToday: 67_300,
    tokensTotal: 2_100_000,
    uptime: 43200,
    config: { language: "python", framework: "fastapi" },
  },
  {
    id: "agent-reviewer",
    name: "Sentinel",
    status: "busy",
    role: "reviewer",
    model: "claude-sonnet-4-6",
    currentTask: "Reviewing PR #142 — API refactor",
    tokensToday: 34_100,
    tokensTotal: 890_000,
    uptime: 86400,
    config: { strictMode: true, autoApprove: false },
  },
  {
    id: "agent-researcher",
    name: "Scout",
    status: "online",
    role: "researcher",
    model: "claude-sonnet-4-6",
    currentTask: "Researching OAuth2 PKCE flow",
    tokensToday: 56_700,
    tokensTotal: 1_670_000,
    uptime: 36000,
    config: { sources: ["docs", "github", "stackoverflow"] },
  },
  {
    id: "agent-coder-3",
    name: "Bolt",
    status: "offline",
    role: "coder",
    model: "claude-haiku-4-5-20251001",
    currentTask: null,
    tokensToday: 0,
    tokensTotal: 560_000,
    uptime: 0,
    config: { language: "rust" },
  },
  {
    id: "agent-custom",
    name: "DocBot",
    status: "error",
    role: "custom",
    model: "claude-haiku-4-5-20251001",
    currentTask: null,
    tokensToday: 12_300,
    tokensTotal: 340_000,
    uptime: 1200,
    config: { type: "documentation", format: "markdown" },
  },
]

// ── Mock Tasks ────────────────────────────────────────
const now = Date.now()

export const MOCK_TASKS: Task[] = [
  {
    id: "task-1",
    title: "Implement auth middleware",
    status: "in_progress",
    assigneeId: "agent-coder-1",
    tokens: 24_500,
    duration: 3600,
    createdAt: now - 7200_000,
    updatedAt: now - 600_000,
  },
  {
    id: "task-2",
    title: "Review API refactor PR #142",
    status: "review",
    assigneeId: "agent-reviewer",
    tokens: 8_200,
    duration: 1800,
    createdAt: now - 5400_000,
    updatedAt: now - 300_000,
  },
  {
    id: "task-3",
    title: "Research OAuth2 PKCE flow",
    status: "in_progress",
    assigneeId: "agent-researcher",
    tokens: 15_600,
    duration: 2400,
    createdAt: now - 3600_000,
    updatedAt: now - 120_000,
  },
  {
    id: "task-4",
    title: "Setup CI/CD pipeline",
    status: "queue",
    assigneeId: null,
    tokens: 0,
    duration: 0,
    createdAt: now - 1800_000,
    updatedAt: now - 1800_000,
  },
  {
    id: "task-5",
    title: "Write unit tests for UserService",
    status: "queue",
    assigneeId: null,
    tokens: 0,
    duration: 0,
    createdAt: now - 900_000,
    updatedAt: now - 900_000,
  },
  {
    id: "task-6",
    title: "Migrate database schema v3",
    status: "done",
    assigneeId: "agent-coder-2",
    tokens: 31_400,
    duration: 5400,
    createdAt: now - 86400_000,
    updatedAt: now - 43200_000,
  },
  {
    id: "task-7",
    title: "Fix CORS headers in gateway",
    status: "done",
    assigneeId: "agent-coder-1",
    tokens: 5_200,
    duration: 900,
    createdAt: now - 172800_000,
    updatedAt: now - 86400_000,
  },
]

// ── Mock Messages ─────────────────────────────────────
export const MOCK_MESSAGES: Record<string, Message[]> = {
  "agent-coder-1": [
    {
      id: "msg-1",
      agentId: "agent-coder-1",
      role: "user",
      content: "Implement JWT-based auth middleware for the API routes.",
      timestamp: now - 3600_000,
    },
    {
      id: "msg-2",
      agentId: "agent-coder-1",
      role: "assistant",
      content:
        "I'll implement the JWT auth middleware. Let me start by examining the current route structure and identifying where to add the middleware.",
      timestamp: now - 3595_000,
    },
    {
      id: "msg-3",
      agentId: "agent-coder-1",
      role: "tool",
      content: "Found 12 API routes in /src/app/api/",
      toolCall: {
        name: "file_search",
        input: { pattern: "src/app/api/**/route.ts" },
        output: "12 files found",
      },
      timestamp: now - 3590_000,
    },
    {
      id: "msg-4",
      agentId: "agent-coder-1",
      role: "assistant",
      content:
        "I've created the middleware at `src/middleware.ts` with JWT verification. It protects all `/api/` routes except `/api/auth/login` and `/api/auth/register`. Want me to add refresh token rotation?",
      timestamp: now - 3500_000,
    },
  ],
  "agent-reviewer": [
    {
      id: "msg-5",
      agentId: "agent-reviewer",
      role: "user",
      content: "Review PR #142 — API refactor",
      timestamp: now - 1800_000,
    },
    {
      id: "msg-6",
      agentId: "agent-reviewer",
      role: "assistant",
      content:
        "Reviewing PR #142. I see 23 files changed with +450/-320 lines. Let me analyze the changes in detail.",
      timestamp: now - 1795_000,
    },
  ],
  "agent-researcher": [
    {
      id: "msg-7",
      agentId: "agent-researcher",
      role: "user",
      content: "Research the best approach for OAuth2 PKCE flow in our Next.js app.",
      timestamp: now - 2400_000,
    },
    {
      id: "msg-8",
      agentId: "agent-researcher",
      role: "assistant",
      content:
        "I'll research OAuth2 PKCE (Proof Key for Code Exchange) implementations suitable for Next.js. This is the recommended flow for public clients (SPAs/mobile apps) as it prevents authorization code interception attacks.",
      timestamp: now - 2395_000,
    },
  ],
}

// ── Mock Events ───────────────────────────────────────
export const MOCK_EVENTS: AgentEvent[] = [
  {
    id: "evt-1",
    agentId: "agent-coder-1",
    type: "task_start",
    data: { taskId: "task-1", title: "Implement auth middleware" },
    timestamp: now - 3600_000,
  },
  {
    id: "evt-2",
    agentId: "agent-reviewer",
    type: "task_start",
    data: { taskId: "task-2", title: "Review API refactor PR #142" },
    timestamp: now - 1800_000,
  },
  {
    id: "evt-3",
    agentId: "agent-coder-1",
    type: "tool_call",
    data: { tool: "file_search", input: { pattern: "src/app/api/**/route.ts" } },
    timestamp: now - 3590_000,
  },
  {
    id: "evt-4",
    agentId: "agent-researcher",
    type: "task_start",
    data: { taskId: "task-3", title: "Research OAuth2 PKCE flow" },
    timestamp: now - 2400_000,
  },
  {
    id: "evt-5",
    agentId: "agent-custom",
    type: "error",
    data: { message: "Rate limit exceeded. Retrying in 30s." },
    timestamp: now - 1200_000,
  },
]

// ── Random Event Generator ────────────────────────────
const RANDOM_TASKS = [
  "Fixing memory leak in worker pool",
  "Optimizing database queries",
  "Writing integration tests",
  "Updating API documentation",
  "Refactoring error handling",
  "Adding request validation",
  "Implementing caching layer",
  "Setting up monitoring alerts",
]

const RANDOM_TOOLS = [
  "file_read",
  "file_write",
  "bash",
  "grep",
  "git_diff",
  "test_run",
]

export function generateRandomEvent(agents: Agent[]): AgentEvent {
  const onlineAgents = agents.filter((a) => a.status !== "offline")
  const agent = onlineAgents[Math.floor(Math.random() * onlineAgents.length)]
  const types: AgentEvent["type"][] = [
    "task_start",
    "task_complete",
    "tool_call",
    "message",
    "status_change",
  ]
  const type = types[Math.floor(Math.random() * types.length)]

  const base = { id: uid(), agentId: agent.id, type, timestamp: Date.now() }

  switch (type) {
    case "task_start":
      return {
        ...base,
        data: { title: RANDOM_TASKS[Math.floor(Math.random() * RANDOM_TASKS.length)] },
      }
    case "task_complete":
      return {
        ...base,
        data: {
          title: RANDOM_TASKS[Math.floor(Math.random() * RANDOM_TASKS.length)],
          tokens: Math.floor(Math.random() * 20000) + 1000,
        },
      }
    case "tool_call":
      return {
        ...base,
        data: { tool: RANDOM_TOOLS[Math.floor(Math.random() * RANDOM_TOOLS.length)] },
      }
    case "message":
      return { ...base, data: { preview: "Processing request..." } }
    case "status_change":
      return {
        ...base,
        data: {
          from: agent.status,
          to: Math.random() > 0.5 ? "busy" : "online",
        },
      }
    default:
      return { ...base, data: {} }
  }
}
