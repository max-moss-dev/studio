"use client"

import { useState, useEffect, useMemo, lazy, Suspense } from "react"
import { Header } from "./header"
import { TabBar } from "./tab-bar"
import { ConnectionDialog } from "./connection-dialog"
import { ViewPickerDialog } from "./view-picker-dialog"
import { useTabStore } from "@/stores/tab-store"
import { useViewStore } from "@/stores/view-store"
import { useGatewayStore, loadPersistedConfig } from "@/stores/gateway-store"
import { useGateway } from "@/hooks/use-gateway"
import { compileView } from "@/lib/ai-compiler"
import { Loader2, AlertTriangle } from "lucide-react"

// Lazy load built-in views
const AgentManagerView = lazy(() => import("@/views/agent-manager"))
const KanbanView = lazy(() => import("@/views/kanban"))
const ChatsView = lazy(() => import("@/views/chats"))
const OfficeView = lazy(() => import("@/views/office"))

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

/**
 * Renders a plugin or AI-generated view by compiling its source code at runtime.
 */
function DynamicView({ viewId, viewProps }: { viewId: string; viewProps: Record<string, unknown> }) {
  const view = useViewStore((s) => s.getView(viewId))

  const compiled = useMemo(() => {
    if (!view?.code) return { Component: null, error: "No source code found for this view." }
    try {
      const Component = compileView(view.code)
      if (!Component) return { Component: null, error: "Compilation returned no component." }
      return { Component, error: null }
    } catch (err) {
      return { Component: null, error: err instanceof Error ? err.message : String(err) }
    }
  }, [view?.code])

  if (compiled.error) return <ViewError message={compiled.error} />
  if (!compiled.Component) return <ViewFallback />

  const Component = compiled.Component
  return <Component {...viewProps} />
}

function ActiveView() {
  const activeTabId = useTabStore((s) => s.activeTabId)
  const tabs = useTabStore((s) => s.tabs)
  const { agents, events, tasks, messages, send } = useGateway()

  const activeTab = tabs.find((t) => t.id === activeTabId)
  if (!activeTab) return null

  const viewProps = { agents, events, tasks, messages, send }

  // Built-in views
  if (activeTab.viewId === "agent-manager") {
    return <Suspense fallback={<ViewFallback />}><AgentManagerView {...viewProps} /></Suspense>
  }
  if (activeTab.viewId === "kanban") {
    return <Suspense fallback={<ViewFallback />}><KanbanView {...viewProps} /></Suspense>
  }
  if (activeTab.viewId === "chats") {
    return <Suspense fallback={<ViewFallback />}><ChatsView {...viewProps} /></Suspense>
  }
  if (activeTab.viewId === "office") {
    return <Suspense fallback={<ViewFallback />}><OfficeView {...viewProps} /></Suspense>
  }

  // Plugin or AI-generated views — compile and render at runtime
  if (activeTab.viewId.startsWith("plugin-") || activeTab.viewId.startsWith("ai-")) {
    return <DynamicView viewId={activeTab.viewId} viewProps={viewProps} />
  }

  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      Unknown view: {activeTab.viewId}
    </div>
  )
}

export function AppShell() {
  const [showViewPicker, setShowViewPicker] = useState(false)
  const connected = useGatewayStore((s) => s.connected)
  const connectGateway = useGatewayStore((s) => s.connectGateway)
  const connectMock = useGatewayStore((s) => s.connectMock)
  const [showConnection, setShowConnection] = useState(false)

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
      setShowConnection(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header onOpenSettings={() => setShowConnection(true)} />
      <TabBar onNewTab={() => setShowViewPicker(true)} />
      <main className="flex-1 overflow-hidden">
        {connected ? (
          <ActiveView />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
            <p className="text-sm">Connect to a Gateway to get started</p>
            <button
              onClick={() => setShowConnection(true)}
              className="text-sm text-primary hover:underline cursor-pointer"
            >
              Open Connection Settings
            </button>
          </div>
        )}
      </main>

      <ConnectionDialog
        open={showConnection}
        onOpenChange={setShowConnection}
      />
      <ViewPickerDialog
        open={showViewPicker}
        onOpenChange={setShowViewPicker}
      />
    </div>
  )
}
