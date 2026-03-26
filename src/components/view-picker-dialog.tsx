"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useViewStore } from "@/stores/view-store"
import { useTabStore } from "@/stores/tab-store"
import {
  Bot,
  Kanban,
  MessageSquare,
  Building2,
  Sparkles,
  Wand2,
  Loader2,
  Trash2,
} from "lucide-react"
import { useGatewayStore } from "@/stores/gateway-store"
import { uid } from "@/lib/mock-data"

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  bot: Bot,
  kanban: Kanban,
  "message-square": MessageSquare,
  "building-2": Building2,
  sparkles: Sparkles,
}

interface ViewPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ViewPickerDialog({
  open,
  onOpenChange,
}: ViewPickerDialogProps) {
  const [aiPrompt, setAiPrompt] = useState("")
  const [generating, setGenerating] = useState(false)
  const views = useViewStore((s) => s.views)
  const removeView = useViewStore((s) => s.removeView)
  const registerView = useViewStore((s) => s.registerView)
  const openTab = useTabStore((s) => s.openTab)
  const send = useGatewayStore((s) => s.send)
  const connected = useGatewayStore((s) => s.connected)

  const builtInViews = views.filter((v) => v.type === "built-in")
  const aiViews = views.filter((v) => v.type === "ai-generated")

  function handleOpenView(viewId: string, title: string, icon?: string) {
    openTab(viewId, title, icon)
    onOpenChange(false)
  }

  async function handleGenerate() {
    if (!aiPrompt.trim() || !connected) return
    setGenerating(true)

    const requestId = uid()
    const viewId = `ai-${requestId}`

    // Listen for the response
    const unsub = useGatewayStore.subscribe((state, prevState) => {
      // Check for view.generated events - we handle this through the store
      // For now, just register the view after a delay (mock behavior)
      void state
      void prevState
    })

    send({ type: "view.generate", prompt: aiPrompt.trim(), requestId })

    // For MVP, we use a simple timeout approach
    // The mock gateway will respond, and we listen via a one-time handler
    // In production, this would be event-driven via the store
    setTimeout(() => {
      unsub()
      const newView = {
        id: viewId,
        title: aiPrompt.trim().slice(0, 40),
        icon: "sparkles",
        type: "ai-generated" as const,
        code: "", // Will be populated by gateway response
        createdAt: Date.now(),
      }
      registerView(newView)
      openTab(viewId, newView.title, "sparkles")
      setGenerating(false)
      setAiPrompt("")
      onOpenChange(false)
    }, 3000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Open View</DialogTitle>
          <DialogDescription>
            Choose a built-in view or generate one with AI.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6 py-2">
          {/* Built-in views */}
          <div>
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">
              Built-in Views
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {builtInViews.map((view) => {
                const Icon = ICON_MAP[view.icon] ?? Sparkles
                return (
                  <button
                    key={view.id}
                    onClick={() =>
                      handleOpenView(view.id, view.title, view.icon)
                    }
                    className="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent cursor-pointer"
                  >
                    <Icon className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium">{view.title}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* AI-generated views */}
          {aiViews.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                AI-Generated Views
              </h3>
              <div className="flex flex-col gap-1">
                {aiViews.map((view) => (
                  <div
                    key={view.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <button
                      onClick={() =>
                        handleOpenView(view.id, view.title, view.icon)
                      }
                      className="flex items-center gap-3 text-left cursor-pointer"
                    >
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="text-sm">{view.title}</span>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => removeView(view.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Generator */}
          <div>
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">
              Generate with AI
            </h3>
            <div className="flex gap-2">
              <textarea
                placeholder="Describe the view you want, e.g. 'Token usage chart by agent for the last 24 hours'"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="flex-1 resize-none rounded-md border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                rows={2}
              />
              <Button
                onClick={handleGenerate}
                disabled={!aiPrompt.trim() || generating || !connected}
                className="gap-2 self-end"
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                Generate
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
