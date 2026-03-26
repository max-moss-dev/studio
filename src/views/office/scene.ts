import {
  Application,
  Container,
  Sprite,
  Texture,
  Text,
  TextStyle,
  Graphics,
} from "pixi.js"
import type { Agent } from "@/lib/types"
import {
  createCharacterSvg,
  createDeskSvg,
  createFloorTileSvg,
  createBubbleSvg,
  ROLE_COLORS,
} from "./assets"

// Isometric projection constants
const TILE_W = 64
const TILE_H = 32

// Convert grid (col, row) to screen (x, y) in isometric
function toIso(col: number, row: number): { x: number; y: number } {
  return {
    x: (col - row) * (TILE_W / 2),
    y: (col + row) * (TILE_H / 2),
  }
}

// Role-based zone assignments (row ranges)
const ROLE_ZONES: Record<string, { startRow: number }> = {
  orchestrator: { startRow: 0 },
  coder: { startRow: 2 },
  reviewer: { startRow: 4 },
  researcher: { startRow: 6 },
  custom: { startRow: 8 },
}

interface AgentSprite {
  container: Container
  character: Sprite
  desk: Sprite
  bubble: Sprite | null
  nameLabel: Text
  floatOffset: number
  floatSpeed: number
}

export class OfficeScene {
  private app: Application | null = null
  private world: Container = new Container()
  private agentSprites: Map<string, AgentSprite> = new Map()
  private floorContainer: Container = new Container()
  private agentContainer: Container = new Container()
  private isDragging = false
  private lastPointer = { x: 0, y: 0 }
  private animFrame: number | null = null
  private initialized = false

  async init(canvas: HTMLCanvasElement, width: number, height: number) {
    if (this.initialized) return

    this.app = new Application()
    await this.app.init({
      canvas,
      width,
      height,
      backgroundColor: 0x0f0f11,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    })

    this.app.stage.addChild(this.world)
    this.world.addChild(this.floorContainer)
    this.world.addChild(this.agentContainer)

    // Center the world
    this.world.x = width / 2
    this.world.y = 100

    // Draw floor grid
    this.drawFloor(10, 10)

    // Setup pan
    this.setupPan(canvas)

    // Start animation loop
    this.animate()
    this.initialized = true
  }

