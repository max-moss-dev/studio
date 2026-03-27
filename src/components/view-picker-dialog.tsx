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
  Download,
  Share2,
  Link,
  Check,
  AlertCircle,
  Puzzle,
} from "lucide-react"
import { useGatewayStore } from "@/stores/gateway-store"
import { uid } from "@/lib/mock-data"

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  bot: Bot,
  kanban: Kanban,
  "message-square": MessageSquare,
  "building-2": Building2,
  sparkles: Sparkles,
  puzzle: Puzzle,
  link: Link,
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
  const [pluginUrl, setPluginUrl] = useState("")
  const [copied, setCopied] = useState<string | null>(null)

  const views = useViewStore((s) => s.views)
  const removeView = useViewStore((s) => s.removeView)
  const registerView = useViewStore((s) => s.registerView)
  const installPlugin = useViewStore((s) => s.installPlugin)
  const exportPlugin = useViewStore((s) => s.exportPlugin)
  const installing = useViewStore((s) => s.installing)
  const installError = useViewStore((s) => s.installError)
  const clearInstallError = useViewStore((s) => s.clearInstallError)

  const openTab = useTabStore((s) => s.openTab)
  const send = useGatewayStore((s) => s.send)
  const connected = useGatewayStore((s) => s.connected)

  const builtInViews = views.filter((v) => v.type === "built-in")
  const aiViews = views.filter((v) => v.type === "ai-generated")
  const plugins = views.filter((v) => v.type === "plugin")

  function handleOpenView(viewId: string, title: string, icon?: string) {
    openTab(viewId, title, icon)
    onOpenChange(false)
  }

  async function handleInstallPlugin() {
    if (!pluginUrl.trim()) return
    clearInstallError()
    try {
      const view = await installPlugin(pluginUrl.trim())
      openTab(view.id, view.title, view.icon)
      setPluginUrl("")
      onOpenChange(false)
    } catch {
      // Error is set in the store
    }
  }

  function handleExportPlugin(id: string) {
    const json = exportPlugin(id)
    if (json) {
      navigator.clipboard.writeText(json)
      setCopied(id)
      setTimeout(() => setCopied(null), 2000)
    }
  }

  async function handleGenerate() {
    if (!aiPrompt.trim() || !connected) return
    setGenerating(true)

    const requestId = uid()
    const viewId = `ai-${requestId}`

    const unsub = useGatewayStore.subscribe((state, prevState) => {
      void state
      void prevState
    })

    send({ type: "view.generate", prompt: aiPrompt.trim(), requestId })

    setTimeout(() => {
      unsub()
      const newView = {
        id: viewId,
        title: aiPrompt.trim().slice(0, 40),
        icon: "sparkles",
        type: "ai-generated" as const,
        code: "",
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
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Open View</DialogTitle>
          <DialogDescription>
            Choose a built-in view, install a plugin, or generate one with AI.
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

          {/* Installed plugins */}
          {plugins.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                Installed Plugins
              </h3>
              <div className="flex flex-col gap-1">
                {plugins.map((view) => {
                  const Icon = ICON_MAP[view.icon] ?? Puzzle
                  return (
                    <div
                      key={view.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <button
                        onClick={() =>
                          handleOpenView(view.id, view.title, view.icon)
                        }
                        className="flex items-center gap-3 text-left cursor-pointer flex-1 min-w-0"
                      >
                        <Icon className="h-4 w-4 text-primary shrink-0" />
                        <div className="min-w-0">
                          <span className="text-sm font-medium block truncate">
                            {view.title}
                          </span>
                          {view.description && (
                            <span className="text-xs text-muted-foreground block truncate">
                              {view.description}
                            </span>
                          )}
                        </div>
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        {view.version && (
                          <span className="text-xs text-muted-foreground mr-1">
                            v{view.version}
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Copy plugin JSON"
                          onClick={() => handleExportPlugin(view.id)}
                        >
                          {copied === view.id ? (
                            <Check className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <Share2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => removeView(view.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Install from URL */}
          <div>
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">
              Install Plugin
            </h3>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="url"
                  placeholder="Paste plugin URL..."
                  value={pluginUrl}
                  onChange={(e) => {
                    setPluginUrl(e.target.value)
                    if (installError) clearInstallError()
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleInstallPlugin()
                  }}
                  className="w-full rounded-md border bg-transparent pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <Button
                onClick={handleInstallPlugin}
                disabled={!pluginUrl.trim() || installing}
                className="gap-2 shrink-0"
              >
                {installing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Install
              </Button>
            </div>
            {installError && (
              <div className="flex items-center gap-2 mt-2 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{installError}</span>
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Paste a GitHub repo, gist, or direct URL.
              Plugins are a <code className="rounded bg-muted px-1 py-0.5">plugin.json</code> +
              a <code className="rounded bg-muted px-1 py-0.5">.tsx</code> source file.
            </p>
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
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Copy as plugin JSON"
                        onClick={() => handleExportPlugin(view.id)}
                      >
                        {copied === view.id ? (
                          <Check className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <Share2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removeView(view.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
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
