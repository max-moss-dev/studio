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
        // Simulate agent response
        const responseMsg = {
          id: uid(),
          agentId: msg.agentId,
          role: "assistant" as const,
          content: `I received your message. Processing: "${msg.content.slice(0, 50)}..."`,
          timestamp: Date.now(),
        }
        setTimeout(() => {
          this.emit({ type: "message", message: responseMsg })
        }, 500 + Math.random() * 1500)
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
function TokenChart() {
  const { agents } = useAgentData();

  const data = agents.map(agent => ({
    name: agent.name,
    tokens: agent.tokensToday,
    role: agent.role,
  }));

  const roleColors = {
    orchestrator: "#3b82f6",
    coder: "#22c55e",
    reviewer: "#a855f7",
    researcher: "#f97316",
    custom: "#6b7280",
  };

  return (
    <div style={{ width: "100%", height: "100%", padding: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16, color: "#e5e5e5" }}>
        Token Usage by Agent (Today)
      </h2>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data}>
          <XAxis dataKey="name" stroke="#888" />
          <YAxis stroke="#888" />
          <Tooltip
            contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }}
            labelStyle={{ color: "#e5e5e5" }}
          />
          <Bar dataKey="tokens" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={index} fill={roleColors[entry.role] || "#6b7280"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
`.trim()
