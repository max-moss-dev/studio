"use client"

import { useEffect, lazy, Suspense } from "react"
import { Header } from "./header"
import { Button } from "@/components/ui/button"
import { useTabStore } from "@/stores/tab-store"
import { useViewStore } from "@/stores/view-store"
import { useGatewayStore, loadPersistedConfig, setViewStoreAccessors } from "@/stores/gateway-store"
import { useGateway } from "@/hooks/use-gateway"
import { Loader2, AlertTriangle, Radio, Code } from "lucide-react"
import { SandpackView } from "@/components/sandpack-view"
import { ViewErrorBoundary } from "@/components/error-boundary"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"

// Lazy load built-in views
const AgentManagerView = lazy(() => import("@/views/agent-manager"))
const KanbanView = lazy(() => import("@/views/kanban"))
const ChatsView = lazy(() => import("@/views/chats"))
const OfficeView = lazy(() => import("@/views/office"))
const SettingsView = lazy(() => import("@/views/settings"))
const ViewPickerView = lazy(() => import("@/views/view-picker"))
const MediaView = lazy(() => import("@/views/media"))
const TodoView = lazy(() => import("@/views/todo"))
const CodeEditorView = lazy(() => import("@/views/code-editor"))

function ViewFallback() {
  return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
}

function ViewError({ message }: { message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
      <AlertTriangle className="h-8 w-8 text-yellow-500" />
      <p className="text-sm font-medium">Failed to load view</p>
      <p className="text-xs max-w-md text-center">{message}</p>
    </div>
  )
}


// Error feedback — debounced, sends view errors to most recent agent conversation
let _viewErrorTimer: ReturnType<typeof setTimeout> | null = null
function sendViewErrorToAgent(viewId: string, error: string, send: (msg: import("@/lib/types").GatewayMessage) => void) {
  if (_viewErrorTimer) return
  _viewErrorTimer = setTimeout(() => { _viewErrorTimer = null }, 5000)

  const allMessages = useGatewayStore.getState().messages
  let lastAgentId: string | null = null
  let lastTimestamp = 0
  for (const [agentId, msgs] of Object.entries(allMessages)) {
    const last = msgs[msgs.length - 1]
    if (last && last.timestamp > lastTimestamp) {
      lastTimestamp = last.timestamp
      lastAgentId = agentId
    }
  }

  if (lastAgentId) {
    const errorMsg = `[View Error in "${viewId}"]\n\n${error}\n\nPlease fix the view code using view.update.`
    send({ type: "agent.message", agentId: lastAgentId, content: errorMsg })
    useGatewayStore.getState().addMessage(lastAgentId, {
      id: `err-${Date.now()}`,
      agentId: lastAgentId,
      role: "user",
      content: errorMsg,
      timestamp: Date.now(),
    })
  }
}

function ActiveView() {
  const activeTabId = useTabStore((s) => s.activeTabId)
  const tabs = useTabStore((s) => s.tabs)
  const openTab = useTabStore((s) => s.openTab)
  const views = useViewStore((s) => s.views)
  const { agents, events, tasks, messages, send, models } = useGateway()

  const activeTab = tabs.find((t) => t.id === activeTabId)
  if (!activeTab) return null

  const tabState = activeTab.state ?? {}
  const viewProps = { agents, events, tasks, messages, send, models }

  // Built-in views
  switch (activeTab.viewId) {
    case "agent-manager":
      return <Suspense fallback={<ViewFallback />}><AgentManagerView {...viewProps} initialAgentId={tabState.agentId as string} /></Suspense>
    case "kanban":
      return <Suspense fallback={<ViewFallback />}><KanbanView {...viewProps} /></Suspense>
    case "chats":
      return <Suspense fallback={<ViewFallback />}><ChatsView {...viewProps} initialAgentId={tabState.agentId as string} /></Suspense>
    case "office":
      return <Suspense fallback={<ViewFallback />}><OfficeView {...viewProps} /></Suspense>
    case "settings":
      return <Suspense fallback={<ViewFallback />}><SettingsView /></Suspense>
    case "view-picker":
      return <Suspense fallback={<ViewFallback />}><ViewPickerView /></Suspense>
    case "media":
      return <Suspense fallback={<ViewFallback />}><MediaView initialPath={tabState.path as string} /></Suspense>
    case "todo":
      return <Suspense fallback={<ViewFallback />}><TodoView /></Suspense>
    case "code-editor":
      return <Suspense fallback={<ViewFallback />}><CodeEditorView viewId={tabState.viewId as string} /></Suspense>
  }

  // Custom/AI-generated views — render in Sandpack iframe
  const viewDef = views.find((v: { id: string }) => v.id === activeTab.viewId)
  if (viewDef?.code) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b px-3 py-1.5 bg-muted/30 shrink-0">
          <span className="text-xs text-muted-foreground flex-1">
            {viewDef.type === "plugin" ? "Plugin" : "AI View"}: {activeTab.title}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 text-xs text-muted-foreground"
            onClick={() => openTab("code-editor", `Edit: ${activeTab.title}`, "code", { viewId: activeTab.viewId })}
          >
            <Code className="h-3 w-3" />
            Edit Code
          </Button>
        </div>
        <div className="flex-1 overflow-hidden">
          <SandpackView
            code={viewDef.code}
            dependencies={viewDef.dependencies}
            viewProps={viewProps}
            onSend={send}
            onError={(err) => sendViewErrorToAgent(activeTab.viewId, err, send)}
          />
        </div>
      </div>
    )
  }

  // Fallback — view registered but no code (shouldn't happen normally)
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
      <AlertTriangle className="h-8 w-8" />
      <p className="text-sm">View &quot;{activeTab.title}&quot; has no code</p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => openTab("code-editor", `Edit: ${activeTab.title}`, "code", { viewId: activeTab.viewId })}
      >
        Open Editor
      </Button>
    </div>
  )
}

