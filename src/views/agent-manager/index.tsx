"use client"

import { useState } from "react"
import type { ViewProps } from "@/lib/types"
import type { OpenCodeAgentConfig, ProviderSource } from "@studio/core"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  Globe,
  Zap,
  ArrowLeft,
  Loader2,
} from "lucide-react"
import type { Agent, AgentStatus, AgentRole } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useTabStore } from "@/stores/tab-store"
import { loadProviders } from "@/lib/providers"
import { useGatewayStore } from "@/stores/gateway-store"

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

const PROVIDER_META: Record<ProviderSource, { label: string; shortLabel: string; color: string; bgColor: string; icon: React.ComponentType<{ className?: string }> }> = {
  openclaw: { label: "OpenClaw", shortLabel: "OC", color: "text-[#61afef]", bgColor: "bg-[#61afef]/10 border-[#61afef]/20", icon: Globe },
  opencode: { label: "OpenCode", shortLabel: "OD", color: "text-[#e5c07b]", bgColor: "bg-[#e5c07b]/10 border-[#e5c07b]/20", icon: Zap },
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
type ProviderFilter = "all" | ProviderSource

function getProvidersConfig() {
  if (typeof window === "undefined") return { openclaw: { enabled: false }, opencode: { enabled: false } }
  return loadProviders()
}

function getEnabledProviders(): ProviderSource[] {
  const config = getProvidersConfig()
  return (Object.keys(config) as ProviderSource[]).filter((id) => config[id]?.enabled)
}

export default function AgentManagerView({ agents, send, models, opencodeModels, initialAgentId }: ViewProps & { initialAgentId?: string }) {
  const openTab = useTabStore((s) => s.openTab)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all")
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>("all")
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(
    initialAgentId ? agents.find((a) => a.id === initialAgentId) ?? null : null
  )
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [addStep, setAddStep] = useState<"provider" | "openclaw" | "opencode">("provider")
  const [newAgentName, setNewAgentName] = useState("")
  const [addError, setAddError] = useState("")

  // OpenCode-specific form state
  const [ocName, setOcName] = useState("")
  const [ocDescription, setOcDescription] = useState("")
  const [ocMode, setOcMode] = useState<"primary" | "subagent">("primary")
  const [ocModel, setOcModel] = useState("")
  const [ocPrompt, setOcPrompt] = useState("")
  const [ocPermission, setOcPermission] = useState<"full" | "readonly" | "nobash">("full")
  const [creating, setCreating] = useState(false)

  const enabledProviders = getEnabledProviders()
  const showProviderPicker = enabledProviders.length > 1 || enabledProviders.length === 0

  const filtered = agents.filter((a) => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false
    if (providerFilter !== "all" && a.provider !== providerFilter && !(providerFilter === "openclaw" && !a.provider)) return false
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const statusCounts = {
    all: agents.length,
    online: agents.filter((a) => a.status === "online").length,
    busy: agents.filter((a) => a.status === "busy").length,
    offline: agents.filter((a) => a.status === "offline").length,
    error: agents.filter((a) => a.status === "error").length,
  }

  const providerCounts = {
    all: agents.length,
    openclaw: agents.filter((a) => !a.provider || a.provider === "openclaw").length,
    opencode: agents.filter((a) => a.provider === "opencode").length,
  }

  function handleOpenClawCreate() {
    const name = newAgentName.trim()
    if (!name) return
    if (name.toLowerCase() === "main") {
      setAddError("\"main\" is reserved")
      return
    }
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase() || "agent"
    setAddError("")
    send({
      type: "agent.create",
      config: { name: safeName },
      provider: "openclaw",
    })
    setNewAgentName("")
    setShowAddDialog(false)
    setAddStep("provider")
  }

  async function handleOpenCodeCreate() {
    if (!ocName.trim()) { setAddError("Name is required"); return }
    if (!ocDescription.trim()) { setAddError("Description is required"); return }

    setCreating(true)
    setAddError("")

    const config: OpenCodeAgentConfig = {
      name: ocName.trim().replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase(),
      description: ocDescription.trim(),
      mode: ocMode,
    }
    if (ocModel) config.model = ocModel
    if (ocPrompt.trim()) config.prompt = ocPrompt.trim()

    // Set permissions based on preset
    if (ocPermission === "readonly") {
      config.permission = { edit: "deny", bash: "deny", webfetch: "allow" }
    } else if (ocPermission === "nobash") {
      config.permission = { edit: "allow", bash: "deny", webfetch: "allow" }
    } else {
      config.permission = { edit: "ask", bash: "ask", webfetch: "allow" }
    }

    try {
      const store = useGatewayStore.getState()
      await store.createOpenCodeAgent(
        getProvidersConfig().opencode?.url ?? "http://localhost:4096",
        config
      )
      setShowAddDialog(false)
      setAddStep("provider")
      setOcName("")
      setOcDescription("")
      setOcMode("primary")
      setOcModel("")
      setOcPrompt("")
      setOcPermission("full")
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to create agent")
    } finally {
      setCreating(false)
    }
  }

  function handleRestart(agentId: string) {
    send({ type: "agent.command", agentId, command: "restart" })
  }

  function handleDelete(agentId: string) {
    send({ type: "agent.delete", agentId })
    setSelectedAgent(null)
  }

  function openAddDialog() {
    if (!showProviderPicker && enabledProviders.length === 1) {
      setAddStep(enabledProviders[0] === "opencode" ? "opencode" : "openclaw")
    } else {
      setAddStep("provider")
    }
    setShowAddDialog(true)
    setAddError("")
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

          {/* Provider filter pills */}
          {(enabledProviders.length > 0 || agents.some((a) => a.provider === "opencode")) && (
            <div className="flex gap-1">
              {(["all", "openclaw", "opencode"] as ProviderFilter[]).map((pf) => (
                <Button
                  key={pf}
                  variant={providerFilter === pf ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setProviderFilter(pf)}
                  className="gap-1.5 text-xs"
                >
                  {pf === "all" ? "All" : PROVIDER_META[pf].label}
                  <span className="text-muted-foreground">
                    {providerCounts[pf]}
                  </span>
                </Button>
              ))}
            </div>
          )}

          <Button size="sm" className="gap-1.5 ml-auto" onClick={openAddDialog}>
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
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{agent.name}</span>
                    {/* Provider badge */}
                    {agent.provider && (() => {
                      const pm = PROVIDER_META[agent.provider]
                      const PmIcon = pm.icon
                      return (
                        <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium border", pm.bgColor, pm.color)}>
                          <PmIcon className="h-2.5 w-2.5" />
                          {pm.shortLabel}
                        </span>
                      )
                    })()}
                  </div>
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

      {/* Detail panel */}
      {!selectedAgent && (
        <div className="flex-1 border-l flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Select an agent to view details</p>
        </div>
      )}
      {selectedAgent && (() => {
        const RoleIcon = ROLE_ICONS[selectedAgent.role]
        const providerMeta = selectedAgent.provider ? PROVIDER_META[selectedAgent.provider] : null
        const ProviderIcon = providerMeta?.icon
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
                  <div className="flex items-center gap-2">
                    <h2 className="text-[22px] font-semibold leading-tight">{selectedAgent.name}</h2>
                    {providerMeta && ProviderIcon && (
                      <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium border", providerMeta.bgColor, providerMeta.color)}>
                        <ProviderIcon className="h-3 w-3" />
                        {providerMeta.label}
                      </span>
                    )}
                  </div>
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
                    { label: "Provider", value: selectedAgent.provider ? PROVIDER_META[selectedAgent.provider].label : "OpenClaw" },
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
      <Dialog open={showAddDialog} onOpenChange={(open) => { setShowAddDialog(open); if (!open) setAddStep("provider") }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {addStep === "provider" ? "Create Agent" : addStep === "openclaw" ? "Create OpenClaw Agent" : "Create OpenCode Agent"}
            </DialogTitle>
            <DialogDescription>
              {addStep === "provider"
                ? "Choose which platform to create an agent on."
                : addStep === "openclaw"
                  ? "Create a new agent on your OpenClaw Gateway."
                  : "Create a new agent on your OpenCode server."}
            </DialogDescription>
          </DialogHeader>

          {/* Step 1: Provider picker */}
          {addStep === "provider" && (
            <div className="flex gap-4 py-4">
              <button
                onClick={() => setAddStep("openclaw")}
                className="flex-1 flex flex-col items-center gap-3 rounded-xl border-2 border-border hover:border-[#61afef] hover:bg-[#61afef]/5 p-6 transition-colors cursor-pointer"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#61afef]/10">
                  <Globe className="h-6 w-6 text-[#61afef]" />
                </div>
                <div className="text-center">
                  <div className="font-semibold">OpenClaw</div>
                  <div className="text-xs text-muted-foreground mt-1">Multi-agent orchestrator</div>
                </div>
              </button>
              <button
                onClick={() => setAddStep("opencode")}
                className="flex-1 flex flex-col items-center gap-3 rounded-xl border-2 border-border hover:border-[#e5c07b] hover:bg-[#e5c07b]/5 p-6 transition-colors cursor-pointer"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e5c07b]/10">
                  <Zap className="h-6 w-6 text-[#e5c07b]" />
                </div>
                <div className="text-center">
                  <div className="font-semibold">OpenCode</div>
                  <div className="text-xs text-muted-foreground mt-1">Coding agent with sessions</div>
                </div>
              </button>
            </div>
          )}

          {/* Step 2a: OpenClaw form */}
          {addStep === "openclaw" && (
            <div className="flex flex-col gap-4 py-2">
              <Button variant="ghost" size="sm" className="w-fit gap-1.5" onClick={() => setAddStep("provider")}>
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Name</label>
                <Input
                  placeholder="e.g. code-assistant (ASCII only)"
                  value={newAgentName}
                  onChange={(e) => { setNewAgentName(e.target.value); setAddError("") }}
                  onKeyDown={(e) => e.key === "Enter" && handleOpenClawCreate()}
                />
                {addError && (
                  <p className="text-xs text-destructive">{addError}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Name will be converted to lowercase ASCII. Model and other settings can be configured after creation.
                </p>
              </div>
              {models.length > 0 && (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Model (optional)</label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    value=""
                    onChange={() => {}}
                  >
                    <option value="">Default</option>
                    {models.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              )}
              <Button onClick={handleOpenClawCreate} disabled={!newAgentName.trim()} className="mt-2 gap-2">
                <Globe className="h-4 w-4" /> Create OpenClaw Agent
              </Button>
            </div>
          )}

          {/* Step 2b: OpenCode form */}
          {addStep === "opencode" && (
            <div className="flex flex-col gap-4 py-2">
              <Button variant="ghost" size="sm" className="w-fit gap-1.5" onClick={() => setAddStep("provider")}>
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Agent Name</label>
                <Input
                  placeholder="e.g. code-reviewer"
                  value={ocName}
                  onChange={(e) => { setOcName(e.target.value); setAddError("") }}
                />
                <p className="text-xs text-muted-foreground">Lowercase, hyphens allowed. Becomes the agent identifier.</p>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Description <span className="text-destructive">*</span></label>
                <textarea
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="What does this agent do? e.g. Reviews code for quality and best practices"
                  value={ocDescription}
                  onChange={(e) => { setOcDescription(e.target.value); setAddError("") }}
                />
                <p className="text-xs text-muted-foreground">Required. Helps OpenCode decide when to invoke this agent.</p>
              </div>

              <div className="flex gap-4">
                <div className="flex flex-col gap-2 flex-1">
                  <label className="text-sm font-medium">Mode</label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
                    value={ocMode}
                    onChange={(e) => setOcMode(e.target.value as "primary" | "subagent")}
                  >
                    <option value="primary">Primary</option>
                    <option value="subagent">Subagent</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2 flex-1">
                  <label className="text-sm font-medium">Permissions</label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
                    value={ocPermission}
                    onChange={(e) => setOcPermission(e.target.value as "full" | "readonly" | "nobash")}
                  >
                    <option value="full">Full (ask for risky)</option>
                    <option value="readonly">Read-only</option>
                    <option value="nobash">No bash</option>
                  </select>
                </div>
              </div>

              {opencodeModels.length > 0 && (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Model (optional)</label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
                    value={ocModel}
                    onChange={(e) => setOcModel(e.target.value)}
                  >
                    <option value="">Default</option>
                    {opencodeModels.map((m) => (
                      <option key={`${m.providerId}/${m.modelId}`} value={m.modelId}>
                        {m.providerId}/{m.modelId}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">System Prompt (optional)</label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Custom instructions for this agent..."
                  value={ocPrompt}
                  onChange={(e) => setOcPrompt(e.target.value)}
                />
              </div>

              {addError && (
                <p className="text-xs text-destructive">{addError}</p>
              )}

              <Button onClick={handleOpenCodeCreate} disabled={!ocName.trim() || !ocDescription.trim() || creating} className="mt-2 gap-2">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                Create OpenCode Agent
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}