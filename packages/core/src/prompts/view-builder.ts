/**
 * View Builder prompt — instructions for agents on how to create and update
 * React views rendered in Sandpack iframe.
 *
 * This prompt is injected into the system message sent to agents.
 * It can be improved over time as we learn what works.
 */
export const VIEW_BUILDER_PROMPT = `
## Views — Building React UI Components

You can create and update interactive React views that render in the user's Studio UI.
Views run in a sandboxed Sandpack iframe with React 18 + TypeScript.

### Tool

\`\`\`tool
{"tool": "view.update", "params": {"viewId": "my-dashboard", "code": "..."}}
\`\`\`

- **viewId**: kebab-case identifier. Use a descriptive name (e.g. "agent-dashboard", "task-timeline").
- **code**: Full React component source (see structure below).
- If the viewId doesn't exist, a new view is created. If it exists, the code is replaced.
- Built-in views cannot be edited — you must use a new viewId.

### Component Structure

\`\`\`tsx
import { useViewProps, send } from "./bridge"

export default function MyView() {
  const { agents, events, tasks, messages, models } = useViewProps()

  return (
    <div style={{ padding: 20 }}>
      <h1>My View</h1>
    </div>
  )
}
\`\`\`

### Available Data (useViewProps)

| Field      | Type                          | Description                           |
|------------|-------------------------------|---------------------------------------|
| agents     | Agent[]                       | All connected agents with status      |
| events     | AgentEvent[]                  | Recent agent events                   |
| tasks      | Task[]                        | All tasks from the task board         |
| messages   | Record<string, Message[]>     | Chat messages grouped by agent ID     |
| models     | string[]                      | Available AI models                   |

**Agent fields**: id, name, status ("online"|"busy"|"offline"|"error"), role, model, currentTask, tokensToday, tokensTotal
**Task fields**: id, title, status ("queue"|"in_progress"|"done"|"blocked"), assigneeId, tokens, duration
**Message fields**: id, agentId, role ("user"|"assistant"|"tool"), content, timestamp

### Sending Actions (send)

\`\`\`tsx
// Send a chat message to an agent
send({ type: "agent.message", agentId: "main", content: "Hello" })

// Create a task
send({ type: "task.create", title: "Fix bug", assigneeId: "coder-1" })

// Update task status
send({ type: "task.update", taskId: "t1", updates: { status: "done" } })
\`\`\`

### Styling

Use inline styles or CSS-in-JS. The iframe has a dark theme:
- Background: #282c34
- Text: #abb2bf
- Accent: #61afef
- Success: #98c379
- Warning: #e5c07b
- Error: #e06c75
- Muted: #5c6370

Standard patterns:
\`\`\`tsx
// Use CSS custom properties for consistent theming
const styles = {
  container: { padding: 20, color: "#abb2bf", fontFamily: "system-ui, sans-serif" },
  card: { background: "#2c313a", borderRadius: 8, padding: 16, marginBottom: 8 },
  heading: { color: "#61afef", fontSize: 18, fontWeight: 600, marginBottom: 12 },
  badge: (color: string) => ({
    display: "inline-block", padding: "2px 8px", borderRadius: 10,
    fontSize: 11, fontWeight: 500, background: color + "20", color,
  }),
}
\`\`\`

### npm Packages

You can import any npm package. Popular choices:
- **recharts** — charts and graphs
- **d3** — data visualization
- **date-fns** — date formatting
- **lodash** — utilities

Import them normally: \`import { BarChart, Bar } from "recharts"\`
Sandpack resolves them automatically.

### Error Handling

If your view throws a runtime error, the error message will be automatically sent back
to you so you can fix it. Always handle edge cases:
- Check if data arrays are empty before rendering
- Use optional chaining for nested properties
- Provide loading/empty states

### Best Practices

1. **Start simple** — get a working view first, then iterate
2. **Use real data** — always use useViewProps() data, never hardcode
3. **Handle empty states** — show helpful messages when no data
4. **Keep it focused** — one view = one purpose
5. **Responsive layout** — use flexbox, avoid fixed widths
`.trim()
