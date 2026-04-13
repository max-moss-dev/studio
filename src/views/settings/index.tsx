"use client"

import { useState, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useGatewayStore } from "@/stores/gateway-store"
import {
  FlaskConical,
  Check,
  Zap,
  Eye,
  EyeOff,
  LogOut,
  Loader2,
  Terminal,
  Wifi,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  type ProviderId,
  type ProvidersConfig,
  loadProviders,
  saveProviders,
} from "@/lib/providers"

export default function SettingsView() {
  const [config, setConfig] = useState<ProvidersConfig>(loadProviders)
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [loginError, setLoginError] = useState<Record<string, string>>({})
  const [opencodeChecking, setOpencodeChecking] = useState(false)

  const connected = useGatewayStore((s) => s.connected)
  const mockMode = useGatewayStore((s) => s.mockMode)
  const connectGateway = useGatewayStore((s) => s.connectGateway)
  const connectMock = useGatewayStore((s) => s.connectMock)
  const disconnect = useGatewayStore((s) => s.disconnect)

  useEffect(() => { setConfig(loadProviders()) }, [])

  const updateProvider = useCallback((id: ProviderId, patch: Partial<ProvidersConfig[ProviderId]>) => {
    setConfig((prev) => {
      const next = { ...prev, [id]: { ...prev[id], ...patch } }
      saveProviders(next)
      return next
    })
  }, [])

  // --- Disconnect ---
  function handleDisconnect(id: ProviderId) {
    if (id === "openclaw" && connected && !mockMode) {
      disconnect()
      try { localStorage.removeItem("openclaw-gateway-config") } catch {}
    }
    updateProvider(id, { enabled: false })
  }

  // --- OpenClaw connect ---
  function handleOpenClawConnect() {
    const url = config.openclaw.url?.trim()
    if (!url) return
    connectGateway(url, config.openclaw.apiKey ?? "")
    updateProvider("openclaw", { enabled: true })
  }

  // --- OpenCode connect ---
  async function handleOpenCodeConnect() {
    const url = config.opencode.url?.trim()
    if (!url) return
    setOpencodeChecking(true)
    setLoginError((s) => ({ ...s, opencode: "" }))
    try {
      const res = await fetch("/api/agent/opencode", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-opencode-url": url },
        body: JSON.stringify({ action: "ping" }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || data.details || "Connection failed")
      updateProvider("opencode", { enabled: true })
      if (!connected) connectMock()
    } catch (err) {
      setLoginError((s) => ({ ...s, opencode: err instanceof Error ? err.message : String(err) }))
    } finally {
      setOpencodeChecking(false)
    }
  }

  function isConnected(id: ProviderId): boolean {
    if (!config[id].enabled) return false
    if (id === "openclaw") return connected && !mockMode
    return true // opencode: enabled = connected (we ping on connect)
  }

  const enabledCount = Object.values(config).filter((c) => c.enabled).length

  return (
    <div className="flex h-full items-start justify-center overflow-auto py-12">
      <div className="w-full max-w-lg flex flex-col gap-6">
        <div>
          <h2 className="text-lg font-semibold">Providers</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {enabledCount === 0
              ? "Connect a provider to manage agents."
              : `${enabledCount} provider${enabledCount > 1 ? "s" : ""} active`}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {/* ────────── OpenClaw ────────── */}
          <ProviderCard
            name="OpenClaw Gateway"
            description="Multi-agent orchestrator via WebSocket"
            icon={Zap}
            color="#61afef"
            isEnabled={config.openclaw.enabled}
            isConnected={isConnected("openclaw")}
            onDisconnect={() => handleDisconnect("openclaw")}
          >
            {!config.openclaw.enabled && (
              <div className="flex flex-col gap-2">
                <Field label="Gateway URL" id="oc-url">
                  <Input id="oc-url" placeholder="ws://localhost:18789" value={config.openclaw.url ?? ""} onChange={(e) => updateProvider("openclaw", { url: e.target.value })} className="h-8 text-xs" />
                </Field>
                <Field label="API Key" id="oc-key" hint="(optional)">
                  <PasswordInput id="oc-key" placeholder="oc_key_..." value={config.openclaw.apiKey ?? ""} onChange={(v) => updateProvider("openclaw", { apiKey: v })} show={showKeys.openclaw ?? false} onToggle={() => setShowKeys((s) => ({ ...s, openclaw: !s.openclaw }))} />
                </Field>
                <Button onClick={handleOpenClawConnect} disabled={!config.openclaw.url?.trim()} size="sm" className="gap-2 mt-1" style={{ backgroundColor: "#61afef" }}>
                  <Zap className="h-3.5 w-3.5" /> Connect
                </Button>
              </div>
            )}
            {config.openclaw.enabled && (
              <div className="text-xs text-muted-foreground">{config.openclaw.url}</div>
            )}
          </ProviderCard>

          {/* ────────── OpenCode ────────── */}
          <ProviderCard
            name="OpenCode"
            description="Universal coding agent — any LLM backend"
            icon={Terminal}
            color="#e5c07b"
            isEnabled={config.opencode.enabled}
            isConnected={isConnected("opencode")}
            onDisconnect={() => handleDisconnect("opencode")}
          >
            {!config.opencode.enabled && (
              <div className="flex flex-col gap-2">
                <Field label="Server URL" id="oc-srv-url">
                  <Input id="oc-srv-url" placeholder="http://localhost:4096" value={config.opencode.url ?? ""} onChange={(e) => updateProvider("opencode", { url: e.target.value })} className="h-8 text-xs" />
                </Field>
                <Button onClick={handleOpenCodeConnect} disabled={!config.opencode.url?.trim() || opencodeChecking} size="sm" className="gap-2 mt-1" style={{ backgroundColor: "#e5c07b" }}>
                  {opencodeChecking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
                  {opencodeChecking ? "Checking..." : "Connect"}
                </Button>
                {loginError.opencode && <p className="text-[10px] text-[#e06c75]">{loginError.opencode}</p>}
                <p className="text-[10px] text-muted-foreground">
                  Run <code className="text-[10px] text-[#e5c07b]">opencode serve</code> to start.
                  Supports Anthropic, OpenAI, Ollama, Gemini, and more.
                </p>
              </div>
            )}
            {config.opencode.enabled && (
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Terminal className="h-3 w-3" style={{ color: "#e5c07b" }} /> {config.opencode.url}
              </div>
            )}
          </ProviderCard>
        </div>

        {/* Mock mode */}
        <div className="relative flex items-center py-1">
          <div className="flex-1 border-t" />
          <span className="px-3 text-xs text-muted-foreground">or</span>
          <div className="flex-1 border-t" />
        </div>
        <Button variant="outline" onClick={() => connectMock()} disabled={connected && mockMode} className="gap-2">
          <FlaskConical className="h-4 w-4" />
          {connected && mockMode ? <><Check className="h-3.5 w-3.5" /> Mock Mode Active</> : "Use Mock Data"}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          Try the app with simulated agents — no setup needed.
        </p>
      </div>
    </div>
  )
}

// --- Subcomponents ---

function ProviderCard({ name, description, icon: Icon, color, isEnabled, isConnected, onDisconnect, children }: {
  name: string; description: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  color: string; isEnabled: boolean; isConnected: boolean; onDisconnect: () => void; children: React.ReactNode
}) {
  return (
    <div className={cn("rounded-lg border p-4 transition-colors", isEnabled ? "border-opacity-40" : "border-border")} style={isEnabled ? { borderColor: `${color}40`, backgroundColor: `${color}08` } : undefined}>
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border" style={{ backgroundColor: `${color}15`, borderColor: `${color}30` }}>
          <Icon className="h-4.5 w-4.5" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium flex items-center gap-2">
            {name}
            {isConnected && (
              <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ backgroundColor: `${color}20`, color }}>
                <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: color }} />
                connected
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
        {isEnabled && (
          <button onClick={onDisconnect} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer" title="Disconnect">
            <LogOut className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  )
}

function Field({ label, id, hint, children }: { label: string; id: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted-foreground" htmlFor={id}>
        {label} {hint && <span className="text-muted-foreground/50">{hint}</span>}
      </label>
      {children}
    </div>
  )
}

function PasswordInput({ id, placeholder, value, onChange, show, onToggle }: {
  id: string; placeholder: string; value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void
}) {
  return (
    <div className="relative">
      <Input id={id} type={show ? "text" : "password"} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="h-8 text-xs pr-8" />
      <button type="button" onClick={onToggle} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
        {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  )
}
