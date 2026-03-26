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
import { Wifi, FlaskConical } from "lucide-react"

interface ConnectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ConnectionDialog({ open, onOpenChange }: ConnectionDialogProps) {
  const [url, setUrl] = useState("ws://localhost:18789")
  const [apiKey, setApiKey] = useState("")
  const connectGateway = useGatewayStore((s) => s.connectGateway)
  const connectMock = useGatewayStore((s) => s.connectMock)

  function handleConnect() {
    if (!url.trim()) return
    connectGateway(url.trim(), apiKey.trim())
    onOpenChange(false)
  }

  function handleMock() {
    connectMock()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect to Gateway</DialogTitle>
          <DialogDescription>
            Enter your OpenClaw Gateway URL and API key to connect.
          </DialogDescription>
        </DialogHeader>

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
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" htmlFor="api-key">
              API Key
            </label>
            <Input
              id="api-key"
              type="password"
              placeholder="Enter your API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConnect()}
            />
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

            <Button variant="outline" onClick={handleMock} className="gap-2">
              <FlaskConical className="h-4 w-4" />
              Use Mock Data
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
