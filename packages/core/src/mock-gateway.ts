import type { GatewayMessage, GatewayEvent, Agent, Task } from "./types"
import {
  MOCK_AGENTS,
  MOCK_TASKS,
  MOCK_MESSAGES,
  MOCK_EVENTS,
  generateRandomEvent,
  uid,
} from "./mock-data"

type Listener = (event: GatewayEvent) => void

/**
 * MockGateway simulates an OpenClaw Gateway in the browser.
 * It implements the same message protocol as a real gateway
 * but uses in-memory mock data.
 */
export class MockGateway {
  private agents: Agent[] = structuredClone(MOCK_AGENTS)
  private tasks: Task[] = structuredClone(MOCK_TASKS)
  private listeners: Set<Listener> = new Set()
  private eventInterval: ReturnType<typeof setInterval> | null = null

  connect(): void {
    // Simulate connection delay then send snapshots
    setTimeout(() => {
      this.emit({ type: "agents.snapshot", agents: this.agents })
      this.emit({ type: "tasks.snapshot", tasks: this.tasks })

      // Send existing events
      for (const event of MOCK_EVENTS) {
        this.emit({ type: "event", event })
      }
    }, 200)

    // Start generating random events every 3-8 seconds
    this.eventInterval = setInterval(() => {
      const event = generateRandomEvent(this.agents)
      this.emit({ type: "event", event })

      // Randomly update an agent's status
      if (event.type === "status_change" && event.data.to) {
        const agent = this.agents.find((a) => a.id === event.agentId)
        if (agent) {
          agent.status = event.data.to as Agent["status"]
          agent.tokensToday += Math.floor(Math.random() * 500)
          this.emit({ type: "agent.updated", agent: { ...agent } })
        }
      }
    }, 3000 + Math.random() * 5000)
  }

  disconnect(): void {
    if (this.eventInterval) {
      clearInterval(this.eventInterval)
      this.eventInterval = null
    }
    this.listeners.clear()
  }

