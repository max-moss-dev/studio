"use client"

/**
 * OrchestratorSidebar — global persistent chat sidebar for the Studio orchestrator agent.
 *
 * Always visible across all views. The user's primary interface for coordinating agents,
 * creating tasks, opening views, and delegating work across the workspace.
 */

import { useEffect, useRef, useState, useCallback } from "react"
import { Bot, Send, Loader2, GripVertical, Zap, Terminal, MessageSquare, Users, ChevronLeft, Layers, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useGatewayStore } from "@/stores/gateway-store"
import { useOrchestratorStore, ORCHESTRATOR_AGENT_ID } from "@/stores/orchestrator-store"
import { MessageRow } from "@/components/chat/message-row"
import { ORCHESTRATOR_PROMPT } from "@studio/core"
import { uid } from "@/lib/mock-data"
import type { Message } from "@/lib/types"
import { loadProviders, type ProviderId } from "@/lib/providers"
import { useTabStore } from "@/stores/tab-store"

const PROVIDER_META: Record<ProviderId, { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string; label: string }> = {
  openclaw: { icon: Zap, color: "#61afef", label: "OpenClaw" },
  opencode: { icon: Terminal, color: "#e5c07b", label: "OpenCode" },
}

const MIN_WIDTH = 320
const MAX_WIDTH = 600
const DEFAULT_WIDTH = 380
const COLLAPSED_WIDTH = 48

