"use client"

import { useState, useEffect, useCallback } from "react"
import {
  SandpackProvider,
  SandpackCodeEditor,
  SandpackPreview,
  useSandpack,
} from "@codesandbox/sandpack-react"
import { Button } from "@/components/ui/button"
import { useViewStore } from "@/stores/view-store"
import { useTabStore } from "@/stores/tab-store"
import { useGateway } from "@/hooks/use-gateway"
import {
  BRIDGE_SOURCE,
  APP_WRAPPER_SOURCE,
  INDEX_SOURCE,
  HTML_TEMPLATE,
} from "@/lib/sandpack-bridge"
import type { ViewMessage } from "@/lib/sandpack-bridge"
import {
  Save,
  Play,
  Code,
  FileJson,
  Copy,
  Check,
  Download,
  Eye,
  EyeOff,
  Package,
} from "lucide-react"

/**
 * Bridge that pushes ViewProps into the Sandpack preview iframe.
 */
function PreviewBridge({
  viewProps,
  onSend,
}: {
  viewProps: Record<string, unknown>
  onSend?: (msg: import("@/lib/types").GatewayMessage) => void
}) {
  useEffect(() => {
    function handler(e: MessageEvent) {
      if (!e.data || typeof e.data.type !== "string") return
      const msg = e.data as ViewMessage

      if (msg.type === "ready") {
        // Find the Sandpack preview iframe and send props
        const iframe = document.querySelector(
          ".sp-preview-iframe"
        ) as HTMLIFrameElement | null
        if (iframe?.contentWindow) {
          iframe.contentWindow.postMessage(
            { type: "props", data: viewProps },
            "*"
          )
        }
      }

      if (msg.type === "send" && onSend) {
        onSend(msg.payload)
      }
    }

    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [viewProps, onSend])

  // Also push props whenever they change
  useEffect(() => {
    const iframe = document.querySelector(
      ".sp-preview-iframe"
    ) as HTMLIFrameElement | null
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(
        { type: "props", data: viewProps },
        "*"
      )
    }
  }, [viewProps])

  return null
}

/**
 * Component that extracts current code from Sandpack for saving.
 */
function SaveBridge({
  onCodeChange,
}: {
  onCodeChange: (code: string) => void
}) {
  const { sandpack } = useSandpack()

  useEffect(() => {
    const code = sandpack.files["/view.tsx"]?.code
    if (code !== undefined) {
      onCodeChange(code)
    }
  }, [sandpack.files, onCodeChange])

  return null
}