  onMessage(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  send(msg: GatewayMessage): void {
    // Process client messages
    switch (msg.type) {
      case "ping":
        this.emit({ type: "pong" })
        break

      case "agent.create": {
        const newAgent: Agent = {
          id: `agent-${uid()}`,
          name: msg.config.name ?? "New Agent",
          status: "online",
          role: msg.config.role ?? "custom",
          model: msg.config.model ?? "claude-sonnet-4-6",
          currentTask: null,
          tokensToday: 0,
          tokensTotal: 0,
          uptime: 0,
          config: {},
          ...msg.config,
        } as Agent
        this.agents.push(newAgent)
        this.emit({ type: "agent.updated", agent: newAgent })
        break
      }

      case "agent.update": {
        const idx = this.agents.findIndex((a) => a.id === msg.agentId)
        if (idx !== -1) {
          this.agents[idx] = { ...this.agents[idx], ...msg.config }
          this.emit({ type: "agent.updated", agent: this.agents[idx] })
        }
        break
      }

      case "agent.delete": {
        const deleteIdx = this.agents.findIndex((a) => a.id === msg.agentId)
        if (deleteIdx !== -1) {
          this.agents.splice(deleteIdx, 1)
          this.emit({ type: "agent.removed", agentId: msg.agentId })
        }
        break
      }

      case "agent.command": {
        const agent = this.agents.find((a) => a.id === msg.agentId)
        if (agent && msg.command === "restart") {
          agent.status = "online"
          agent.uptime = 0
          this.emit({ type: "agent.updated", agent: { ...agent } })
        }
        break
      }

      case "agent.message": {
        // Simulate streaming agent response (token-by-token like real gateway)
        const fullText = `I received your message. Processing: "${msg.content.slice(0, 50)}..."\n\nHere's what I can help you with:\n- **Task coordination** across agents\n- **Code review** and implementation guidance\n- **Research** and analysis of technical topics\n- **Workflow orchestration** for complex multi-step tasks\n\nLet me know how I can assist you.`
        const messageId = uid()
        const agentId = msg.agentId
        const words = fullText.split(/(\s+)/)
        let accumulated = ""
        let wordIdx = 0

        const streamNext = () => {
          if (wordIdx >= words.length) {
            // Final: send complete message and end stream
            this.emit({
              type: "message.stream.end",
              agentId,
              messageId,
            } as GatewayEvent)
            return
          }
          // Stream 1-3 words at a time
          const chunkSize = 1 + Math.floor(Math.random() * 2)
          let delta = ""
          for (let i = 0; i < chunkSize && wordIdx < words.length; i++) {
            delta += words[wordIdx++]
          }
          accumulated += delta
          this.emit({
            type: "message.stream",
            agentId,
            messageId,
            delta,
          } as GatewayEvent)
          setTimeout(streamNext, 20 + Math.random() * 40)
        }

        setTimeout(streamNext, 300)
        break
      }

      case "task.create": {
        const newTask: Task = {
          id: `task-${uid()}`,
          title: msg.title,
          status: "queue",
          assigneeId: msg.assigneeId ?? null,
          tokens: 0,
          duration: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        this.tasks.push(newTask)
        this.emit({ type: "task.updated", task: newTask })
        break
      }

      case "task.update": {
        const taskIdx = this.tasks.findIndex((t) => t.id === msg.taskId)
        if (taskIdx !== -1) {
          this.tasks[taskIdx] = {
            ...this.tasks[taskIdx],
            ...msg.updates,
            updatedAt: Date.now(),
          }
          this.emit({ type: "task.updated", task: this.tasks[taskIdx] })
        }
        break
      }

      case "view.generate": {
        // Simulate AI view generation with a delay
        setTimeout(() => {
          this.emit({
            type: "view.generated",
            requestId: msg.requestId,
            code: MOCK_GENERATED_VIEW,
            dependencies: MOCK_GENERATED_DEPS,
            skill: MOCK_GENERATED_SKILL,
            title: "Agent Dashboard",
          })
        }, 2000 + Math.random() * 2000)
        break
      }

      case "subscribe":
        // Already sent snapshots on connect
        break
    }
  }

  getMessages(): Record<string, import("./types").Message[]> {
    return structuredClone(MOCK_MESSAGES)
  }

  private emit(event: GatewayEvent): void {
    for (const listener of this.listeners) {
      listener(event)
    }
  }
}

const MOCK_GENERATED_VIEW = `
import { useViewProps } from "./bridge"

const ROLE_COLORS = {
  orchestrator: "#61afef",
  coder: "#98c379",
  reviewer: "#c678dd",
  researcher: "#e5c07b",
  custom: "#5c6370",
}

const STATUS_COLORS = {
  online: "#98c379",
  busy: "#e5c07b",
  error: "#e06c75",
  offline: "#5c6370",
}

export default function AgentDashboard() {
  const { agents, tasks, events } = useViewProps()

  const totalTokens = agents.reduce((sum, a) => sum + a.tokensToday, 0)
  const onlineCount = agents.filter((a) => a.status === "online" || a.status === "busy").length
  const activeTasks = tasks.filter((t) => t.status === "in_progress").length

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif", color: "#abb2bf" }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20, color: "#e5e5e5" }}>
        Agent Dashboard
      </h2>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Agents Online", value: onlineCount + "/" + agents.length, color: "#98c379" },
          { label: "Active Tasks", value: activeTasks, color: "#61afef" },
          { label: "Tokens Today", value: totalTokens.toLocaleString(), color: "#e5c07b" },
          { label: "Events", value: events.length, color: "#c678dd" },
        ].map((stat) => (
          <div key={stat.label} style={{
            flex: 1, padding: 16, background: "#2c313a", borderRadius: 8,
            border: "1px solid #3e4451",
          }}>
            <div style={{ fontSize: 12, color: "#5c6370", marginBottom: 4 }}>{stat.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Agent list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {agents.map((agent) => (
          <div key={agent.id} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 16px", background: "#2c313a", borderRadius: 8,
            border: "1px solid #3e4451",
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: STATUS_COLORS[agent.status] || "#5c6370",
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: "#e5e5e5" }}>{agent.name}</div>
              <div style={{ fontSize: 12, color: "#5c6370" }}>
                {agent.role} · {agent.model}
              </div>
            </div>
            <div style={{
              fontSize: 11, padding: "2px 8px", borderRadius: 4,
              background: ROLE_COLORS[agent.role] + "22",
              color: ROLE_COLORS[agent.role],
            }}>
              {agent.role}
            </div>
            <div style={{ fontSize: 13, color: "#abb2bf", minWidth: 80, textAlign: "right" }}>
              {agent.tokensToday.toLocaleString()} tokens
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
`.trim()

const MOCK_GENERATED_DEPS: Record<string, string> = {}
const MOCK_GENERATED_SKILL = `# Agent Dashboard
## What it shows
Overview of all agents with status, roles, token usage, and active tasks.
## Data used
- agents[].name, status, role, model, tokensToday
- tasks[].status (for active task count)
- events[].length (total event count)
## How to modify
- Add charts: add recharts to dependencies, import BarChart etc.
- Filter by role: add role filter dropdown
- Add click actions: use send() to interact with agents
`.trim()
