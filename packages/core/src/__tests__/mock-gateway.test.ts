import { describe, it, expect, vi, beforeEach } from "vitest"
import { MockGateway } from "../mock-gateway"
import type { GatewayEvent } from "../types"

describe("MockGateway", () => {
  let gateway: MockGateway

  beforeEach(() => {
    gateway = new MockGateway()
  })

  it("emits agents.snapshot on connect", async () => {
    const events: GatewayEvent[] = []
    gateway.onMessage((e) => events.push(e))
    gateway.connect()

    // Wait for the connect timeout
    await new Promise((r) => setTimeout(r, 300))

    const snapshot = events.find((e) => e.type === "agents.snapshot")
    expect(snapshot).toBeDefined()
    if (snapshot?.type === "agents.snapshot") {
      expect(snapshot.agents.length).toBeGreaterThan(0)
    }
  })

  it("emits tasks.snapshot on connect", async () => {
    const events: GatewayEvent[] = []
    gateway.onMessage((e) => events.push(e))
    gateway.connect()

    await new Promise((r) => setTimeout(r, 300))

    const snapshot = events.find((e) => e.type === "tasks.snapshot")
    expect(snapshot).toBeDefined()
  })

  it("responds to ping with pong", () => {
    const events: GatewayEvent[] = []
    gateway.onMessage((e) => events.push(e))
    gateway.send({ type: "ping" })

    const pong = events.find((e) => e.type === "pong")
    expect(pong).toBeDefined()
  })

  it("creates a new agent", () => {
    const events: GatewayEvent[] = []
    gateway.onMessage((e) => events.push(e))
    gateway.send({
      type: "agent.create",
      config: { name: "Test Agent", role: "coder" },
    })

    const updated = events.find((e) => e.type === "agent.updated")
    expect(updated).toBeDefined()
    if (updated?.type === "agent.updated") {
      expect(updated.agent.name).toBe("Test Agent")
    }
  })

  it("deletes an agent", async () => {
    const events: GatewayEvent[] = []
    gateway.onMessage((e) => events.push(e))
    gateway.connect()

    await new Promise((r) => setTimeout(r, 300))

    // Get first agent from snapshot
    const snapshot = events.find((e) => e.type === "agents.snapshot")
    if (snapshot?.type !== "agents.snapshot") return
    const agentId = snapshot.agents[0].id

    gateway.send({ type: "agent.delete", agentId })

    const removed = events.find((e) => e.type === "agent.removed")
    expect(removed).toBeDefined()
    if (removed?.type === "agent.removed") {
      expect(removed.agentId).toBe(agentId)
    }
  })

  it("generates a view with code, dependencies, skill, and title", async () => {
    const events: GatewayEvent[] = []
    gateway.onMessage((e) => events.push(e))

    gateway.send({
      type: "view.generate",
      prompt: "Create a dashboard",
      requestId: "test-req-1",
    })

    // Wait for generation delay (2-4 seconds)
    await new Promise((r) => setTimeout(r, 5000))

    const generated = events.find((e) => e.type === "view.generated")
    expect(generated).toBeDefined()

    if (generated?.type === "view.generated") {
      expect(generated.requestId).toBe("test-req-1")
      expect(generated.code).toContain("useViewProps")
      expect(generated.code).toContain("./bridge")
      expect(generated.title).toBe("Agent Dashboard")
      expect(generated.dependencies).toBeDefined()
      expect(generated.skill).toBeDefined()
      expect(generated.skill).toContain("Agent Dashboard")
    }
  }, 10000)

  it("responds to agent.message with simulated response", async () => {
    const events: GatewayEvent[] = []
    gateway.onMessage((e) => events.push(e))
    gateway.connect()

    await new Promise((r) => setTimeout(r, 300))

    // Get first agent
    const snapshot = events.find((e) => e.type === "agents.snapshot")
    if (snapshot?.type !== "agents.snapshot") return
    const agentId = snapshot.agents[0].id

    gateway.send({
      type: "agent.message",
      agentId,
      content: "Hello test",
    })

    await new Promise((r) => setTimeout(r, 2000))

    const message = events.find((e) => e.type === "message")
    expect(message).toBeDefined()
    if (message?.type === "message") {
      expect(message.message.agentId).toBe(agentId)
      expect(message.message.role).toBe("assistant")
      expect(message.message.content).toContain("Hello test")
    }
  }, 5000)

  it("creates a task", () => {
    const events: GatewayEvent[] = []
    gateway.onMessage((e) => events.push(e))

    gateway.send({
      type: "task.create",
      title: "Test Task",
      assigneeId: "agent-1",
    })

    const taskEvent = events.find((e) => e.type === "task.updated")
    expect(taskEvent).toBeDefined()
    if (taskEvent?.type === "task.updated") {
      expect(taskEvent.task.title).toBe("Test Task")
      expect(taskEvent.task.status).toBe("queue")
    }
  })

  it("cleans up on disconnect", () => {
    gateway.connect()
    gateway.disconnect()
    // Should not throw or leak
  })

  it("getMessages returns initial mock messages", () => {
    const messages = gateway.getMessages()
    expect(messages).toBeDefined()
    expect(typeof messages).toBe("object")
  })

  it("removes listener when unsubscribe is called", () => {
    const events: GatewayEvent[] = []
    const unsub = gateway.onMessage((e) => events.push(e))

    gateway.send({ type: "ping" })
    expect(events.length).toBe(1)

    unsub()
    gateway.send({ type: "ping" })
    expect(events.length).toBe(1) // Should not increase
  })
})
