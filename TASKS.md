# Studio — Tasks

Track ongoing and planned work across the Studio project.

## In Progress

- [ ] Build View Builder — code editor + embedded chat + live Sandpack preview

## Backlog
- Запамятати дані входу в openclaw gateway для натсупних разів
- Помилка канбан view при створенні таску (tasks.create — INVALID_REQUEST unknown method)
- При перезавантаженні сторінки, потрібен час на завантадження всіх вкладок
- Agent edit/update UI (configure model, role, workspace after creation)

## Completed (this session)

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

## Key Architecture Decisions

- **Streaming**: Gateway sends two event types: `event:"agent"` (every token, `data.text` cumulative) and `event:"chat"` (periodic, `message.content[]`). Both handled in gateway-store.
- **Tool calls**: Agent embeds ` ```tool ` blocks in text. `splitContentAndTools()` in gateway-store splits raw text into clean `content` + `toolCalls[]` + `isToolStreaming` at the store level. React components never parse tool blocks.
- **Message type**: `Message.content` is always clean text. `Message.toolCalls?: ToolCall[]` for parsed tools. `Message.isToolStreaming?: boolean` during streaming.
- **Error feedback**: Sandpack iframe has `window.onerror`, `ViewErrorBoundary`. Errors sent via postMessage `{type:"error"}` to host, then forwarded to agent chat.
