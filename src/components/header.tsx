"use client"

import { Hexagon, Wifi, WifiOff, Settings } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useGatewayStore } from "@/stores/gateway-store"

interface HeaderProps {
  onOpenSettings: () => void
}

export function Header({ onOpenSettings }: HeaderProps) {
  const connected = useGatewayStore((s) => s.connected)
  const mockMode = useGatewayStore((s) => s.mockMode)
  const agents = useGatewayStore((s) => s.agents)
  const onlineCount = agents.filter(
    (a) => a.status === "online" || a.status === "busy"
  ).length

  return (
    <header className="flex h-12 items-center justify-between border-b bg-card px-4">
      <div className="flex items-center gap-2">
        <Hexagon className="h-5 w-5 text-primary" />
        <span className="text-sm font-semibold tracking-tight">
          OpenClaw Hub
        </span>
      </div>

      <div className="flex items-center gap-3">
        {connected && (
          <span className="text-xs text-muted-foreground">
            {onlineCount} agent{onlineCount !== 1 ? "s" : ""} online
          </span>
        )}

        <Badge
          variant={connected ? "default" : "secondary"}
          className="gap-1.5 text-xs cursor-pointer hover:opacity-80"
          onClick={onOpenSettings}
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

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onOpenSettings}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
