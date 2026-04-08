"use client"

import { useState } from "react"
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
  Settings,
  LayoutGrid,
  Copy,
  FileText,
  CheckCircle,
  Code,
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
  settings: Settings,
  "layout-grid": LayoutGrid,
  "file-text": FileText,
  "check-circle": CheckCircle,
  code: Code,
}

// Views that shouldn't appear in the picker
const HIDDEN_VIEWS = new Set(["settings", "view-picker"])

export default function ViewPickerView() {
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
  const activeTabId = useTabStore((s) => s.activeTabId)
  const closeTab = useTabStore((s) => s.closeTab)
  const send = useGatewayStore((s) => s.send)
  const connected = useGatewayStore((s) => s.connected)

  const builtInViews = views.filter((v) => v.type === "built-in" && !HIDDEN_VIEWS.has(v.id))
  const aiViews = views.filter((v) => v.type === "ai-generated")
  const plugins = views.filter((v) => v.type === "plugin")

  const [cloning, setCloning] = useState<string | null>(null)

  function handleOpenView(viewId: string, title: string, icon?: string) {
    openTab(viewId, title, icon)
    // Close the view-picker tab
    if (activeTabId) closeTab(activeTabId)
  }

  async function handleCloneView(viewId: string, title: string, icon?: string) {
    setCloning(viewId)
    try {
      // Fetch source code of built-in view
      const res = await fetch(`/api/views?id=${encodeURIComponent(viewId)}`)
      const data = await res.json()
      if (!data.code) {
        console.error("Failed to fetch view source")
        setCloning(null)
        return
      }

      // Generate a clean clone ID
      const cloneId = `${viewId}-copy-${Date.now().toString(36)}`

      // Write the file to disk via API
      const writeRes = await fetch("/api/views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cloneId, code: data.code }),
      })

      if (!writeRes.ok) {
        const err = await writeRes.json()
        console.error("Failed to write view:", err)
        setCloning(null)
        return
      }

      // Register in view store
      registerView({
        id: cloneId,
        title: `${title} (Copy)`,
        icon: icon ?? "sparkles",
        type: "ai-generated",
        createdAt: Date.now(),
      })

      openTab(cloneId, `${title} (Copy)`, icon)
      if (activeTabId) closeTab(activeTabId)
    } catch (err) {
      console.error("Clone failed:", err)
    }
    setCloning(null)
  }

  function handleEditCode(viewId: string) {
    openTab("code-editor", "Edit View", "code", { viewId })
    if (activeTabId) closeTab(activeTabId)
  }

  async function handleInstallPlugin() {
    if (!pluginUrl.trim()) return
    clearInstallError()
    try {
      const view = await installPlugin(pluginUrl.trim())
      openTab(view.id, view.title, view.icon)
      if (activeTabId) closeTab(activeTabId)
      setPluginUrl("")
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

    send({ type: "view.generate", prompt: aiPrompt.trim(), requestId })

    setTimeout(() => {
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
      if (activeTabId) closeTab(activeTabId)
      setGenerating(false)
      setAiPrompt("")
    }, 3000)
  }

  return (
    <div className="flex h-full items-start justify-center overflow-auto py-12">
      <div className="w-full max-w-lg flex flex-col gap-8">
        <div>
          <h2 className="text-lg font-semibold">Open View</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Choose a built-in view, install a plugin, or generate one with AI.
          </p>
        </div>

        {/* Built-in views */}
        <div>
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">
            Built-in Views
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {builtInViews.map((view) => {
              const Icon = ICON_MAP[view.icon] ?? Sparkles
              return (
                <div
                  key={view.id}
                  className="group flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent"
                >
                  <button
                    onClick={() => handleOpenView(view.id, view.title, view.icon)}
                    className="flex items-center gap-3 flex-1 cursor-pointer"
                  >
                    <Icon className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium">{view.title}</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCloneView(view.id, view.title, view.icon) }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-opacity cursor-pointer"
                    title="Clone as editable copy"
                  >
                    {cloning === view.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>
                </div>
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
                      onClick={() => handleOpenView(view.id, view.title, view.icon)}
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
                          <Check className="h-3.5 w-3.5 text-status-online" />
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
                    onClick={() => handleOpenView(view.id, view.title, view.icon)}
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
                      title="Edit code"
                      onClick={() => handleEditCode(view.id)}
                    >
                      <Code className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Copy as plugin JSON"
                      onClick={() => handleExportPlugin(view.id)}
                    >
                      {copied === view.id ? (
                        <Check className="h-3.5 w-3.5 text-status-online" />
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
              placeholder="Describe the view you want..."
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
    </div>
  )
}
