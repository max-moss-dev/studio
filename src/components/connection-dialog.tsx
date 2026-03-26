"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useGatewayStore } from "@/stores/gateway-store"
import { Wifi, FlaskConical, LogOut } from "lucide-react"

interface ConnectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ConnectionDialog({ open, onOpenChange }: ConnectionDialogProps) {
  const [url, setUrl] = useState("ws://localhost:18789")
  const [apiKey, setApiKey] = useState("")
  const connected = useGatewayStore((s) => s.connected)
  const mockMode = useGatewayStore((s) => s.mockMode)
  const currentUrl = useGatewayStore((s) => s.url)
  const connectGateway = useGatewayStore((s) => s.connectGateway)
  const connectMock = useGatewayStore((s) => s.connectMock)
  const disconnect = useGatewayStore((s) => s.disconnect)

  function handleConnect() {
    if (!url.trim()) return
    connectGateway(url.trim(), apiKey.trim())
    onOpenChange(false)
  }

  function handleMock() {
    connectMock()
    onOpenChange(false)
  }

  function handleDisconnect() {
    disconnect()
    try {
      localStorage.removeItem("openclaw-gateway-config")
    } catch {
      // ignore
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gateway Connection</DialogTitle>
          <DialogDescription>
            {connected
              ? mockMode
                ? "Running in mock mode with simulated agents."
                : `Connected to ${currentUrl}`
              : "Connect to your OpenClaw Gateway to manage agents."}
          </DialogDescription>
        </DialogHeader>

        {/* Connected state — show status + disconnect */}
        {connected && (
          <div className="flex flex-col gap-4 py-2">
            <div className="rounded-lg border bg-muted/50 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">
                    {mockMode ? "Mock Mode" : "Live Connection"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {mockMode
                      ? "Using simulated data — no real Gateway"
                      : currentUrl}
                  </div>
                </div>
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </div>
            </div>

            <Button
              variant="outline"
              onClick={handleDisconnect}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              Disconnect
            </Button>
          </div>
        )}

        {/* Disconnected state — show connect form */}
        {!connected && (
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" htmlFor="gateway-url">
                Gateway URL
              </label>
              <Input
                id="gateway-url"
                placeholder="ws://localhost:18789"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleConnect()}
              />
              <p className="text-xs text-muted-foreground">
                WebSocket URL of your running OpenClaw Gateway instance.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" htmlFor="api-key">
                Gateway API Key
              </label>
              <Input
                id="api-key"
                type="password"
                placeholder="oc_key_..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleConnect()}
              />
              <p className="text-xs text-muted-foreground">
                Authenticates this Hub client with your Gateway. Find it in your
                Gateway config.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={handleConnect} className="gap-2">
                <Wifi className="h-4 w-4" />
                Connect
              </Button>

              <div className="relative flex items-center py-2">
                <div className="flex-1 border-t" />
                <span className="px-3 text-xs text-muted-foreground">or</span>
                <div className="flex-1 border-t" />
              </div>

              <Button
                variant="outline"
                onClick={handleMock}
                className="gap-2"
              >
                <FlaskConical className="h-4 w-4" />
                Use Mock Data
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Try the app with simulated agents — no Gateway needed.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
