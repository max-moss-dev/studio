"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useGatewayStore, loadPersistedConfig } from "@studio/core"
import { Server, Check, X, Loader2, Cloud, AlertCircle } from "lucide-react"
import type { OllamaConfig } from "@studio/core"

interface ConnectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ConnectionDialog({ open, onOpenChange }: ConnectionDialogProps) {
  // Ollama connection state
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434")
  const [ollamaApiKey, setOllamaApiKey] = useState("")
  const [defaultModel, setDefaultModel] = useState("kimi-k2.5:cloud")
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
    models?: string[]
  } | null>(null)

  // Store state
  const ollamaConnected = useGatewayStore((s) => s.ollamaConnected)
  const ollamaConnectionError = useGatewayStore((s) => s.ollamaConnectionError)
  const ollamaConfig = useGatewayStore((s) => s.ollamaConfig)
  const ollamaModels = useGatewayStore((s) => s.ollamaModels)
  const connectOllama = useGatewayStore((s) => s.connectOllama)
  const disconnectOllama = useGatewayStore((s) => s.disconnectOllama)
  const clearError = useGatewayStore((s) => s.clearError)

  // Load persisted config on mount
  useEffect(() => {
    const config = loadPersistedConfig()
    if (config?.ollamaConfig) {
      setOllamaUrl(config.ollamaConfig.url)
      setOllamaApiKey(config.ollamaConfig.apiKey ?? "")
      setDefaultModel(config.ollamaConfig.defaultModel)
    }
  }, [])

  // Clear test result when inputs change
  useEffect(() => {
    setTestResult(null)
  }, [ollamaUrl, ollamaApiKey, defaultModel])

  async function handleTestConnection() {
    setIsTesting(true)
    setTestResult(null)

    try {
      const config: OllamaConfig = {
        url: ollamaUrl.trim() || "http://localhost:11434",
        defaultModel: defaultModel.trim() || "kimi-k2.5:cloud",
        apiKey: ollamaApiKey.trim() || undefined,
      }

      // Quick test - just check version endpoint
      const response = await fetch(`${config.url}/api/version`, {
        headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
        signal: AbortSignal.timeout(5000),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      // Check if model exists
      const modelsResponse = await fetch(`${config.url}/api/tags`, {
        headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
        signal: AbortSignal.timeout(5000),
      })

      let models: string[] = []
      if (modelsResponse.ok) {
        const data = await modelsResponse.json()
        models = data.models?.map((m: { name?: string; model?: string }) => m.name || m.model) || []
      }

      const hasModel = models.includes(config.defaultModel)

      setTestResult({
        success: true,
        message: hasModel
          ? `Connected! Model "${config.defaultModel}" is available.`
          : `Connected! Warning: Model "${config.defaultModel}" not found. Available: ${models.slice(0, 5).join(", ")}${models.length > 5 ? "..." : ""}`,
        models,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setTestResult({
        success: false,
        message: message.includes("ECONNREFUSED") || message.includes("Failed to fetch")
          ? `Cannot connect to Ollama at ${ollamaUrl}. Make sure Ollama is running.`
          : message,
      })
    } finally {
      setIsTesting(false)
    }
  }

  async function handleConnect() {
    const config: OllamaConfig = {
      url: ollamaUrl.trim() || "http://localhost:11434",
      defaultModel: defaultModel.trim() || "kimi-k2.5:cloud",
      apiKey: ollamaApiKey.trim() || undefined,
    }

    await connectOllama(config)
    if (!ollamaConnectionError) {
      onOpenChange(false)
    }
  }

  function handleDisconnect() {
    disconnectOllama()
    clearError()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-[#61afef]" />
            Ollama Connection
          </DialogTitle>
          <DialogDescription>
            {ollamaConnected
              ? `Connected to Ollama at ${ollamaConfig?.url}`
              : "Connect to Ollama to use AI agents."}
          </DialogDescription>
        </DialogHeader>

        {/* Connected state — show status + disconnect */}
        {ollamaConnected && (
          <div className="flex flex-col gap-4 py-2">
            <div className="rounded-lg border bg-muted/50 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium flex items-center gap-2">
                    <Cloud className="h-4 w-4 text-[#61afef]" />
                    Ollama Connected
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {ollamaConfig?.url}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Model: <span className="font-medium">{ollamaConfig?.defaultModel}</span>
                  </div>
                  {ollamaModels.length > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Available: {ollamaModels.length} models
                    </div>
                  )}
                </div>
                <span className="h-2.5 w-2.5 rounded-full bg-[#98c379]" />
              </div>
            </div>

            <Button
              variant="outline"
              onClick={handleDisconnect}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Disconnect
            </Button>
          </div>
        )}

        {/* Disconnected state — show connect form */}
        {!ollamaConnected && (
          <div className="flex flex-col gap-4 py-2">
            {/* Error message */}
            {ollamaConnectionError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Connection Failed</p>
                    <p className="text-xs text-red-700 mt-1">
                      {ollamaConnectionError.message}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" htmlFor="ollama-url">
                Ollama URL
              </label>
              <Input
                id="ollama-url"
                placeholder="http://localhost:11434"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTestConnection()}
              />
              <p className="text-xs text-muted-foreground">
                HTTP endpoint of your Ollama instance. Use{" "}
                <code className="text-[11px]">http://localhost:11434</code> for local
                or a remote URL for cloud Ollama.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" htmlFor="default-model">
                Default Model
              </label>
              <Input
                id="default-model"
                placeholder="kimi-k2.5:cloud"
                value={defaultModel}
                onChange={(e) => setDefaultModel(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Model name as shown in <code className="text-[11px]">ollama list</code>
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" htmlFor="ollama-api-key">
                API Key (optional)
              </label>
              <Input
                id="ollama-api-key"
                type="password"
                placeholder="For cloud instances with auth"
                value={ollamaApiKey}
                onChange={(e) => setOllamaApiKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Required only for remote Ollama instances with authentication.
              </p>
            </div>

            {/* Test result */}
            {testResult && (
              <div
                className={`rounded-lg border p-3 text-sm ${
                  testResult.success
                    ? "border-green-200 bg-green-50 text-green-800"
                    : "border-red-200 bg-red-50 text-red-800"
                }`}
              >
                <div className="flex items-start gap-2">
                  {testResult.success ? (
                    <Check className="h-4 w-4 mt-0.5 shrink-0" />
                  ) : (
                    <X className="h-4 w-4 mt-0.5 shrink-0" />
                  )}
                  <p>{testResult.message}</p>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="gap-2"
              >
                {isTesting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Test Connection
              </Button>

              <Button
                onClick={handleConnect}
                disabled={!testResult?.success && !ollamaConnectionError}
                className="gap-2"
              >
                <Server className="h-4 w-4" />
                Connect
              </Button>
            </div>

            {/* Instructions */}
            <div className="rounded-lg border bg-muted/50 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Quick Start:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>
                  Install Ollama:{" "}
                  <code className="text-[10px]">curl -fsSL https://ollama.com/install.sh | sh</code>
                </li>
                <li>
                  Pull model: <code className="text-[10px]">ollama pull kimi-k2.5:cloud</code>
                </li>
                <li>
                  Start Ollama: <code className="text-[10px]">ollama serve</code>
                </li>
                <li>Enter URL above and connect</li>
              </ol>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
