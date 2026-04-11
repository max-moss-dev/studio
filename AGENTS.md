<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Studio

Studio is a web UI for managing AI agents via an OpenClaw Gateway.

## Design

UI designs live in `design/studio.pen` (Pencil format). Screens:
- Agent Manager — agent list + detail panel
- Chat View — conversation interface with agents
- Kanban Board — task board with drag-and-drop

Theme: OneDark color scheme (dark grey, not black). Key colors:
- Background: `#282c34`, Header: `#1e2127`, Surface: `#2c313a`
- Status: online `#98c379`, busy `#e5c07b`, error `#e06c75`, offline `#5c6370`
- Roles: orchestrator `#61afef`, coder `#98c379`, reviewer `#c678dd`, researcher `#e5c07b`

## OpenClaw Gateway

Before working on gateway-related code, read the docs in `docs/`:

- `docs/openclaw-architecture.md` — overall structure, data flow, components
- `docs/openclaw-protocol.md` — WebSocket protocol, handshake, auth
- `docs/openclaw-rpc.md` — available RPC methods (agents, sessions, chat, tasks)
- `docs/openclaw-events.md` — server-pushed events (chat streaming, presence, etc.)
- `docs/openclaw-types.md` — all TypeScript types and message/RPC mappings

## Key source files

- `packages/core/src/types.ts` — type definitions
- `packages/core/src/ws-client.ts` — WebSocket client
- `packages/core/src/gateway-store.ts` — Zustand store (central state)
- `packages/core/src/mock-gateway.ts` — mock mode for development

## Tasks

Active and planned work is tracked in [`TASKS.md`](./TASKS.md).