function errorLabel(code: string): string {
  switch (code) {
    case "NOT_PAIRED":
    case "PAIRING_REQUIRED":
      return "Pairing required \u2014 approve this device on the gateway"
    case "AUTH_FAILED":
    case "UNAUTHORIZED":
      return "Authentication failed \u2014 check your API key"
    case "CONNECTION_FAILED":
      return "Could not connect to gateway"
    case "FETCH_FAILED":
      return "Connected but failed to load data"
    default:
      return code.replace(/_/g, " ").toLowerCase()
  }
}

function ConnectionErrorBanner() {
  const error = useGatewayStore((s) => s.connectionError)
  const clearError = useGatewayStore((s) => s.clearError)
  const connectGateway = useGatewayStore((s) => s.connectGateway)
  const url = useGatewayStore((s) => s.url)
  const apiKey = useGatewayStore((s) => s.apiKey)

  if (!error) return null

  const isPairing = error.code === "NOT_PAIRED" || error.code === "PAIRING_REQUIRED"

  return (
    <div className="flex items-center gap-3 border-b px-4 py-2 bg-[#e06c75]/10 border-[#e06c75]/20 shrink-0">
      <AlertTriangle className="h-4 w-4 text-[#e06c75] shrink-0" />
      <span className="text-xs text-[#e06c75] font-medium flex-1">
        {errorLabel(error.code)}
        {error.message && error.code !== error.message && (
          <span className="text-[#e06c75]/70 ml-2">\u2014 {error.message}</span>
        )}
      </span>
      <div className="flex items-center gap-2">
        {isPairing && (
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[10px] border-[#e06c75]/30 text-[#e06c75] hover:bg-[#e06c75]/10"
            onClick={() => {
              clearError()
              connectGateway(url, apiKey)
            }}
          >
            Retry
          </Button>
        )}
        <button
          className="text-[#e06c75]/50 hover:text-[#e06c75] text-xs leading-none px-1"
          onClick={clearError}
        >
          &#x2715;
        </button>
      </div>
    </div>
  )
}

function Footer() {
  const connected = useGatewayStore((s) => s.connected)
  const mockMode = useGatewayStore((s) => s.mockMode)
  const error = useGatewayStore((s) => s.connectionError)

  const statusColor = error
    ? "text-[#e06c75]"
    : connected
      ? "text-[#98c379]"
      : "text-muted-foreground"

  const statusText = error
    ? error.code.replace(/_/g, " ").toLowerCase()
    : connected
      ? mockMode
        ? "mock://localhost"
        : "ws://localhost:18789"
      : "disconnected"

  return (
    <footer className="flex h-7 items-center justify-between border-t bg-header-bg px-4 shrink-0">
      <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
        <Radio className={`h-2.5 w-2.5 ${statusColor}`} />
        <span className={error ? "text-[#e06c75]" : undefined}>
          {statusText}
        </span>
        <span className="text-border">|</span>
        <span>{connected ? "12ms" : "--"}</span>
      </div>
      <div className="text-[10px] text-muted-foreground">
        Studio v0.1.0
      </div>
    </footer>
  )
}

export function AppShell() {
  useKeyboardShortcuts()

  const connected = useGatewayStore((s) => s.connected)
  const connectGateway = useGatewayStore((s) => s.connectGateway)
  const connectMock = useGatewayStore((s) => s.connectMock)
  const openTab = useTabStore((s) => s.openTab)
  const tabs = useTabStore((s) => s.tabs)
  const setActiveTab = useTabStore((s) => s.setActiveTab)
  const registerView = useViewStore((s) => s.registerView)
  const getView = useViewStore((s) => s.getView)
  // Wire up view store accessors for the gateway tool proxy
  useEffect(() => {
    setViewStoreAccessors(
      (view) => registerView(view as unknown as import("@/lib/types").ViewDefinition),
      (id) => getView(id) as Record<string, unknown> | undefined
    )
  }, [registerView, getView])

  // Auto-connect on mount from persisted config
  useEffect(() => {
    const config = loadPersistedConfig()
    if (config) {
      if (config.mockMode) {
        connectMock()
      } else if (config.url) {
        connectGateway(config.url, config.apiKey)
      }
    } else {
      // No persisted config — open settings tab
      const existing = tabs.find((t) => t.viewId === "settings")
      if (existing) {
        setActiveTab(existing.id)
      } else {
        openTab("settings", "Settings", "settings")
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header />
      <ConnectionErrorBanner />
      <main className="flex-1 overflow-hidden">
        <ViewErrorBoundary>
          <ActiveView />
        </ViewErrorBoundary>
      </main>
      <Footer />
    </div>
  )
}
