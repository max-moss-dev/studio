"use client"

import { useState, useEffect } from "react"
import { X, Plus, Zap, Terminal } from "lucide-react"
import {
  Bot,
  Kanban,
  MessageSquare,
  Share2,
  Sparkles,
  Settings,
  LayoutGrid,
  FileText,
  CheckCircle,
  Code,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useGatewayStore } from "@/stores/gateway-store"
import { useTabStore } from "@/stores/tab-store"
import { cn } from "@/lib/utils"
import { loadProviders, type ProviderId } from "@/lib/providers"


const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  bot: Bot,
  kanban: Kanban,
  "message-square": MessageSquare,
  "building-2": Share2,
  "share-2": Share2,
  sparkles: Sparkles,
  settings: Settings,
  "layout-grid": LayoutGrid,
  "file-text": FileText,
  "check-circle": CheckCircle,
  code: Code,
}

const PROVIDER_META: Record<ProviderId, { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string; label: string }> = {
  openclaw: { icon: Zap, color: "#61afef", label: "OpenClaw" },
  opencode: { icon: Terminal, color: "#e5c07b", label: "OpenCode" },
}

function ProviderBadges({ onOpenSettings }: { onOpenSettings: () => void }) {
  const connected = useGatewayStore((s) => s.connected)
  const mockMode = useGatewayStore((s) => s.mockMode)
  // Defer localStorage read to client to avoid SSR hydration mismatch
  const [enabled, setEnabled] = useState<ProviderId[]>([])
  const [providers, setProviders] = useState(() => loadProviders())
  useEffect(() => {
    const p = loadProviders()
    setProviders(p)
    setEnabled((Object.keys(p) as ProviderId[]).filter((id) => p[id].enabled))
  }, [connected])

  // If no providers enabled, show generic status
  if (enabled.length === 0) {
    return (
      <Badge
        variant={connected ? "default" : "secondary"}
        className="gap-1.5 text-xs cursor-pointer hover:opacity-80"
        onClick={onOpenSettings}
      >
        {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
        {connected ? (mockMode ? "Mock Mode" : "Connected") : "Disconnected"}
      </Badge>
    )
  }

  // Show a badge per enabled provider
  return (
    <div className="flex items-center gap-1">
      {enabled.map((id) => {
        const meta = PROVIDER_META[id]
        const Icon = meta.icon
        const isActive = id === "openclaw" ? (connected && !mockMode) : !!providers[id].apiKey?.trim()
        return (
          <button
            key={id}
            onClick={onOpenSettings}
            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium cursor-pointer hover:opacity-80 transition-opacity"
            style={{
              backgroundColor: `${meta.color}20`,
              color: meta.color,
            }}
            title={`${meta.label} — ${isActive ? "connected" : "configured"}`}
          >
            <Icon className="h-3 w-3" style={{ color: meta.color }} />
            {meta.label}
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: isActive ? meta.color : "#5c6370" }}
            />
          </button>
        )
      })}
      {connected && mockMode && (
        <Badge variant="secondary" className="gap-1 text-[10px] cursor-pointer" onClick={onOpenSettings}>
          Mock
        </Badge>
      )}
    </div>
  )
}

export function Header() {
  const connected = useGatewayStore((s) => s.connected)
  const mockMode = useGatewayStore((s) => s.mockMode)
  const disconnect = useGatewayStore((s) => s.disconnect)
  const tabs = useTabStore((s) => s.tabs)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const setActiveTab = useTabStore((s) => s.setActiveTab)
  const closeTab = useTabStore((s) => s.closeTab)
  const openTab = useTabStore((s) => s.openTab)
  const reorderTabs = useTabStore((s) => s.reorderTabs)

  // Tab drag state
  const [dragTabIdx, setDragTabIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  function handleOpenSettings() {
    // Check if settings tab already exists
    const existing = tabs.find((t) => t.viewId === "settings")
    if (existing) {
      setActiveTab(existing.id)
    } else {
      openTab("settings", "Settings", "settings")
    }
  }

  function handleNewTab() {
    // Check if view-picker tab already exists
    const existing = tabs.find((t) => t.viewId === "view-picker")
    if (existing) {
      setActiveTab(existing.id)
    } else {
      openTab("view-picker", "New Tab", "layout-grid")
    }
  }

  const agents = useGatewayStore((s) => s.agents)

  return (
    <header className="flex h-11 items-center bg-header-bg shrink-0">
      {/* Tabs — start immediately after sidebar, no logo here */}
      <div className="flex items-center flex-1 h-full overflow-hidden min-w-0">
        {tabs.map((tab, idx) => {
          const Icon = ICON_MAP[tab.icon ?? ""] ?? Sparkles
          const isActive = tab.id === activeTabId
          const isDragOver = dragOverIdx === idx && dragTabIdx !== idx

          return (
            <button
              key={tab.id}
              draggable
              onClick={() => setActiveTab(tab.id)}
              onAuxClick={(e) => {
                if (e.button === 1 && tabs.length > 1) {
                  e.preventDefault()
                  closeTab(tab.id)
                }
              }}
              onDragStart={() => setDragTabIdx(idx)}
              onDragOver={(e) => { e.preventDefault(); setDragOverIdx(idx) }}
              onDragEnd={() => {
                if (dragTabIdx !== null && dragOverIdx !== null && dragTabIdx !== dragOverIdx) {
                  reorderTabs(dragTabIdx, dragOverIdx)
                }
                setDragTabIdx(null)
                setDragOverIdx(null)
              }}
              className={cn(
                "group relative flex h-full items-center gap-1.5 px-3 text-xs font-medium transition-colors cursor-pointer min-w-0",
                isActive
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:text-secondary-foreground",
                isDragOver && "border-l-2 border-primary"
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{tab.title}</span>
              {tabs.length > 1 && (
                <span
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    closeTab(tab.id)
                  }}
                  className={cn(
                    "ml-1 rounded-sm p-0.5 hover:bg-muted",
                    isActive
                      ? "opacity-60 hover:opacity-100"
                      : "opacity-0 group-hover:opacity-60 hover:!opacity-100"
                  )}
                >
                  <X className="h-3 w-3" />
                </span>
              )}
            </button>
          )
        })}

        <button
          onClick={handleNewTab}
          className="flex items-center justify-center px-3 h-full text-muted-foreground hover:text-secondary-foreground cursor-pointer"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      {/* Right side — Settings button */}
      <div className="flex items-center gap-2 px-3 shrink-0">
        <button
          onClick={handleOpenSettings}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer p-1.5 rounded hover:bg-muted"
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
