# Studio — Tasks

Track ongoing and planned work across the Studio project.

## In Progress

- [ ] Global Orchestrator Sidebar — test full flow end-to-end
  - agent.status, agent.delegate, chat.open tool calls
  - Mock streaming responses
  - Sidebar persistence across view switches
- Build logs view etc, so orckestator has instant access to the error logs happening in the app, can we put browser console logs there?

## Backlog — Plugin System
- [ ] Test full plugin flow: agent writes plugin → plugin.build → renders natively with store access

## Backlog
- Запамятати дані входу в openclaw gateway для натсупних разів
- Помилка канбан view при створенні таску (tasks.create — INVALID_REQUEST unknown method)
- При перезавантаженні сторінки, потрібен час на завантадження всіх вкладок
- Agent edit/update UI (configure model, role, workspace after creation)

## Completed (this session)

- [x] MCP App Factory — app workspaces with global Studio MCP tools and per-app MCP endpoints for AI read/write access

- [x] OpenCode chat responses are clean text (fixed raw JSON display — extractText() reads parts array)
- [x] Per-agent OpenCode sessions — Map<agentId, sessionId> replaces single shared ref
- [x] Studio tools system prompt injected on first message to OpenCode agents
- [x] create_task tool — creates task on Kanban board + auto-opens Task Board tab
- [x] open_view tool — opens any Studio view as a tab
- [x] Tool call UI — wrench icon + collapsible "Tool result" blocks in chat
- [x] OpenClaw WebSocket streaming — Thinking placeholder, token streaming, final message
- [x] Session persistence fix — disconnect no longer wipes localStorage sessions
- [x] fetchInitialData no longer overwrites Studio sessions with gateway sessions
- [x] OpenCode agent model display fixed — uses global config default as fallback for agents without explicit model

- [x] Provider-aware agent creation — Agent Manager now supports both OpenClaw and OpenCode
- [x] Added `ProviderSource`, `OpenCodeAgentConfig`, `OpenCodeModelInfo` types
- [x] Extended `Agent.provider` field to track which gateway an agent comes from
- [x] OpenCode proxy: added `agents`, `create-agent`, `models` actions to `/api/agent/opencode`
- [x] Gateway store: added `fetchOpenCodeAgents`, `createOpenCodeAgent`, `fetchOpenCodeModels`, `opencodeModels` state
- [x] Agent Manager rewrite: provider picker dialog, dual creation forms (OpenClaw + OpenCode), provider badges/filters
- [x] Auto-fetch OpenCode agents + models in app-shell on connect

- [x] Chrome-style tabs — shrink instead of scroll, no horizontal scrollbar
- [x] Chat scroll — instant jump to bottom on open, smooth scroll on new messages only
- [x] Styled scrollbar — thin 6px, theme-colored, across entire app
- [x] User messages right-aligned with background bubble to differentiate from assistant
- [x] Chat remembers last active agent (persisted to localStorage)
- [x] Fix scroll-to-bottom on chat open — only scrolls on NEW messages, not initial load
- [x] Hide tab bar horizontal scrollbar (scrollbar-none CSS utility)
- [x] Create `/api/media/mcp` route for media/todo tool calls (was missing, all tool calls failed)
- [x] Add `view.list` client-side handler and `streamingToolName` for tool call visibility
- [x] Show "Calling media.list..." / "Thinking..." instead of generic "Generating..."
- [x] Fix streaming — MarkdownRenderer `localContent` state never synced with `content` prop
- [x] Throttle `agent` streaming events (50ms buffer) to prevent React re-render storms
- [x] Use plain text during streaming, full markdown on completion
- [x] Memoize MarkdownRenderer and MessageRow components
- [x] Add `isStreaming` flag to Message type for streaming cursor indicator
- [x] Add streaming simulation to mock gateway (was instant before)
- [x] Mark streaming complete on `message.stream.end` and `chat` final events
- [x] Fix hooks crash in ActiveView (useRef/useCallback after early returns)
- [x] Handle `event: "agent"` streaming events (was only handling `event: "chat"`)
- [x] Move tool call parsing from render to store level (`splitContentAndTools`)
- [x] Add error capture in Sandpack iframe (ViewErrorBoundary, window.onerror)
- [x] Feed iframe errors back to agent via chat
- [x] Extract view builder prompt to `packages/core/src/prompts/view-builder.ts`
- [x] Redesign chat — no avatars, minimal style, clean tool call indicators
- [x] Add streaming test (`packages/core/src/__tests__/streaming.test.ts`)
- [x] Install Playwright MCP for browser testing

