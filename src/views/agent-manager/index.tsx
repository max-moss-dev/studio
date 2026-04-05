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
  Archive,
  Bot,
  Clock,
  Coins,
  ChevronRight,
  X,
} from "lucide-react"
import type { Agent, AgentStatus, AgentRole } from "@/lib/types"
import { cn } from "@/lib/utils"
import { uid } from "@/lib/mock-data"

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

export default function AgentManagerView({ agents, send }: ViewProps) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all")
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newAgentName, setNewAgentName] = useState("")
  const [newAgentRole, setNewAgentRole] = useState<AgentRole>("coder")
  const [newAgentModel, setNewAgentModel] = useState("claude-sonnet-4-6")

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

  function handleAddAgent() {
    if (!newAgentName.trim()) return
    send({
      type: "agent.create",
      config: {
        name: newAgentName.trim(),
        role: newAgentRole,
        model: newAgentModel,
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

          <Button size="sm" className="gap-1.5 ml-auto" onClick={() => setShowAddDialog(true)}>
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
                {/* Status dot */}
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full shrink-0",
                    STATUS_COLORS[agent.status]
                  )}
                />

                {/* Name + role */}
                <div className="min-w-[140px]">
                  <div className="text-sm font-medium">{agent.name}</div>
                  <Badge
                    variant="secondary"
                    className={cn("mt-0.5 text-[10px]", ROLE_COLORS[agent.role])}
                  >
                    {agent.role}
                  </Badge>
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

      {/* Detail panel */}
      {selectedAgent && (
        <div className="w-80 border-l flex flex-col">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-sm font-semibold">Agent Details</h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setSelectedAgent(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1 p-4">
            <div className="flex flex-col gap-4">
              {/* Header */}
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "h-3 w-3 rounded-full",
                    STATUS_COLORS[selectedAgent.status]
                  )}
                />
                <div>
                  <div className="font-medium">{selectedAgent.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {selectedAgent.id}
                  </div>
                </div>
              </div>

              {/* Stats cards */}
              <div className="grid grid-cols-2 gap-2">
                <Card>
                  <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-xs text-muted-foreground">
                      Tokens Today
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <span className="text-lg font-semibold">
                      {formatTokens(selectedAgent.tokensToday)}
                    </span>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-xs text-muted-foreground">
                      Total Tokens
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <span className="text-lg font-semibold">
                      {formatTokens(selectedAgent.tokensTotal)}
                    </span>
                  </CardContent>
                </Card>
              </div>

              {/* Info */}
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge
                    variant="secondary"
                    className="text-xs"
                  >
                    {STATUS_LABELS[selectedAgent.status]}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Role</span>
                  <Badge
                    variant="secondary"
                    className={cn("text-xs", ROLE_COLORS[selectedAgent.role])}
                  >
                    {selectedAgent.role}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Model</span>
                  <span className="text-xs">{selectedAgent.model}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Uptime</span>
                  <span className="text-xs">
                    {formatUptime(selectedAgent.uptime)}
                  </span>
                </div>
              </div>

              {/* Current task */}
              {selectedAgent.currentTask && (
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">
                    Current Task
                  </div>
                  <div className="rounded-md border p-2 text-xs">
                    {selectedAgent.currentTask}
                  </div>
                </div>
              )}

              {/* Config */}
              <div>
                <div className="mb-1 text-xs text-muted-foreground">
                  Config
                </div>
                <pre className="rounded-md border bg-muted/50 p-2 text-xs overflow-auto max-h-40 font-mono">
                  {JSON.stringify(selectedAgent.config, null, 2)}
                </pre>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={() => handleRestart(selectedAgent.id)}
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  Restart
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(selectedAgent.id)}
                >
                  <Archive className="h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
            </div>
          </ScrollArea>
        </div>
      )}

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
                placeholder="e.g. CodeAssistant"
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Role</label>
              <select
                value={newAgentRole}
                onChange={(e) => setNewAgentRole(e.target.value as AgentRole)}
                className="h-9 rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="orchestrator">Orchestrator</option>
                <option value="coder">Coder</option>
                <option value="reviewer">Reviewer</option>
                <option value="researcher">Researcher</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Model</label>
              <select
                value={newAgentModel}
                onChange={(e) => setNewAgentModel(e.target.value)}
                className="h-9 rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
                <option value="claude-opus-4-6">Claude Opus 4.6</option>
                <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
              </select>
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
