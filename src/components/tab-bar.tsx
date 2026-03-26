"use client"

import {
  Bot,
  Kanban,
  MessageSquare,
  Building2,
  Sparkles,
  X,
  Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useTabStore } from "@/stores/tab-store"
import { Button } from "@/components/ui/button"

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  bot: Bot,
  kanban: Kanban,
  "message-square": MessageSquare,
  "building-2": Building2,
  sparkles: Sparkles,
}

interface TabBarProps {
  onNewTab: () => void
}

export function TabBar({ onNewTab }: TabBarProps) {
  const tabs = useTabStore((s) => s.tabs)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const setActiveTab = useTabStore((s) => s.setActiveTab)
  const closeTab = useTabStore((s) => s.closeTab)

  return (
    <div className="flex h-10 items-center gap-0.5 border-b bg-card/50 px-2 overflow-x-auto">
      {tabs.map((tab) => {
        const Icon = ICON_MAP[tab.icon ?? ""] ?? Sparkles
        const isActive = tab.id === activeTabId

        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "group relative flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors cursor-pointer",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="max-w-[120px] truncate">{tab.title}</span>
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

      <Button
        variant="ghost"
        size="icon"
        className="ml-1 h-7 w-7 shrink-0"
        onClick={onNewTab}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
