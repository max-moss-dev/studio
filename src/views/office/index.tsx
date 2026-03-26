"use client"

import { useEffect, useRef, useCallback } from "react"
import type { ViewProps } from "@/lib/types"
import { OfficeScene } from "./scene"

export default function OfficeView({ agents }: ViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<OfficeScene | null>(null)

  // Init PixiJS scene
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const scene = new OfficeScene()
    sceneRef.current = scene

    const { width, height } = container.getBoundingClientRect()
    scene.init(canvas, width, height)

    return () => {
      scene.destroy()
      sceneRef.current = null
    }
  }, [])

  // Update agents
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.updateAgents(agents)
    }
  }, [agents])

  // Handle resize
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (sceneRef.current) {
          sceneRef.current.resize(width, height)
        }
        if (canvasRef.current) {
          canvasRef.current.style.width = `${width}px`
          canvasRef.current.style.height = `${height}px`
        }
      }
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="h-full w-full relative overflow-hidden bg-[#0f0f11]">
      <canvas ref={canvasRef} className="block" />

      {/* Legend */}
      <div className="absolute bottom-4 left-4 flex gap-3 rounded-lg border bg-card/80 backdrop-blur-sm px-3 py-2">
        {[
          { color: "#22c55e", label: "Online" },
          { color: "#eab308", label: "Busy" },
          { color: "#6b7280", label: "Offline" },
          { color: "#ef4444", label: "Error" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-[10px] text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      {/* Controls hint */}
      <div className="absolute bottom-4 right-4 rounded-lg border bg-card/80 backdrop-blur-sm px-3 py-2">
        <span className="text-[10px] text-muted-foreground">
          Drag to pan · Scroll to zoom
        </span>
      </div>
    </div>
  )
}
