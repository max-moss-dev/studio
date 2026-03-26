"use client"

import { useState, useEffect, lazy, Suspense } from "react"
import { Header } from "./header"
import { TabBar } from "./tab-bar"
import { ConnectionDialog } from "./connection-dialog"
import { ViewPickerDialog } from "./view-picker-dialog"
import { useTabStore } from "@/stores/tab-store"
import { useGatewayStore, loadPersistedConfig } from "@/stores/gateway-store"
import { useGateway } from "@/hooks/use-gateway"
import { Loader2 } from "lucide-react"

// Lazy load views
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

function ActiveView() {
  const activeTabId = useTabStore((s) => s.activeTabId)
  const tabs = useTabStore((s) => s.tabs)
  const { agents, events, tasks, messages, send } = useGateway()

  const activeTab = tabs.find((t) => t.id === activeTabId)
  if (!activeTab) return null

  const viewProps = { agents, events, tasks, messages, send }

  return (
    <Suspense fallback={<ViewFallback />}>
      {activeTab.viewId === "agent-manager" && (
        <AgentManagerView {...viewProps} />
      )}
      {activeTab.viewId === "kanban" && <KanbanView {...viewProps} />}
      {activeTab.viewId === "chats" && <ChatsView {...viewProps} />}
      {activeTab.viewId === "office" && <OfficeView {...viewProps} />}
      {activeTab.viewId.startsWith("ai-") && (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          AI View: {activeTab.title}
        </div>
      )}
    </Suspense>
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
