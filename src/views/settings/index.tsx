"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useGatewayStore } from "@/stores/gateway-store"
import { Wifi, FlaskConical, LogOut, Bot, Zap, BrainCircuit } from "lucide-react"
import { cn } from "@/lib/utils"

type Provider = "openclaw" | "claude" | "codex" | "mock"

const PROVIDERS = [
  {
    id: "openclaw" as const,
    name: "OpenClaw Gateway",
    description: "Connect to a self-hosted OpenClaw Gateway via WebSocket",
    icon: Zap,
    color: "text-[#61afef]",
    bgColor: "bg-[#61afef]/10 border-[#61afef]/20",
  },
  {
    id: "claude" as const,
    name: "Claude Code",
    description: "Connect using Anthropic API key for Claude agents",
    icon: BrainCircuit,
    color: "text-[#c678dd]",
    bgColor: "bg-[#c678dd]/10 border-[#c678dd]/20",
  },
  {
    id: "codex" as const,
    name: "OpenAI Codex",
    description: "Connect using OpenAI API key for Codex agents",
    icon: Bot,
    color: "text-[#98c379]",
    bgColor: "bg-[#98c379]/10 border-[#98c379]/20",
  },
]

export default function SettingsView() {
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)
  const [url, setUrl] = useState("ws://localhost:18789")
  const [apiKey, setApiKey] = useState("")
  const [claudeApiKey, setClaudeApiKey] = useState("")
  const [openaiApiKey, setOpenaiApiKey] = useState("")

  const connected = useGatewayStore((s) => s.connected)
  const mockMode = useGatewayStore((s) => s.mockMode)
  const currentUrl = useGatewayStore((s) => s.url)
  const connectGateway = useGatewayStore((s) => s.connectGateway)
  const connectMock = useGatewayStore((s) => s.connectMock)
  const disconnect = useGatewayStore((s) => s.disconnect)

  function handleConnect() {
    if (selectedProvider === "openclaw" && url.trim()) {
      connectGateway(url.trim(), apiKey.trim())
    } else if (selectedProvider === "claude" && claudeApiKey.trim()) {
      // Store Claude API key and connect in mock mode with Claude agent simulation
      // In the future, this would use the Anthropic API directly
      try {
        localStorage.setItem("studio-claude-key", claudeApiKey.trim())
      } catch {}
      connectMock()
    } else if (selectedProvider === "codex" && openaiApiKey.trim()) {
      // Store OpenAI API key and connect in mock mode with Codex agent simulation
      // In the future, this would use the OpenAI API directly
      try {
        localStorage.setItem("studio-openai-key", openaiApiKey.trim())
      } catch {}
      connectMock()
    }
  }

  function handleDisconnect() {
    disconnect()
    try {
      localStorage.removeItem("openclaw-gateway-config")
    } catch {}
  }

  function getProviderLabel(): string {
    if (mockMode && currentUrl === "mock://localhost") {
      const hasClaudeKey = !!localStorage.getItem("studio-claude-key")
      const hasOpenaiKey = !!localStorage.getItem("studio-openai-key")
      if (hasClaudeKey) return "Claude Code"
      if (hasOpenaiKey) return "OpenAI Codex"
      return "Mock Mode"
    }
    return "OpenClaw Gateway"
  }

  return (
    <div className="flex h-full items-start justify-center overflow-auto py-12">
      <div className="w-full max-w-md flex flex-col gap-6">
        <div>
          <h2 className="text-lg font-semibold">Settings</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {connected
              ? `Connected via ${getProviderLabel()}`
              : "Choose a provider to connect and manage agents."}
          </p>
        </div>

        {/* Connected state */}
        {connected && (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{getProviderLabel()}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {mockMode
                      ? "Using simulated data"
                      : currentUrl}
                  </div>
                </div>
                <span className="h-2.5 w-2.5 rounded-full bg-[#98c379]" />
              </div>
            </div>
            <Button variant="outline" onClick={handleDisconnect} className="gap-2">
              <LogOut className="h-4 w-4" />
              Disconnect
            </Button>
          </div>
        )}

        {/* Disconnected — provider selection */}
        {!connected && !selectedProvider && (
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium text-muted-foreground">Choose Provider</h3>
            {PROVIDERS.map((provider) => {
              const Icon = provider.icon
              return (
                <button
                  key={provider.id}
                  onClick={() => setSelectedProvider(provider.id)}
                  className={cn(
                    "flex items-center gap-4 rounded-lg border p-4 text-left transition-colors hover:bg-accent/50 cursor-pointer"
                  )}
                >
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg border", provider.bgColor)}>
                    <Icon className={cn("h-5 w-5", provider.color)} />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{provider.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{provider.description}</div>
                  </div>
                </button>
              )
            })}

            <div className="relative flex items-center py-2">
              <div className="flex-1 border-t" />
              <span className="px-3 text-xs text-muted-foreground">or</span>
              <div className="flex-1 border-t" />
            </div>

            <Button variant="outline" onClick={() => connectMock()} className="gap-2">
              <FlaskConical className="h-4 w-4" />
              Use Mock Data
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Try the app with simulated agents — no API key needed.
            </p>
          </div>
        )}

        {/* OpenClaw form */}
        {!connected && selectedProvider === "openclaw" && (
          <div className="flex flex-col gap-4">
            <button
              onClick={() => setSelectedProvider(null)}
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer text-left"
            >
              &larr; Back to providers
            </button>

            <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
              <Zap className="h-5 w-5 text-[#61afef]" />
              <div>
                <div className="text-sm font-medium">OpenClaw Gateway</div>
                <div className="text-xs text-muted-foreground">WebSocket connection</div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" htmlFor="gateway-url">Gateway URL</label>
              <Input
                id="gateway-url"
                placeholder="ws://localhost:18789"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleConnect()}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" htmlFor="api-key">API Key (optional)</label>
              <Input
                id="api-key"
                type="password"
                placeholder="oc_key_..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleConnect()}
              />
            </div>

            <Button onClick={handleConnect} className="gap-2">
              <Wifi className="h-4 w-4" />
              Connect
            </Button>
          </div>
        )}

        {/* Claude Code form */}
        {!connected && selectedProvider === "claude" && (
          <div className="flex flex-col gap-4">
            <button
              onClick={() => setSelectedProvider(null)}
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer text-left"
            >
              &larr; Back to providers
            </button>

            <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
              <BrainCircuit className="h-5 w-5 text-[#c678dd]" />
              <div>
                <div className="text-sm font-medium">Claude Code</div>
                <div className="text-xs text-muted-foreground">Anthropic API</div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" htmlFor="claude-key">Anthropic API Key</label>
              <Input
                id="claude-key"
                type="password"
                placeholder="sk-ant-..."
                value={claudeApiKey}
                onChange={(e) => setClaudeApiKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleConnect()}
              />
              <p className="text-xs text-muted-foreground">
                Get your API key at{" "}
                <span className="text-[#c678dd]">console.anthropic.com</span>
              </p>
            </div>

            <Button onClick={handleConnect} disabled={!claudeApiKey.trim()} className="gap-2">
              <BrainCircuit className="h-4 w-4" />
              Connect with Claude
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Currently uses mock simulation. Direct API integration coming soon.
            </p>
          </div>
        )}

        {/* Codex form */}
        {!connected && selectedProvider === "codex" && (
          <div className="flex flex-col gap-4">
            <button
              onClick={() => setSelectedProvider(null)}
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer text-left"
            >
              &larr; Back to providers
            </button>

            <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
              <Bot className="h-5 w-5 text-[#98c379]" />
              <div>
                <div className="text-sm font-medium">OpenAI Codex</div>
                <div className="text-xs text-muted-foreground">OpenAI API</div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" htmlFor="openai-key">OpenAI API Key</label>
              <Input
                id="openai-key"
                type="password"
                placeholder="sk-..."
                value={openaiApiKey}
                onChange={(e) => setOpenaiApiKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleConnect()}
              />
              <p className="text-xs text-muted-foreground">
                Get your API key at{" "}
                <span className="text-[#98c379]">platform.openai.com</span>
              </p>
            </div>

            <Button onClick={handleConnect} disabled={!openaiApiKey.trim()} className="gap-2">
              <Bot className="h-4 w-4" />
              Connect with Codex
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Currently uses mock simulation. Direct API integration coming soon.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
