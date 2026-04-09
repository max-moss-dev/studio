"use client"

import { useEffect, useRef, useMemo, useCallback, useState } from "react"
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force"
import type { ViewProps, Agent, Message } from "@/lib/types"
import { useTabStore } from "@/stores/tab-store"

// ── Types ────────────────────────────────────────────────

interface AgentNode extends SimulationNodeDatum {
  id: string
  agent: Agent
}

interface CommLink extends SimulationLinkDatum<AgentNode> {
  weight: number
  lastActivity: number
}

// ── Colors ───────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  orchestrator: "#61afef",
  coder: "#98c379",
  reviewer: "#c678dd",
  researcher: "#e5c07b",
  custom: "#5c6370",
}

const STATUS_COLORS: Record<string, string> = {
  online: "#98c379",
  busy: "#e5c07b",
  error: "#e06c75",
  offline: "#5c6370",
}

// ── Helpers ──────────────────────────────────────────────

/**
 * Build edges between agents based on message data.
 * If agents share messages or are referenced together, they get an edge.
 */
function buildLinks(
  agents: Agent[],
  messages: Record<string, Message[]>
): CommLink[] {
  const links: Map<string, CommLink> = new Map()
  const agentIds = new Set(agents.map((a) => a.id))

  // Create links from message references between agents
  for (const [agentId, msgs] of Object.entries(messages)) {
    if (!agentIds.has(agentId)) continue

    for (const msg of msgs) {
      // Check if message mentions another agent
      for (const other of agents) {
        if (other.id === agentId) continue
        if (
          msg.content.toLowerCase().includes(other.name.toLowerCase()) ||
          msg.content.includes(other.id)
        ) {
          const key = [agentId, other.id].sort().join(":")
          const existing = links.get(key)
          if (existing) {
            existing.weight += 1
            existing.lastActivity = Math.max(
              existing.lastActivity,
              msg.timestamp
            )
          } else {
            links.set(key, {
              source: agentId,
              target: other.id,
              weight: 1,
              lastActivity: msg.timestamp,
            })
          }
        }
      }
    }
  }

  // If no message-based links, create links between agents with same role
  // or from orchestrators to all others
  if (links.size === 0 && agents.length > 1) {
    const orchestrators = agents.filter((a) => a.role === "orchestrator")
    const others = agents.filter((a) => a.role !== "orchestrator")

    if (orchestrators.length > 0) {
      for (const orch of orchestrators) {
        for (const other of others) {
          links.set(`${orch.id}:${other.id}`, {
            source: orch.id,
            target: other.id,
            weight: 1,
            lastActivity: Date.now(),
          })
        }
      }
    } else {
      // Connect sequentially as fallback
      for (let i = 0; i < agents.length - 1; i++) {
        links.set(`${agents[i].id}:${agents[i + 1].id}`, {
          source: agents[i].id,
          target: agents[i + 1].id,
          weight: 1,
          lastActivity: Date.now(),
        })
      }
    }
  }

  return [...links.values()]
}

// ── Component ────────────────────────────────────────────

