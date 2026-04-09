"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { useViewStore } from "@/stores/view-store"
import { useTabStore } from "@/stores/tab-store"
import {
  Bot,
  Kanban,
  MessageSquare,
  Share2 as NetworkIcon,
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
  Upload,
  ClipboardPaste,
} from "lucide-react"
import { useGatewayStore } from "@/stores/gateway-store"
import { uid } from "@/lib/mock-data"

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  bot: Bot,
  kanban: Kanban,
  "message-square": MessageSquare,
  "share-2": NetworkIcon,
  "building-2": NetworkIcon,
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
  const [importJson, setImportJson] = useState("")
  const [importError, setImportError] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)

  const views = useViewStore((s) => s.views)
  const removeView = useViewStore((s) => s.removeView)
  const registerView = useViewStore((s) => s.registerView)
  const installPlugin = useViewStore((s) => s.installPlugin)
  const exportPackage = useViewStore((s) => s.exportPackage)
  const importPackage = useViewStore((s) => s.importPackage)
  const importPackageFromUrl = useViewStore((s) => s.importPackageFromUrl)
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

  // Track pending AI generation
  const pendingRequestRef = useRef<string | null>(null)

  // Watch for view.generated events
  useEffect(() => {
    if (!pendingRequestRef.current) return

    const viewId = `ai-${pendingRequestRef.current}`
    const view = views.find((v) => v.id === viewId && v.code)
    if (view) {
      // View was generated — open it
      openTab(viewId, view.title, "sparkles")
      if (activeTabId) closeTab(activeTabId)
      setGenerating(false)
      setAiPrompt("")
      pendingRequestRef.current = null
    }
  }, [views, activeTabId, closeTab, openTab])

  function handleOpenView(viewId: string, title: string, icon?: string) {
    openTab(viewId, title, icon)
    if (activeTabId) closeTab(activeTabId)
  }

  function handleEditCode(viewId: string) {
    openTab("code-editor", "Edit View", "code", { viewId })
    if (activeTabId) closeTab(activeTabId)
  }

  async function handleInstallPlugin() {
    if (!pluginUrl.trim()) return
    clearInstallError()

    const url = pluginUrl.trim()

    // Try as ViewPackage JSON URL first if it looks like JSON
    try {
      if (url.endsWith(".json") || !url.includes("github.com")) {
        const view = await importPackageFromUrl(url)
        openTab(view.id, view.title, view.icon)
        if (activeTabId) closeTab(activeTabId)
        setPluginUrl("")
        return
      }
    } catch {
      // Fall through to plugin install
    }

    try {
      const view = await installPlugin(url)
      openTab(view.id, view.title, view.icon)
      if (activeTabId) closeTab(activeTabId)
      setPluginUrl("")
    } catch {
      // Error is set in the store
    }
  }

  function handleExport(id: string) {
    const json = exportPackage(id)
    if (json) {
      navigator.clipboard.writeText(json)
      setCopied(id)
      setTimeout(() => setCopied(null), 2000)
    }
  }

  function handleExportDownload(id: string) {
    const json = exportPackage(id)
    if (!json) return
    const view = views.find((v) => v.id === id)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${view?.id ?? "view"}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImport() {
    setImportError(null)
    try {
      const view = importPackage(importJson)
      openTab(view.id, view.title, view.icon)
      if (activeTabId) closeTab(activeTabId)
      setImportJson("")
      setShowImport(false)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Invalid JSON")
    }
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result as string
      setImportError(null)
      try {
        const view = importPackage(text)
        openTab(view.id, view.title, view.icon)
        if (activeTabId) closeTab(activeTabId)
        setShowImport(false)
      } catch (err) {
        setImportError(err instanceof Error ? err.message : "Invalid JSON file")
        setImportJson(text)
      }
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  function handleGenerate() {
    if (!aiPrompt.trim() || !connected) return
    setGenerating(true)

    const requestId = uid()
    pendingRequestRef.current = requestId

    send({ type: "view.generate", prompt: aiPrompt.trim(), requestId })

    // Timeout — if no response in 30s, show error
    setTimeout(() => {
      if (pendingRequestRef.current === requestId) {
        setGenerating(false)
        pendingRequestRef.current = null
      }
    }, 30000)
  }

  return (
    <div className="flex h-full items-start justify-center overflow-auto py-12">
      <div className="w-full max-w-lg flex flex-col gap-8">
        <div>
          <h2 className="text-lg font-semibold">Open View</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Choose a built-in view, import a package, or generate one with AI.
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
                <button
                  key={view.id}
                  onClick={() => handleOpenView(view.id, view.title, view.icon)}
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
                    onClick={() => handleOpenView(view.id, view.title, view.icon)}
                    className="flex items-center gap-3 text-left cursor-pointer flex-1 min-w-0"
                  >
                    <Sparkles className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm truncate">{view.title}</span>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
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
                      title="Copy as JSON"
                      onClick={() => handleExport(view.id)}
                    >
                      {copied === view.id ? (
                        <Check className="h-3.5 w-3.5 text-[#98c379]" />
                      ) : (
                        <Share2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Download JSON"
                      onClick={() => handleExportDownload(view.id)}
                    >
                      <Download className="h-3.5 w-3.5" />
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
                        title="Copy as JSON"
                        onClick={() => handleExport(view.id)}
                      >
                        {copied === view.id ? (
                          <Check className="h-3.5 w-3.5 text-[#98c379]" />
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
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleGenerate()
                }
              }}
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
          {generating && (
            <p className="text-xs text-muted-foreground mt-2 animate-pulse">
              Generating view...
            </p>
          )}
        </div>

        {/* Import / Install */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-muted-foreground">
              Import View
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs gap-1"
              onClick={() => setShowImport(!showImport)}
            >
              <ClipboardPaste className="h-3 w-3" />
              {showImport ? "Hide" : "Paste JSON"}
            </Button>
          </div>

          {/* URL install */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="url"
                placeholder="URL to JSON package or plugin..."
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

          {/* JSON paste import */}
          {showImport && (
            <div className="mt-3 flex flex-col gap-2">
              <textarea
                placeholder='Paste ViewPackage JSON here...'
                value={importJson}
                onChange={(e) => {
                  setImportJson(e.target.value)
                  setImportError(null)
                }}
                className="w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                rows={4}
              />
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleImport}
                  disabled={!importJson.trim()}
                  size="sm"
                  className="gap-1.5"
                >
                  <ClipboardPaste className="h-3.5 w-3.5" />
                  Import JSON
                </Button>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportFile}
                    className="hidden"
                  />
                  <Button variant="outline" size="sm" className="gap-1.5 pointer-events-none">
                    <Upload className="h-3.5 w-3.5" />
                    Upload .json
                  </Button>
                </label>
              </div>
              {importError && (
                <div className="flex items-center gap-2 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