- [x] Global Orchestrator Sidebar (feat/plugin-system branch)
  - [x] `packages/core/src/prompts/orchestrator.ts` — ORCHESTRATOR_AGENT_ID + ORCHESTRATOR_PROMPT
  - [x] `src/stores/orchestrator-store.ts` — isOpen, sessionId persistence
  - [x] `src/components/chat/message-row.tsx` — shared MessageRow, ToolResultBlock, InlineToolCall
  - [x] `src/components/orchestrator-sidebar.tsx` — always-present right sidebar with send logic
  - [x] `src/components/app-shell.tsx` — horizontal flex layout, OrchestratorSidebar added
  - [x] `src/components/header.tsx` — OrchestratorToggleButton added
  - [x] `src/hooks/use-keyboard-shortcuts.ts` — Cmd+Shift+O toggle
  - [x] gateway-store: agent.status, agent.delegate, chat.open tools
  - [x] gateway-store: ensureOrchestratorAgent (always present, survives disconnect)
  - [x] gateway-store: orchestrator gets ORCHESTRATOR_PROMPT instead of MEDIA_TOOLS_PROMPT
  - [x] mock-gateway: orchestrator-aware streaming responses
  - [x] chats view: filter orchestrator from agent picker, import shared MessageRow

- [x] Level 4 Plugin System (branch: feat/plugin-system)
  - [x] `plugins/_runtime/react.mjs` — shared React instance shim
  - [x] `plugins/_runtime/studio-store.mjs` — shared store shim
  - [x] `plugins/_runtime/lucide-react.mjs` — shared icons shim
  - [x] `src/app/api/plugins/route.ts` — plugin API (write, build, list, clone-view, install-deps, delete)
  - [x] `src/stores/plugin-store.ts` — Zustand store for installed plugins
  - [x] `src/components/plugin-slot.tsx` — `<PluginSlot name="chats.sidebar" />` injection points
  - [x] `src/components/bundled-view.tsx` — renders esbuild-compiled plugin bundles
  - [x] `src/components/runtime-view.tsx` — renders single-file AI views via sucrase
  - [x] `window.__studioPluginRegister` global — registered in AppShell for client-side plugin activation
  - [x] PluginSlot added to Chats view: `chats.sidebar`, `chats.toolbar`
  - [x] gateway-store: plugin.write, plugin.build, plugin.list, plugin.install-deps, view.clone tool handlers
  - [x] MEDIA_TOOLS_PROMPT updated with plugin tool documentation
  - [x] view-builder.ts prompt updated with full plugin system docs

## Key Architecture Decisions

- **MCP App Factory**: Studio now treats generated apps as isolated workspaces under `apps/{appId}` with an `app.json` manifest and `files/` tree. Global `/api/mcp` tools (`studio.apps.*`) can create/list/read/write across apps, while each app exposes an app-scoped JSON-RPC MCP endpoint at `/api/apps/{appId}/mcp` with `app.info` and `app.files.*` tools so external AI agents can operate on one app as its own tool server.

- **Global Orchestrator**: Persistent right-side sidebar (`OrchestratorSidebar`) always visible across all views. Hosts a reserved "Studio" agent (id: `studio-orchestrator`) that's auto-created on connect and survives disconnects. The orchestrator gets a special `ORCHESTRATOR_PROMPT` (vs `MEDIA_TOOLS_PROMPT` for other agents) emphasizing delegation. Three new tools: `agent.status` (see all agents), `agent.delegate` (send work to another agent + creates session + adds message to ChatsView), `chat.open` (focus Chats view on an agent). Toggle: `OrchestratorToggleButton` in header or `Cmd+Shift+O`.

- **Plugin system (Level 4)**: Two plugin execution modes — (1) sucrase runtime transpiler for single-file AI-generated views (`view.update` tool → `RuntimeView`); (2) esbuild server-side bundler for full multi-file plugins with npm deps (`plugin.write` + `plugin.build` → `BundledView`). Both share the same React/store instances via `globalThis.__studio_react` shims. Plugin types: `standalone` (new tab), `override` (replaces built-in view), `extension` (injects into `PluginSlot` in built-in views).
- **Plugin registration**: After `plugin.build` succeeds, gateway-store calls `window.__studioPluginRegister(id, manifest)` which was injected by AppShell. This registers the plugin in plugin-store (Zustand) and marks it as built. The component cache is cleared so next load fetches the new bundle.
- **Plugin slots**: `<PluginSlot name="chats.sidebar" />` in built-in views renders all "extension" type plugins that declare that slot. Currently wired in: `chats.sidebar`, `chats.toolbar`.


- **Streaming**: Gateway sends two event types: `event:"agent"` (every token, `data.text` cumulative) and `event:"chat"` (periodic, `message.content[]`). Both handled in gateway-store.
- **Tool calls**: Agent embeds ` ```tool ` blocks in text. `splitContentAndTools()` in gateway-store splits raw text into clean `content` + `toolCalls[]` + `isToolStreaming` at the store level. React components never parse tool blocks.
- **Message type**: `Message.content` is always clean text. `Message.toolCalls?: ToolCall[]` for parsed tools. `Message.isToolStreaming?: boolean` during streaming.
- **Error feedback**: Sandpack iframe has `window.onerror`, `ViewErrorBoundary`. Errors sent via postMessage `{type:"error"}` to host, then forwarded to agent chat.
