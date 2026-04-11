# Studio — Tasks

Track ongoing and planned work across the Studio project.

## In Progress

- [ ] Verify streaming works end-to-end (need browser test with real gateway)
- [ ] Build View Builder — code editor + embedded chat + live Sandpack preview

## Backlog

- Коли багато вкладок зявляється горизонтальний скролл
- Помилка канбан view при створенні таску (tasks.create — INVALID_REQUEST unknown method)
- При перезавантаженні сторінки, потрібен час на завантадження всіх вкладок
- Коли відкриваю вю чати то відкривається перший чат а не останній що був активний
- Коли відкриваю чат то скролиться до кінця після відображення — дуже погано

## Completed (this session)

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
