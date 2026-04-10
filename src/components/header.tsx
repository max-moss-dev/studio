"use client"

import { Layers, Wifi, WifiOff, X, Plus, LogOut, Users } from "lucide-react"
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

export function Header() {
  const connected = useGatewayStore((s) => s.connected)
  const mockMode = useGatewayStore((s) => s.mockMode)
  const disconnect = useGatewayStore((s) => s.disconnect)
  const tabs = useTabStore((s) => s.tabs)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const setActiveTab = useTabStore((s) => s.setActiveTab)
  const closeTab = useTabStore((s) => s.closeTab)
  const openTab = useTabStore((s) => s.openTab)

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
      {/* Logo — opens settings */}
      <button
        onClick={handleOpenSettings}
        className="flex items-center gap-2.5 px-3 shrink-0 h-full cursor-pointer hover:bg-background/30 transition-colors"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-[#3e4451]">
          <Layers className="h-4 w-4 text-[#abb2bf]" />
        </div>
        <span className="text-[15px] font-semibold tracking-tight text-secondary-foreground">
          Studio
        </span>
      </button>

      {/* Tabs */}
      <div className="flex items-center flex-1 h-full overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = ICON_MAP[tab.icon ?? ""] ?? Sparkles
          const isActive = tab.id === activeTabId

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "group relative flex h-full items-center gap-1.5 px-[22px] text-xs font-medium transition-colors cursor-pointer shrink-0",
                isActive
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:text-secondary-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="max-w-[140px] truncate">{tab.title}</span>
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

      {/* Right side — status + agent count + logout */}
      <div className="flex items-center gap-2 px-3 shrink-0">
        {connected && agents.length > 0 && (
          <div className="flex items-center gap-1.5 rounded-xl bg-[#3e4451] px-2.5 py-0.5">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{agents.length} Agent{agents.length !== 1 ? "s" : ""}</span>
          </div>
        )}
        <Badge
          variant={connected ? "default" : "secondary"}
          className="gap-1.5 text-xs cursor-pointer hover:opacity-80"
          onClick={handleOpenSettings}
        >
          {connected ? (
            <Wifi className="h-3 w-3" />
          ) : (
            <WifiOff className="h-3 w-3" />
          )}
          {connected
            ? mockMode
              ? "Mock Mode"
              : "Connected"
            : "Disconnected"}
        </Badge>
        {connected && (
          <button
            onClick={() => {
              disconnect()
              try { localStorage.removeItem("openclaw-gateway-config") } catch {}
              handleOpenSettings()
            }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer p-1 rounded hover:bg-muted"
            title="Disconnect"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </header>
  )
}