export default function NetworkView({ agents, messages }: ViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const simRef = useRef<ReturnType<typeof forceSimulation<AgentNode>> | null>(null)
  const nodesRef = useRef<AgentNode[]>([])
  const linksRef = useRef<CommLink[]>([])
  const animRef = useRef<number | null>(null)
  const sizeRef = useRef({ width: 800, height: 600 })
  const openTab = useTabStore((s) => s.openTab)

  // Interaction state
  const [hoveredAgent, setHoveredAgent] = useState<Agent | null>(null)
  const panRef = useRef({ x: 0, y: 0 })
  const zoomRef = useRef(1)
  const dragRef = useRef<{
    isDragging: boolean
    node: AgentNode | null
    lastPointer: { x: number; y: number }
    isPanning: boolean
  }>({
    isDragging: false,
    node: null,
    lastPointer: { x: 0, y: 0 },
    isPanning: false,
  })

  // Build nodes and links from agents and messages
  const { nodes, links } = useMemo(() => {
    const nodes: AgentNode[] = agents.map((agent) => ({
      id: agent.id,
      agent,
    }))
    const links = buildLinks(agents, messages)
    return { nodes, links }
  }, [agents, messages])

  // Screen → world coords
  const screenToWorld = useCallback(
    (sx: number, sy: number) => {
      const { width, height } = sizeRef.current
      const zoom = zoomRef.current
      const pan = panRef.current
      return {
        x: (sx - width / 2 - pan.x) / zoom,
        y: (sy - height / 2 - pan.y) / zoom,
      }
    },
    []
  )

  // Find node at position
  const nodeAtPosition = useCallback(
    (wx: number, wy: number): AgentNode | null => {
      for (const node of nodesRef.current) {
        if (node.x === undefined || node.y === undefined) continue
        const radius = getNodeRadius(node.agent)
        const dx = wx - node.x
        const dy = wy - node.y
        if (dx * dx + dy * dy < radius * radius) {
          return node
        }
      }
      return null
    },
    []
  )

  // Setup simulation
  useEffect(() => {
    // Preserve positions of existing nodes
    const prevPositions = new Map<string, { x: number; y: number }>()
    for (const node of nodesRef.current) {
      if (node.x !== undefined && node.y !== undefined) {
        prevPositions.set(node.id, { x: node.x, y: node.y })
      }
    }

    // Assign previous positions or random initial positions
    for (const node of nodes) {
      const prev = prevPositions.get(node.id)
      if (prev) {
        node.x = prev.x
        node.y = prev.y
      }
    }

    nodesRef.current = nodes
    linksRef.current = links

    if (simRef.current) {
      simRef.current.stop()
    }

    const sim = forceSimulation<AgentNode>(nodes)
      .force(
        "link",
        forceLink<AgentNode, CommLink>(links)
          .id((d) => d.id)
          .distance(120)
          .strength(0.3)
      )
      .force("charge", forceManyBody().strength(-300))
      .force("center", forceCenter(0, 0).strength(0.05))
      .force("collide", forceCollide<AgentNode>().radius((d) => getNodeRadius(d.agent) + 10))
      .alphaDecay(0.02)

    simRef.current = sim

    return () => {
      sim.stop()
    }
  }, [nodes, links])

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Handle resize
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        const dpr = window.devicePixelRatio || 1
        canvas.width = width * dpr
        canvas.height = height * dpr
        canvas.style.width = `${width}px`
        canvas.style.height = `${height}px`
        sizeRef.current = { width, height }
      }
    })
    observer.observe(container)

    // Initial size
    const { width, height } = container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    sizeRef.current = { width, height }

    function draw() {
      if (!ctx || !canvas) return
      const { width, height } = sizeRef.current
      const dpr = window.devicePixelRatio || 1
      const zoom = zoomRef.current
      const pan = panRef.current

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)

      // Background
      ctx.fillStyle = "#1e2127"
      ctx.fillRect(0, 0, width, height)

      ctx.save()
      ctx.translate(width / 2 + pan.x, height / 2 + pan.y)
      ctx.scale(zoom, zoom)

      const now = Date.now()

      // Draw links
      for (const link of linksRef.current) {
        const source = link.source as AgentNode
        const target = link.target as AgentNode
        if (
          source.x === undefined ||
          source.y === undefined ||
          target.x === undefined ||
          target.y === undefined
        )
          continue

        const age = (now - link.lastActivity) / 1000
        const pulse = age < 5 ? 0.5 + Math.sin(now / 200) * 0.3 : 0
        const alpha = Math.max(0.15, Math.min(0.6, link.weight * 0.15 + pulse))

        ctx.beginPath()
        ctx.moveTo(source.x, source.y)
        ctx.lineTo(target.x, target.y)
        ctx.strokeStyle = `rgba(97, 175, 239, ${alpha})`
        ctx.lineWidth = Math.min(3, 0.5 + link.weight * 0.3)
        ctx.stroke()

        // Pulse dot traveling along the edge for recent activity
        if (age < 10) {
          const t = ((now / 1500) % 1)
          const px = source.x + (target.x - source.x) * t
          const py = source.y + (target.y - source.y) * t
          ctx.beginPath()
          ctx.arc(px, py, 2, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(97, 175, 239, ${0.6 - age * 0.06})`
          ctx.fill()
        }
      }

      // Draw nodes
      for (const node of nodesRef.current) {
        if (node.x === undefined || node.y === undefined) continue

        const agent = node.agent
        const radius = getNodeRadius(agent)
        const roleColor = ROLE_COLORS[agent.role] ?? ROLE_COLORS.custom
        const statusColor = STATUS_COLORS[agent.status] ?? STATUS_COLORS.offline
        const isHovered = hoveredAgent?.id === agent.id

        // Glow for online/busy agents
        if (agent.status === "online" || agent.status === "busy") {
          const gradient = ctx.createRadialGradient(
            node.x, node.y, radius,
            node.x, node.y, radius * 2.5
          )
          gradient.addColorStop(0, `${roleColor}22`)
          gradient.addColorStop(1, "transparent")
          ctx.beginPath()
          ctx.arc(node.x, node.y, radius * 2.5, 0, Math.PI * 2)
          ctx.fillStyle = gradient
          ctx.fill()
        }

        // Status ring
        ctx.beginPath()
        ctx.arc(node.x, node.y, radius + 3, 0, Math.PI * 2)
        ctx.strokeStyle = statusColor
        ctx.lineWidth = isHovered ? 3 : 2
        ctx.stroke()

        // Node body
        ctx.beginPath()
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2)
        ctx.fillStyle = isHovered ? `${roleColor}cc` : `${roleColor}99`
        ctx.fill()

        // Initials
        const initials = agent.name
          .split(/\s+/)
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()
        ctx.fillStyle = "#ffffff"
        ctx.font = `bold ${Math.max(10, radius * 0.7)}px system-ui, sans-serif`
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(initials, node.x, node.y)

        // Name label
        ctx.fillStyle = "#abb2bf"
        ctx.font = "11px system-ui, sans-serif"
        ctx.textAlign = "center"
        ctx.textBaseline = "top"
        ctx.fillText(agent.name, node.x, node.y + radius + 8)

        // Role badge
        ctx.fillStyle = "#5c6370"
        ctx.font = "9px system-ui, sans-serif"
        ctx.fillText(agent.role, node.x, node.y + radius + 22)

        // Token count for hovered
        if (isHovered && agent.tokensToday > 0) {
          ctx.fillStyle = "#e5c07b"
          ctx.font = "10px system-ui, sans-serif"
          ctx.fillText(
            `${agent.tokensToday.toLocaleString()} tokens`,
            node.x,
            node.y + radius + 35
          )
        }
      }

      ctx.restore()

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)

    return () => {
      observer.disconnect()
      if (animRef.current) {
        cancelAnimationFrame(animRef.current)
      }
    }
  }, [hoveredAgent])

  // Mouse interactions
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function handlePointerDown(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const w = screenToWorld(sx, sy)
      const node = nodeAtPosition(w.x, w.y)

      dragRef.current.lastPointer = { x: e.clientX, y: e.clientY }

      if (node) {
        dragRef.current.isDragging = true
        dragRef.current.node = node
        node.fx = node.x
        node.fy = node.y
        simRef.current?.alphaTarget(0.3).restart()
      } else {
        dragRef.current.isPanning = true
      }
    }

    function handlePointerMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top

      if (dragRef.current.isDragging && dragRef.current.node) {
        const w = screenToWorld(sx, sy)
        dragRef.current.node.fx = w.x
        dragRef.current.node.fy = w.y
      } else if (dragRef.current.isPanning) {
        const dx = e.clientX - dragRef.current.lastPointer.x
        const dy = e.clientY - dragRef.current.lastPointer.y
        panRef.current.x += dx
        panRef.current.y += dy
        dragRef.current.lastPointer = { x: e.clientX, y: e.clientY }
      } else {
        // Hover detection
        const w = screenToWorld(sx, sy)
        const node = nodeAtPosition(w.x, w.y)
        setHoveredAgent(node?.agent ?? null)
        canvas!.style.cursor = node ? "pointer" : "grab"
      }
    }

    function handlePointerUp() {
      if (dragRef.current.isDragging && dragRef.current.node) {
        dragRef.current.node.fx = null
        dragRef.current.node.fy = null
        simRef.current?.alphaTarget(0)
      }
      dragRef.current.isDragging = false
      dragRef.current.node = null
      dragRef.current.isPanning = false
    }

    function handleWheel(e: WheelEvent) {
      e.preventDefault()
      const factor = e.deltaY > 0 ? 0.95 : 1.05
      zoomRef.current = Math.max(0.2, Math.min(4, zoomRef.current * factor))
    }

    function handleDblClick(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const w = screenToWorld(sx, sy)
      const node = nodeAtPosition(w.x, w.y)
      if (node) {
        openTab("chats", `Chat: ${node.agent.name}`, "message-square", {
          agentId: node.agent.id,
        })
      }
    }

    canvas.addEventListener("pointerdown", handlePointerDown)
    canvas.addEventListener("pointermove", handlePointerMove)
    canvas.addEventListener("pointerup", handlePointerUp)
    canvas.addEventListener("pointerleave", handlePointerUp)
    canvas.addEventListener("wheel", handleWheel, { passive: false })
    canvas.addEventListener("dblclick", handleDblClick)

    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown)
      canvas.removeEventListener("pointermove", handlePointerMove)
      canvas.removeEventListener("pointerup", handlePointerUp)
      canvas.removeEventListener("pointerleave", handlePointerUp)
      canvas.removeEventListener("wheel", handleWheel)
      canvas.removeEventListener("dblclick", handleDblClick)
    }
  }, [screenToWorld, nodeAtPosition, openTab])

  return (
    <div ref={containerRef} className="h-full w-full relative overflow-hidden">
      <canvas ref={canvasRef} className="block" style={{ cursor: "grab" }} />

      {/* Legend */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-2">
        {/* Status legend */}
        <div className="flex gap-3 rounded-lg border bg-card/80 backdrop-blur-sm px-3 py-2">
          {(["online", "busy", "offline", "error"] as const).map((status) => (
            <div key={status} className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: STATUS_COLORS[status] }}
              />
              <span className="text-[10px] text-muted-foreground capitalize">
                {status}
              </span>
            </div>
          ))}
        </div>

        {/* Role legend */}
        <div className="flex gap-3 rounded-lg border bg-card/80 backdrop-blur-sm px-3 py-2">
          {Object.entries(ROLE_COLORS).map(([role, color]) => (
            <div key={role} className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-[10px] text-muted-foreground capitalize">
                {role}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Controls hint */}
      <div className="absolute bottom-4 right-4 rounded-lg border bg-card/80 backdrop-blur-sm px-3 py-2">
        <span className="text-[10px] text-muted-foreground">
          Drag nodes · Pan canvas · Scroll to zoom · Double-click to chat
        </span>
      </div>

      {/* Hovered agent info */}
      {hoveredAgent && (
        <div className="absolute top-4 right-4 rounded-lg border bg-card/90 backdrop-blur-sm px-4 py-3 min-w-[200px]">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: STATUS_COLORS[hoveredAgent.status] }}
            />
            <span className="text-sm font-medium">{hoveredAgent.name}</span>
          </div>
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <div>
              Role:{" "}
              <span style={{ color: ROLE_COLORS[hoveredAgent.role] }}>
                {hoveredAgent.role}
              </span>
            </div>
            <div>Model: {hoveredAgent.model}</div>
            <div>
              Tokens today:{" "}
              <span className="text-[#e5c07b]">
                {hoveredAgent.tokensToday.toLocaleString()}
              </span>
            </div>
            {hoveredAgent.currentTask && (
              <div className="mt-1 text-[#98c379]">
                Task: {hoveredAgent.currentTask}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────

function getNodeRadius(agent: Agent): number {
  // Size based on token activity (min 18, max 35)
  const base = 18
  const tokenScale = Math.min(1, agent.tokensToday / 10000)
  return base + tokenScale * 17
}