export function OrchestratorSidebar() {
  const isOpen = useOrchestratorStore((s) => s.isOpen)
  const toggle = useOrchestratorStore((s) => s.toggle)
  const sessionId = useOrchestratorStore((s) => s.sessionId)
  const setSessionId = useOrchestratorStore((s) => s.setSessionId)
  const openTab = useTabStore((s) => s.openTab)

  const sessions = useGatewayStore((s) => s.sessions)
  const createSession = useGatewayStore((s) => s.createSession)
  const addMessage = useGatewayStore((s) => s.addMessage)
  const send = useGatewayStore((s) => s.send)
  const allMessages = useGatewayStore((s) => s.messages)
  const agents = useGatewayStore((s) => s.agents)
  const connected = useGatewayStore((s) => s.connected)

  const [input, setInput] = useState("")
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const [isResizing, setIsResizing] = useState(false)
  const [showProviders, setShowProviders] = useState(false)
  const [mounted, setMounted] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const promptSentRef = useRef(false)
  const sidebarRef = useRef<HTMLDivElement>(null)

  // Avoid hydration mismatch by loading providers only after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  const providers = mounted ? loadProviders() : { openclaw: { enabled: false }, opencode: { enabled: false } }
  const enabledProviders = (Object.keys(providers) as ProviderId[]).filter((id) => providers[id].enabled)
  const providerMeta = enabledProviders[0] ? PROVIDER_META[enabledProviders[0]] : null
  const orchestratorAgent = agents.find((a) => a.id === ORCHESTRATOR_AGENT_ID)

  const startResizing = useCallback(() => setIsResizing(true), [])
  const stopResizing = useCallback(() => setIsResizing(false), [])

  const resize = useCallback(
    (e: MouseEvent) => {
      if (isResizing && sidebarRef.current) {
        const newWidth = e.clientX
        if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
          setWidth(newWidth)
        }
      }
    },
    [isResizing]
  )

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", resize)
      window.addEventListener("mouseup", stopResizing)
    }
    return () => {
      window.removeEventListener("mousemove", resize)
      window.removeEventListener("mouseup", stopResizing)
    }
  }, [isResizing, resize, stopResizing])

  useEffect(() => {
    if (sessionId) {
      const exists = sessions.some((s) => s.id === sessionId)
      if (exists) return
    }
    const newId = createSession(ORCHESTRATOR_AGENT_ID, "Studio Orchestrator")
    setSessionId(newId)
  }, [])

  const agentMessages = allMessages[ORCHESTRATOR_AGENT_ID] ?? []
  const messages = sessionId
    ? agentMessages.filter((m) => !m.sessionId || m.sessionId === sessionId)
    : agentMessages

  const isStreaming = messages.some((m) => m.isStreaming)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  function resizeTextarea() {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = "auto"
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || !sessionId) return

    setInput("")
    if (textareaRef.current) textareaRef.current.style.height = "auto"

    const userMsg: Message = {
      id: uid(),
      agentId: ORCHESTRATOR_AGENT_ID,
      sessionId,
      role: "user",
      content: text,
      timestamp: Date.now(),
    }
    addMessage(ORCHESTRATOR_AGENT_ID, userMsg)

    let content = text
    if (!promptSentRef.current) {
      promptSentRef.current = true
      content = `[System: ${ORCHESTRATOR_PROMPT}]\n\n${text}`
    }

    send({
      type: "agent.message",
      agentId: ORCHESTRATOR_AGENT_ID,
      sessionId,
      content,
    })
  }

  const currentWidth = isOpen ? width : COLLAPSED_WIDTH

  // Prevent hydration mismatch by not rendering content that depends on client-side data until mounted
  if (!mounted) {
    return (
      <aside
        ref={sidebarRef}
        className="flex flex-col border-r bg-background shrink-0 overflow-hidden relative h-full"
        style={{ width: currentWidth, transition: "width 200ms ease" }}
      >
        {/* Skeleton for collapsed state */}
        {!isOpen && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-center h-11 border-b">
              <div className="h-5 w-5 bg-muted rounded" />
            </div>
          </div>
        )}
        {/* Skeleton for open state */}
        {isOpen && (
          <>
            <div className="flex items-center gap-2 border-b px-3 py-2 shrink-0 bg-header-bg h-11">
              <div className="h-5 w-5 bg-muted rounded" />
              <div className="h-4 w-16 bg-muted rounded" />
            </div>
            <div className="flex-1" />
          </>
        )}
      </aside>
    )
  }

  return (
    <aside
      ref={sidebarRef}
      className="flex flex-col border-r bg-background shrink-0 overflow-hidden relative h-full"
      style={{ width: currentWidth, transition: isResizing ? "none" : "width 200ms ease" }}
    >
      {/* Resize handle */}
      {isOpen && (
        <div
          className="absolute right-0 top-0 bottom-0 w-4 cursor-col-resize z-50 flex items-center justify-center hover:bg-accent/50 opacity-0 hover:opacity-100 transition-opacity"
          onMouseDown={startResizing}
          title="Drag to resize"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      )}

      {/* Collapsed state */}
      {!isOpen && (
        <div className="flex flex-col h-full">
          {/* Logo button to open */}
          <button
            onClick={toggle}
            className="flex items-center justify-center h-11 border-b hover:bg-accent transition-colors"
            title="Open Studio"
          >
            <Layers className="h-5 w-5 text-[#61afef]" />
          </button>
          
          <div className="flex-1 flex flex-col items-center py-3 gap-3">
            {providerMeta && (
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: providerMeta.color }}
                title={`Active: ${providerMeta.label}`}
              />
            )}
          </div>
        </div>
      )}

      {isOpen && (
        <>
          {/* Header with Logo and collapse */}
          <div className="flex items-center gap-2 border-b px-3 py-2 shrink-0 bg-header-bg h-11">
            <button
              onClick={toggle}
              className="flex items-center gap-2 hover:bg-accent/50 px-2 py-1 rounded transition-colors"
              title="Collapse sidebar"
            >
              <Layers className="h-5 w-5 text-[#61afef]" />
              <span className="text-[15px] font-semibold text-secondary-foreground">Studio</span>
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            
            <div className="flex-1" />
            
            {messages.length > 0 && (
              <button
                onClick={() => {
                  if (confirm("Clear all messages?")) {
                    const state = useGatewayStore.getState()
                    state.messages[ORCHESTRATOR_AGENT_ID] = []
                    state.addMessage(ORCHESTRATOR_AGENT_ID, {
                      id: uid(),
                      agentId: ORCHESTRATOR_AGENT_ID,
                      sessionId: sessionId ?? undefined,
                      role: "assistant",
                      content: "Chat cleared. How can I help you?",
                      timestamp: Date.now(),
                    })
                  }
                }}
                className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title="Clear chat"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            
            {isStreaming && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          {/* Model & Provider Info */}
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b bg-muted/20 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {providerMeta && (
                <div
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] shrink-0"
                  style={{
                    backgroundColor: `${providerMeta.color}15`,
                    color: providerMeta.color,
                  }}
                >
                  <providerMeta.icon className="h-3 w-3" />
                  <span>{providerMeta.label}</span>
                </div>
              )}
              {orchestratorAgent?.model && (
                <span className="text-[10px] text-muted-foreground truncate max-w-[150px]" title={orchestratorAgent.model}>
                  {orchestratorAgent.model}
                </span>
              )}
            </div>
          </div>

          {/* Actions Bar */}
          <div className="flex items-center gap-1 px-2 py-1 border-b shrink-0">
            <button
              onClick={() => openTab("agent-manager", "Agents", "bot")}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] hover:bg-accent transition-colors"
              title="Agents"
            >
              <Users className="h-3 w-3" />
              <span>{agents.length}</span>
            </button>
            
            <button
              onClick={() => setShowProviders(!showProviders)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] transition-colors ${showProviders ? "bg-accent" : "hover:bg-accent"}`}
            >
              <Zap className="h-3 w-3" />
              <span className="hidden sm:inline">Providers</span>
            </button>
          </div>

          {/* Provider Details */}
          {showProviders && (
            <div className="border-b px-3 py-2 bg-muted/10 shrink-0">
              <div className="space-y-1.5">
                {enabledProviders.map((id) => {
                  const meta = PROVIDER_META[id]
                  const Icon = meta.icon
                  const p = providers[id]
                  return (
                    <div key={id} className="flex items-center gap-2 text-[11px]">
                      <div
                        className="flex h-5 w-5 items-center justify-center rounded"
                        style={{ backgroundColor: `${meta.color}15` }}
                      >
                        <Icon className="h-3 w-3" style={{ color: meta.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium" style={{ color: meta.color }}>{meta.label}</p>
                        <p className="text-[9px] text-muted-foreground truncate">{p.url}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Messages */}
          <ScrollArea className="flex-1">
            <div className="px-3 py-3">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-6 text-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#61afef]/10">
                    <Bot className="h-5 w-5 text-[#61afef]" />
                  </div>
                  <p className="text-sm font-medium text-secondary-foreground">Studio Orchestrator</p>
                  <p className="text-xs text-muted-foreground">Ask me anything</p>
                </div>
              )}
              {messages.map((msg) => (
                <MessageRow key={msg.id} msg={msg} />
              ))}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="border-t p-3 shrink-0">
            <div className="flex gap-2 items-end">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  resizeTextarea()
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="Message Studio..."
                rows={1}
                className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[36px] max-h-[120px] overflow-y-auto"
                style={{ height: 36 }}
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!input.trim()}
                className="h-9 w-9 shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </aside>
  )
}