  private drawFloor(cols: number, rows: number) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const pos = toIso(c, r)
        const tile = new Graphics()
        tile.poly([
          { x: 0, y: -TILE_H / 2 },
          { x: TILE_W / 2, y: 0 },
          { x: 0, y: TILE_H / 2 },
          { x: -TILE_W / 2, y: 0 },
        ])
        tile.fill({ color: 0x18181b })
        tile.stroke({ width: 0.5, color: 0x27272a })
        tile.x = pos.x
        tile.y = pos.y
        this.floorContainer.addChild(tile)
      }
    }
  }

  private setupPan(canvas: HTMLCanvasElement) {
    canvas.addEventListener("pointerdown", (e) => {
      this.isDragging = true
      this.lastPointer = { x: e.clientX, y: e.clientY }
    })

    canvas.addEventListener("pointermove", (e) => {
      if (!this.isDragging) return
      const dx = e.clientX - this.lastPointer.x
      const dy = e.clientY - this.lastPointer.y
      this.world.x += dx
      this.world.y += dy
      this.lastPointer = { x: e.clientX, y: e.clientY }
    })

    canvas.addEventListener("pointerup", () => {
      this.isDragging = false
    })

    canvas.addEventListener("pointerleave", () => {
      this.isDragging = false
    })

    // Zoom
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault()
      const scale = this.world.scale.x
      const factor = e.deltaY > 0 ? 0.95 : 1.05
      const newScale = Math.max(0.3, Math.min(3, scale * factor))
      this.world.scale.set(newScale)
    }, { passive: false })
  }

  updateAgents(agents: Agent[]) {
    // Track which agents we've seen
    const seen = new Set<string>()

    agents.forEach((agent, idx) => {
      seen.add(agent.id)

      if (this.agentSprites.has(agent.id)) {
        // Update existing sprite
        this.updateAgentSprite(agent)
      } else {
        // Create new sprite
        this.createAgentSprite(agent, idx)
      }
    })

    // Remove agents that are no longer present
    for (const [id, sprite] of this.agentSprites) {
      if (!seen.has(id)) {
        this.agentContainer.removeChild(sprite.container)
        this.agentSprites.delete(id)
      }
    }
  }

  private createAgentSprite(agent: Agent, index: number) {
    const container = new Container()

    // Position based on role zone
    const zone = ROLE_ZONES[agent.role] ?? ROLE_ZONES.custom
    const col = index % 4
    const row = zone.startRow + Math.floor(index / 4)
    const pos = toIso(col * 2, row)

    container.x = pos.x
    container.y = pos.y

    // Desk
    const deskGraphics = new Graphics()
    deskGraphics.poly([
      { x: 0, y: -12 },
      { x: 30, y: 3 },
      { x: 0, y: 18 },
      { x: -30, y: 3 },
    ])
    deskGraphics.fill({ color: 0x2a2a2e })
    deskGraphics.stroke({ width: 0.5, color: 0x3a3a3e })
    deskGraphics.y = 10
    container.addChild(deskGraphics)

    // Character circle
    const roleColor = ROLE_COLORS[agent.role]
    const statusColor = agent.status === "online" ? 0x22c55e
      : agent.status === "busy" ? 0xeab308
      : agent.status === "error" ? 0xef4444
      : 0x6b7280

    // Status ring
    const ring = new Graphics()
    ring.circle(0, 0, 16)
    ring.stroke({ width: 2.5, color: statusColor })
    ring.y = -20
    container.addChild(ring)

    // Head
    const head = new Graphics()
    head.circle(0, 0, 13)
    head.fill({ color: parseInt(roleColor.primary.slice(1), 16) })
    head.y = -20
    container.addChild(head)

    // Initials
    const initials = agent.name.slice(0, 2).toUpperCase()
    const nameText = new Text({
      text: initials,
      style: new TextStyle({
        fontFamily: "system-ui, sans-serif",
        fontSize: 11,
        fontWeight: "600",
        fill: 0xffffff,
      }),
    })
    nameText.anchor.set(0.5)
    nameText.y = -20
    container.addChild(nameText)

    // Name label below
    const label = new Text({
      text: agent.name,
      style: new TextStyle({
        fontFamily: "system-ui, sans-serif",
        fontSize: 9,
        fill: 0x888888,
      }),
    })
    label.anchor.set(0.5, 0)
    label.y = 30
    container.addChild(label)

    const desk = new Sprite() // placeholder
    const character = new Sprite() // placeholder

    const spriteData: AgentSprite = {
      container,
      character,
      desk,
      bubble: null,
      nameLabel: label,
      floatOffset: Math.random() * Math.PI * 2,
      floatSpeed: 0.5 + Math.random() * 0.5,
    }

    // Add bubble if has task
    if (agent.currentTask) {
      this.addBubble(spriteData, agent.currentTask)
    }

    this.agentContainer.addChild(container)
    this.agentSprites.set(agent.id, spriteData)
  }

  private updateAgentSprite(agent: Agent) {
    const sprite = this.agentSprites.get(agent.id)
    if (!sprite) return

    // Update bubble
    if (agent.currentTask) {
      if (!sprite.bubble) {
        this.addBubble(sprite, agent.currentTask)
      }
    } else if (sprite.bubble) {
      sprite.container.removeChild(sprite.bubble)
      sprite.bubble = null
    }
  }

  private addBubble(sprite: AgentSprite, text: string) {
    if (sprite.bubble) {
      sprite.container.removeChild(sprite.bubble)
    }

    const truncated = text.length > 30 ? text.slice(0, 27) + "..." : text
    const bubbleText = new Text({
      text: truncated,
      style: new TextStyle({
        fontFamily: "system-ui, sans-serif",
        fontSize: 8,
        fill: 0xd4d4d8,
      }),
    })
    bubbleText.anchor.set(0.5)

    const padding = 8
    const bgWidth = bubbleText.width + padding * 2
    const bgHeight = bubbleText.height + padding

    const bg = new Graphics()
    bg.roundRect(-bgWidth / 2, -bgHeight / 2, bgWidth, bgHeight, 4)
    bg.fill({ color: 0x27272a, alpha: 0.95 })

    const bubbleContainer = new Container()
    bubbleContainer.addChild(bg)
    bubbleContainer.addChild(bubbleText)
    bubbleContainer.y = -48
    bubbleContainer.alpha = 0.9

    sprite.container.addChild(bubbleContainer)
    sprite.bubble = bubbleContainer as unknown as Sprite
  }

  private animate = () => {
    const time = performance.now() / 1000

    for (const [, sprite] of this.agentSprites) {
      // Subtle floating animation
      const offset = Math.sin(time * sprite.floatSpeed + sprite.floatOffset) * 2
      sprite.container.children.forEach((child, i) => {
        // Only animate the character-related elements (not desk/label)
        if (i >= 1 && i <= 3) {
          child.y = child.y // Keep static for now to avoid jumps
        }
      })

      // Bubble fade
      if (sprite.bubble) {
        sprite.bubble.alpha = 0.7 + Math.sin(time * 2) * 0.2
      }
    }

    this.animFrame = requestAnimationFrame(this.animate)
  }

  resize(width: number, height: number) {
    if (this.app) {
      this.app.renderer.resize(width, height)
    }
  }

  destroy() {
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame)
    }
    if (this.app) {
      // PixiJS 8 ResizePlugin.destroy() calls this._cancelResize() which is
      // only assigned when `resizeTo` is set during init. Since we don't use
      // `resizeTo`, the function is undefined and destroy() throws. Patch it
      // before calling destroy.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const appAny = this.app as any
      if (typeof appAny._cancelResize !== "function") {
        appAny._cancelResize = () => {}
      }
      this.app.destroy()
      this.app = null
    }
    this.agentSprites.clear()
    this.initialized = false
  }
}