export default function CodeEditorView({ viewId }: { viewId?: string }) {
  const views = useViewStore((s) => s.views)
  const registerView = useViewStore((s) => s.registerView)
  const exportPackage = useViewStore((s) => s.exportPackage)
  const openTab = useTabStore((s) => s.openTab)
  const { agents, events, tasks, messages, send, models } = useGateway()

  const view = viewId ? views.find((v) => v.id === viewId) : null
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showJson, setShowJson] = useState(false)
  const [showPreview, setShowPreview] = useState(true)
  const [currentCode, setCurrentCode] = useState(view?.code ?? "")

  useEffect(() => {
    if (view?.code) {
      setCurrentCode(view.code)
    }
  }, [view?.code])

  const handleCodeChange = useCallback((code: string) => {
    setCurrentCode(code)
  }, [])

  function handleSave() {
    if (!view) return
    registerView({
      ...view,
      code: currentCode,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handlePreview() {
    if (!view) return
    handleSave()
    openTab(view.id, view.title, view.icon)
  }

  function handleCopyJson() {
    if (!view) return
    const json = exportPackage(view.id)
    if (json) {
      navigator.clipboard.writeText(json)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function handleDownloadJson() {
    if (!view) return
    const json = exportPackage(view.id)
    if (!json) return
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${view.id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!view) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Code className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No view selected for editing</p>
        </div>
      </div>
    )
  }

  if (!view.code) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Code className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">This view has no editable code</p>
        </div>
      </div>
    )
  }

  const viewProps = { agents, events, tasks, messages, models }

  // Build file map for Sandpack
  const files: Record<string, string> = {
    "/bridge.tsx": BRIDGE_SOURCE,
    "/App.tsx": APP_WRAPPER_SOURCE,
    "/index.tsx": INDEX_SOURCE,
    "/view.tsx": view.code,
    "/public/index.html": HTML_TEMPLATE,
  }

  const deps: Record<string, string> = {
    react: "^18.2.0",
    "react-dom": "^18.2.0",
    ...view.dependencies,
  }

  // JSON view
  if (showJson) {
    const json = exportPackage(view.id)
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b px-4 py-2 shrink-0">
          <FileJson className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium flex-1">
            {view.title} — ViewPackage JSON
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={handleCopyJson}
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied!" : "Copy"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={handleDownloadJson}
          >
            <Download className="h-3 w-3" />
            Download
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => setShowJson(false)}
          >
            <Code className="h-3 w-3" />
            Back to Editor
          </Button>
        </div>
        <pre className="flex-1 p-4 bg-[#282c34] text-[#abb2bf] overflow-auto font-mono text-sm leading-relaxed">
          {json}
        </pre>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b px-4 py-2 shrink-0">
        <Code className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium flex-1">{view.title}</span>

        {view.dependencies && Object.keys(view.dependencies).length > 0 && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-1 mr-2">
            <Package className="h-3 w-3" />
            {Object.keys(view.dependencies).join(", ")}
          </span>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => setShowPreview(!showPreview)}
        >
          {showPreview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          {showPreview ? "Hide Preview" : "Show Preview"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => setShowJson(true)}
        >
          <FileJson className="h-3 w-3" />
          JSON
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={handleSave}
        >
          <Save className="h-3 w-3" />
          {saved ? "Saved!" : "Save"}
        </Button>
        <Button
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={handlePreview}
        >
          <Play className="h-3 w-3" />
          Open View
        </Button>
      </div>

      {/* Editor + Preview */}
      <div className="flex-1 overflow-hidden">
        <SandpackProvider
          template="react-ts"
          files={files}
          customSetup={{
            dependencies: deps,
            entry: "/index.tsx",
          }}
          options={{
            activeFile: "/view.tsx",
            visibleFiles: ["/view.tsx"],
            classes: {
              "sp-wrapper": "!h-full",
              "sp-layout": "!h-full !border-0 !rounded-none",
            },
          }}
          theme={{
            colors: {
              surface1: "#282c34",
              surface2: "#2c313a",
              surface3: "#3e4451",
              clickable: "#abb2bf",
              base: "#abb2bf",
              disabled: "#5c6370",
              hover: "#61afef",
              accent: "#61afef",
              error: "#e06c75",
              errorSurface: "#3b1d22",
            },
            syntax: {
              plain: "#abb2bf",
              comment: { color: "#5c6370", fontStyle: "italic" },
              keyword: "#c678dd",
              tag: "#e06c75",
              punctuation: "#abb2bf",
              definition: "#61afef",
              property: "#e5c07b",
              static: "#d19a66",
              string: "#98c379",
            },
            font: {
              body: 'system-ui, -apple-system, sans-serif',
              mono: '"JetBrains Mono", "Fira Code", monospace',
              size: "13px",
              lineHeight: "1.6",
            },
          }}
        >
          <SaveBridge onCodeChange={handleCodeChange} />
          <PreviewBridge viewProps={viewProps} onSend={send} />
          <div className={`flex h-full ${showPreview ? "" : ""}`}>
            <div className={showPreview ? "w-1/2 border-r" : "w-full"}>
              <SandpackCodeEditor
                showLineNumbers
                showTabs={false}
                style={{ height: "100%" }}
                wrapContent
              />
            </div>
            {showPreview && (
              <div className="w-1/2">
                <SandpackPreview
                  showOpenInCodeSandbox={false}
                  showRefreshButton
                  style={{ height: "100%" }}
                />
              </div>
            )}
          </div>
        </SandpackProvider>
      </div>
    </div>
  )
}
