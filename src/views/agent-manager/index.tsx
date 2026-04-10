"use client"

import { useState } from "react"
import type { ViewProps } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Search,
  Plus,
  RotateCw,
  Trash2,
  Bot,
  Clock,
  Coins,
  ChevronRight,
  X,
  MessageSquare,
  Crown,
  Code,
  Eye,
  FlaskConical,
  Terminal,
  CircleCheck,
  CirclePlay,
} from "lucide-react"
import type { Agent, AgentStatus, AgentRole } from "@/lib/types"
import { cn } from "@/lib/utils"
import { uid } from "@/lib/mock-data"
import { useTabStore } from "@/stores/tab-store"

const STATUS_COLORS: Record<AgentStatus, string> = {
  online: "bg-[#98c379]",
  busy: "bg-[#e5c07b]",
  offline: "bg-[#5c6370]",
  error: "bg-[#e06c75]",
}

const STATUS_LABELS: Record<AgentStatus, string> = {
  online: "Online",
  busy: "Busy",
  offline: "Offline",
  error: "Error",
}

const ROLE_COLORS: Record<AgentRole, string> = {
  orchestrator: "text-[#61afef] bg-[#61afef]/10",
  coder: "text-[#98c379] bg-[#98c379]/10",
  reviewer: "text-[#c678dd] bg-[#c678dd]/10",
  researcher: "text-[#e5c07b] bg-[#e5c07b]/10",
  custom: "text-[#5c6370] bg-[#5c6370]/10",
}

const ROLE_AVATAR_BG: Record<AgentRole, string> = {
  orchestrator: "bg-[#61afef]",
  coder: "bg-[#98c379]",
  reviewer: "bg-[#c678dd]",
  researcher: "bg-[#e5c07b]",
  custom: "bg-[#5c6370]",
}

