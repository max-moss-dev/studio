# OpenClaw Hub Architecture

## Overview

OpenClaw Hub is a Next.js web application for managing AI agents via an OpenClaw Gateway. It provides real-time agent monitoring, chat, task management, and extensible views.

## Data Flow

```
┌───────────────────────────────────────────────────┐
│               OpenClaw Hub (Browser)              │
│                                                   │
│  Views (Agent Manager, Chats, Kanban, Office)     │
│       │                                           │
│       │ useGateway() / useAgentData()             │
│       ▼                                           │
│  Gateway Store (Zustand)                          │
│  - agents[], tasks[], messages{}, events[]        │
│  - connected, mockMode                            │
│       │                                           │
│       ├── connectGateway() ──► WsClient           │
│       │                        (WebSocket)        │
│       │                            │              │
│       └── connectMock() ───► MockGateway          │
│                                (in-memory)        │
└────────────────────────────────┼───────────────────┘
                                 │
                                 ▼
                        OpenClaw Gateway Server
                        (ws://localhost:18789)
```

## Key Components

### Core Package (`packages/core/`)

| File | Purpose |
|---|---|
| `types.ts` | All TypeScript types (Agent, Task, Message, protocol) |
| `ws-client.ts` | WebSocket client implementing OpenClaw protocol |
| `gateway-store.ts` | Zustand store — central state + connection logic |
| `mock-gateway.ts` | In-memory mock for development |
| `mock-data.ts` | Sample agents, tasks, messages |
| `hooks/use-gateway.ts` | React hook for views to access gateway state |
| `hooks/use-agent-data.ts` | Hook for AI-generated views |

### App (`src/`)

| File | Purpose |
|---|---|
| `components/app-shell.tsx` | Root component, auto-connects on mount |
| `components/header.tsx` | Connection status, agent count |
| `components/connection-dialog.tsx` | UI for entering gateway URL & API key |
| `stores/tab-store.ts` | Tab/view management, persisted |
| `stores/view-store.ts` | View registry (built-in + plugin) |

### Built-in Views

| View | Path | Features |
|---|---|---|
| Agent Manager | `views/agent-manager/` | List, create, restart, delete agents |
| Chats | `views/chats/` | Conversation interface with streaming |
| Kanban | `views/kanban/` | Task board with drag-and-drop |
| Office | `views/office/` | 3D agent visualization (Pixi.js) |

## Connection Modes

### Live Mode
Connects to a real OpenClaw Gateway via WebSocket. Requires:
- Gateway URL (default: `ws://localhost:18789`)
- API key (`OPENCLAW_GATEWAY_TOKEN`)

### Mock Mode
Uses `MockGateway` — an in-memory simulation with:
- 7 pre-configured agents
- Simulated status transitions (3-8s intervals)
- Delayed mock responses to messages
- Full task management

## Persistence

| Key | Storage | Content |
|---|---|---|
| `openclaw-gateway-config` | localStorage | `{ url, apiKey, mockMode }` |
| `openclaw-device-token` | localStorage | Device token from gateway |
| `openclaw-tabs` | localStorage | Open tabs state |

## Session vs Agent

- **Agent** — a configured AI agent entry from `agents.list`
- **Session** — an active conversation/connection with an agent from `sessions.list`

The store maps both to the `Agent` type for UI consistency. The `id` field on an `Agent` object may be either a session key or an agent entry ID depending on context.