const ROLE_ICONS: Record<AgentRole, React.ComponentType<{ className?: string }>> = {
  orchestrator: Crown,
  coder: Code,
  reviewer: Eye,
  researcher: FlaskConical,
  custom: Terminal,
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  return `${Math.floor(seconds / 86400)}d`
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

type FilterStatus = "all" | AgentStatus

export default function AgentManagerView({ agents, send, models, initialAgentId }: ViewProps & { initialAgentId?: string }) {
  const openTab = useTabStore((s) => s.openTab)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all")
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(
    initialAgentId ? agents.find((a) => a.id === initialAgentId) ?? null : null
  )
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newAgentName, setNewAgentName] = useState("")

  const filtered = agents.filter((a) => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false
    if (search && !a.name.toLowerCase().includes(search.toLowerCase()))
      return false
    return true
  })

  const statusCounts = {
    all: agents.length,
    online: agents.filter((a) => a.status === "online").length,
    busy: agents.filter((a) => a.status === "busy").length,
    offline: agents.filter((a) => a.status === "offline").length,
    error: agents.filter((a) => a.status === "error").length,
  }

  const [addError, setAddError] = useState("")

  function handleAddAgent() {
    const name = newAgentName.trim()
    if (!name) return
    if (name.toLowerCase() === "main") {
      setAddError("\"main\" is reserved")
      return
    }
    // Use ASCII-safe name for workspace path
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase() || "agent"
    setAddError("")
    send({
      type: "agent.create",
      config: {
        name: safeName,
      },
    })
    setNewAgentName("")
    setShowAddDialog(false)
  }

  function handleRestart(agentId: string) {
    send({ type: "agent.command", agentId, command: "restart" })
  }

  function handleDelete(agentId: string) {
    send({ type: "agent.delete", agentId })
    setSelectedAgent(null)
  }

  return (
    <div className="flex h-full">
      {/* Main list */}
      <div className="flex flex-1 flex-col">
        {/* Toolbar */}
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search agents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex gap-1">
            {(
              ["all", "online", "busy", "offline", "error"] as FilterStatus[]
            ).map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setStatusFilter(status)}
                className="gap-1.5 text-xs"
              >
                {status !== "all" && (
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      STATUS_COLORS[status as AgentStatus]
                    )}
                  />
                )}
                {status === "all" ? "All" : STATUS_LABELS[status as AgentStatus]}
                <span className="text-muted-foreground">
                  {statusCounts[status]}
                </span>
              </Button>
            ))}
          </div>

          <Button size="sm" className="gap-1.5 ml-auto" onClick={() => { setShowAddDialog(true); setAddError("") }}>
            <Plus className="h-4 w-4" />
            Add Agent
          </Button>
        </div>

        {/* Agent table */}
        <ScrollArea className="flex-1">
          <div className="divide-y">
            {filtered.map((agent, idx) => (
              <button
                key={agent.id ?? idx}
                onClick={() => setSelectedAgent(agent)}
                className={cn(
                  "flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-accent/50 cursor-pointer",
                  selectedAgent?.id === agent.id && "bg-accent/50"
                )}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className={cn("flex h-9 w-9 items-center justify-center rounded-full", ROLE_AVATAR_BG[agent.role])}>
                    {(() => { const RoleIcon = ROLE_ICONS[agent.role]; return <RoleIcon className="h-4 w-4 text-white" /> })()}
                  </div>
                  <span className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background", STATUS_COLORS[agent.status])} />
                </div>

                {/* Name + role */}
                <div className="min-w-[140px]">
                  <div className="text-sm font-medium">{agent.name}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {agent.role} &middot; {agent.model}
                  </div>
                </div>

                {/* Model */}
                <div className="min-w-[140px] text-xs text-muted-foreground">
                  {agent.model}
                </div>

                {/* Current task */}
                <div className="flex-1 truncate text-xs text-muted-foreground">
                  {agent.currentTask ?? (
                    <span className="italic">No active task</span>
                  )}
                </div>

                {/* Tokens */}
                <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-[80px]">
                  <Coins className="h-3 w-3" />
                  {formatTokens(agent.tokensToday)}
                </div>

                {/* Uptime */}
                <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-[60px]">
                  <Clock className="h-3 w-3" />
                  {formatUptime(agent.uptime)}
                </div>

                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}

            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Bot className="h-8 w-8 mb-2" />
                <p className="text-sm">No agents found</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Detail panel — fills remaining space */}
      {!selectedAgent && (
        <div className="flex-1 border-l flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Select an agent to view details</p>
        </div>
      )}
      {selectedAgent && (() => {
        const RoleIcon = ROLE_ICONS[selectedAgent.role]
        return (
        <div className="flex-1 border-l flex flex-col max-w-lg">
          <ScrollArea className="flex-1">
            <div className="p-8 flex flex-col gap-6">
              {/* Header with avatar */}
              <div className="flex items-center gap-4">
                <div className={cn("flex h-14 w-14 items-center justify-center rounded-full shrink-0", ROLE_AVATAR_BG[selectedAgent.role])}>
                  <RoleIcon className="h-7 w-7 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-[22px] font-semibold leading-tight">{selectedAgent.name}</h2>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge variant="secondary" className={cn("text-[11px] font-medium", ROLE_COLORS[selectedAgent.role])}>
                      {selectedAgent.role}
                    </Badge>
                    <div className="flex items-center gap-1.5 rounded-md bg-card px-2 py-0.5">
                      <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_COLORS[selectedAgent.status])} />
                      <span className={cn("text-[11px] font-medium", {
                        "text-[#98c379]": selectedAgent.status === "online",
                        "text-[#e5c07b]": selectedAgent.status === "busy",
                        "text-[#e06c75]": selectedAgent.status === "error",
                        "text-[#5c6370]": selectedAgent.status === "offline",
                      })}>{STATUS_LABELS[selectedAgent.status]}</span>
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setSelectedAgent(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openTab("chats", `Chat: ${selectedAgent.name}`, "message-square", { agentId: selectedAgent.id })}>
                  <MessageSquare className="h-3.5 w-3.5" /> Chat
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleRestart(selectedAgent.id)}>
                  <RotateCw className="h-3.5 w-3.5" /> Restart
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 bg-[#3e2828] border-[#5c3030] text-[#e06c75] hover:bg-[#4a2a2a] hover:text-[#e06c75]"
                  onClick={() => handleDelete(selectedAgent.id)}
                  disabled={selectedAgent.name === "main" || selectedAgent.id === "main"}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Current Task", value: selectedAgent.currentTask ?? "None" },
                  { label: "Tokens Today", value: formatTokens(selectedAgent.tokensToday) },
                  { label: "Uptime", value: formatUptime(selectedAgent.uptime) },
                  { label: "Total Tokens", value: formatTokens(selectedAgent.tokensTotal) },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-[10px] border bg-card p-4 flex flex-col gap-1">
                    <span className="text-[11px] font-medium text-muted-foreground">{stat.label}</span>
                    <span className="text-sm font-medium truncate">{stat.value}</span>
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div className="h-px bg-border" />

              {/* Configuration */}
              <div>
                <h3 className="text-base font-semibold mb-3">Configuration</h3>
                <div className="rounded-[10px] border bg-[#3e4451] overflow-hidden flex flex-col gap-px">
                  {[
                    { label: "Model", value: selectedAgent.model },
                    { label: "Status", value: STATUS_LABELS[selectedAgent.status] },
                    { label: "Role", value: selectedAgent.role },
                    { label: "ID", value: selectedAgent.id },
                  ].map((row) => (
                    <div key={row.label} className="flex justify-between items-center bg-card px-4 py-3">
                      <span className="text-[13px] text-muted-foreground">{row.label}</span>
                      <span className="text-[13px] font-mono text-secondary-foreground">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
        )
      })()}

      {/* Add Agent Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Agent</DialogTitle>
            <DialogDescription>
              Create a new agent connected to your Gateway.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                placeholder="e.g. code-assistant (ASCII only)"
                value={newAgentName}
                onChange={(e) => { setNewAgentName(e.target.value); setAddError("") }}
              />
              {addError && (
                <p className="text-xs text-destructive">{addError}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Name will be converted to lowercase ASCII. Model and other settings can be configured after creation.
              </p>
            </div>
            <Button onClick={handleAddAgent} disabled={!newAgentName.trim()} className="mt-2">
              Create Agent
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
