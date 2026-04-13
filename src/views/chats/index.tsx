"use client"

import { useState, useRef, useEffect, memo } from "react"
import type { ViewProps, Agent, Message, ChatSession } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Send,
  Bot,
  Wrench,
  ChevronDown,
  ChevronRight,
  Search,
  FileText,
  Loader2,
  Plus,
  MessageSquare,
  MoreHorizontal,
  Trash2,
  X,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { uid } from "@/lib/mock-data"
import { MarkdownRenderer } from "@/components/markdown-renderer"
import { useGatewayStore } from "@/stores/gateway-store"
import { useTabStore } from "@/stores/tab-store"
import { loadProviders } from "@/lib/providers"

const EMPTY_MESSAGES: Message[] = []

const STATUS_DOT: Record<string, string> = {
  online: "bg-[#98c379]",
  busy: "bg-[#e5c07b]",
  offline: "bg-[#5c6370]",
  error: "bg-[#e06c75]",
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatDate(ts: number): string {
  const date = new Date(ts)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  if (isToday) return formatTime(ts)
  return date.toLocaleDateString([], { month: "short", day: "numeric" })
}

function parseMediaPath(content: string): string | null {
  try {
    const jsonMatch = content.match(/```json\s*\n([\s\S]*?)```/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[1].trim())
    return parsed?.path ?? null
  } catch {
    return null
  }
}

/** Tool call result block (role: "tool" messages) */
function ToolResultBlock({ message }: { message: Message }) {
  const [expanded, setExpanded] = useState(false)
  const openTab = useTabStore((s) => s.openTab)

  const filePath = parseMediaPath(message.content)
  if (filePath) {
    const fileName = filePath.split("/").pop() ?? filePath
    return (
      <button
        onClick={() => openTab("media", `Media: ${fileName}`, "file-text", { path: filePath })}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-0.5"
      >
        <FileText className="h-3 w-3" />
        <span>Opened {fileName}</span>
        <ChevronRight className="h-3 w-3" />
      </button>
    )
  }

  return (
    <div className="text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-0.5"
      >
        <Wrench className="h-3 w-3" />
        <span>Tool result</span>
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>
      {expanded && (
        <pre className="mt-1 rounded bg-muted/50 p-2 font-mono text-[11px] overflow-auto max-h-40 whitespace-pre-wrap text-muted-foreground">
          {message.content}
        </pre>
      )}
    </div>
  )
}

/** Inline tool call indicator (from parsed toolCalls on assistant messages) */
function InlineToolCall({ name, input }: { name: string; input: unknown }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-0.5"
      >
        <Wrench className="h-3 w-3" />
        <span>{name}</span>
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>
      {expanded && (
        <pre className="mt-1 rounded bg-muted/50 p-2 font-mono text-[11px] overflow-auto max-h-32 text-muted-foreground">
          {JSON.stringify(input, null, 2)}
        </pre>
      )}
    </div>
  )
}

/**
 * Single message row. Reads pre-parsed data from the store:
 * - content: clean text (no tool blocks)
 * - toolCalls: structured tool calls (already parsed)
 * - isToolStreaming: true while a tool block is being streamed
 * No regex or parsing happens here.
 */
const MessageRow = memo(function MessageRow({ msg }: { msg: Message }) {
  // Tool result messages
  if (msg.role === "tool") {
    return <ToolResultBlock message={msg} />
  }

  // User messages — right-aligned with subtle background
  if (msg.role === "user") {
    const displayText = msg.content.replace(/^\[System:[\s\S]*?\]\n\n/, "")
    if (!displayText) return null
    return (
      <div className="py-2 flex justify-end">
        <div className="bg-[#2c313a] rounded-lg px-3 py-2 max-w-[85%]">
          <p className="text-sm whitespace-pre-wrap">{displayText}</p>
        </div>
      </div>
    )
  }

  // Assistant messages — data is pre-parsed at store level
  const hasContent = msg.content.trim().length > 0
  const hasTools = msg.toolCalls && msg.toolCalls.length > 0
  if (!hasContent && !hasTools && !msg.isToolStreaming && !msg.isStreaming) return null

  return (
    <div className="py-2">
      {hasContent && (
        <MarkdownRenderer content={msg.content} className="text-sm" streaming={msg.isStreaming} />
      )}
      {hasTools && (
        <div className="mt-1 flex flex-col gap-0.5">
          {msg.toolCalls!.map((tc, i) => (
            <InlineToolCall key={i} name={tc.name} input={tc.input} />
          ))}
        </div>
      )}
      {msg.isToolStreaming && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-1 mt-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>
            {msg.streamingToolName
              ? `Calling ${msg.streamingToolName}...`
              : "Preparing tool call..."}
          </span>
        </div>
      )}
      {msg.isStreaming && !msg.isToolStreaming && !hasContent && !hasTools && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Thinking...</span>
        </div>
      )}
      {msg.isStreaming && !msg.isToolStreaming && hasContent && (
        <span className="inline-block w-1.5 h-4 bg-[#61afef] animate-pulse rounded-sm ml-0.5 align-text-bottom" />
      )}
    </div>
  )
})

export default function ChatsView({ agents, messages: _messages, send, initialAgentId }: ViewProps & { initialAgentId?: string }) {
  const openTab = useTabStore((s) => s.openTab)
  
  // Session management
  const sessions = useGatewayStore((s) => s.sessions)
  const createSession = useGatewayStore((s) => s.createSession)
  const deleteSession = useGatewayStore((s) => s.deleteSession)
  const updateSession = useGatewayStore((s) => s.updateSession)
  const addMessage = useGatewayStore((s) => s.addMessage)
  const storeMessages = useGatewayStore((s) => s.messages)
  
  // Selected session state - use valid sessions only
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(() => {
    // Try to restore last session from localStorage
    try {
      const saved = localStorage.getItem("openclaw-last-session")
      if (saved && sessions.some((s) => s.id === saved)) return saved
    } catch { /* ignore */ }
    return sessions[0]?.id ?? null
  })
  
  const [inputText, setInputText] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [showNewSessionDialog, setShowNewSessionDialog] = useState(false)
  const [newSessionTitle, setNewSessionTitle] = useState("")
  const [selectedAgentForNewSession, setSelectedAgentForNewSession] = useState<string | null>(null)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Get selected session and its agent
  const selectedSession = sessions.find((s) => s.id === selectedSessionId)
  const selectedAgent = selectedSession
    ? agents.find((a) => a.id === selectedSession.agentId)
    : null

  // Get messages for selected session (filter by sessionId if present, else by agentId for backwards compat)
  const sessionMessages = selectedSession
    ? (storeMessages[selectedSession.agentId]?.filter(
        (m) => !m.sessionId || m.sessionId === selectedSession.id
      ) ?? EMPTY_MESSAGES)
    : EMPTY_MESSAGES

  // Sort sessions by last activity (updatedAt)
  const sortedSessions = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)

  // Filter to only show sessions with valid agents
  const validSessions = sortedSessions.filter((s) => agents.some((a) => a.id === s.agentId))

  const filteredSessions = searchQuery
    ? validSessions.filter((s) =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : validSessions

  // Persist last active session
  useEffect(() => {
    if (selectedSessionId) {
      try { localStorage.setItem("openclaw-last-session", selectedSessionId) } catch { /* ignore */ }
    }
  }, [selectedSessionId])

  // Auto-select first session if none selected
  useEffect(() => {
    if (!selectedSessionId && sessions.length > 0) {
      setSelectedSessionId(sessions[0].id)
    }
  }, [selectedSessionId, sessions])

  // Create initial session if none exists and agents are available
  useEffect(() => {
    if (agents.length === 0) return
    
    // Check if there are any sessions with valid agents
    const hasValidSession = sessions.some((s) => agents.some((a) => a.id === s.agentId))
    
    if (!hasValidSession) {
      // Create default session with first agent
      const firstOnlineAgent = agents.find((a) => a.status !== "offline") ?? agents[0]
      if (firstOnlineAgent) {
        const sessionId = createSession(firstOnlineAgent.id, `Chat with ${firstOnlineAgent.name}`)
        setSelectedSessionId(sessionId)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents.length])

  // Scroll behavior
  const prevMsgCountRef = useRef<number>(0)
  const isInitialRef = useRef(true)

  useEffect(() => {
    isInitialRef.current = true
    prevMsgCountRef.current = 0
  }, [selectedSessionId])

  useEffect(() => {
    if (isInitialRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" })
      isInitialRef.current = false
      prevMsgCountRef.current = sessionMessages.length
      return
    }
    if (sessionMessages.length > prevMsgCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
    prevMsgCountRef.current = sessionMessages.length
  }, [sessionMessages.length])

  // OpenCode session tracking (persisted across renders)
  const opencodeSessionRef = useRef<string | null>(null)

  function handleCreateNewSession() {
    if (!selectedAgentForNewSession) return
    const title = newSessionTitle.trim() || undefined
    const sessionId = createSession(selectedAgentForNewSession, title)
    setSelectedSessionId(sessionId)
    setShowNewSessionDialog(false)
    setNewSessionTitle("")
    setSelectedAgentForNewSession(null)
  }

  function handleDeleteSession(e: React.MouseEvent, sessionId: string) {
    e.stopPropagation()
    deleteSession(sessionId)
    if (selectedSessionId === sessionId) {
      const remaining = sessions.filter((s) => s.id !== sessionId)
      setSelectedSessionId(remaining[0]?.id ?? null)
    }
  }

  async function handleSend() {
    if (!inputText.trim() || !selectedSession || !selectedAgent) return

    const content = inputText.trim()
    setInputText("")

    // Add user message locally
    const userMsg: Message = {
      id: uid(),
      agentId: selectedAgent.id,
      sessionId: selectedSession.id,
      role: "user",
      content,
      timestamp: Date.now(),
    }
    addMessage(selectedAgent.id, userMsg)
    
    // Update session message count
    updateSession(selectedSession.id, {
      messageCount: (selectedSession.messageCount || 0) + 1,
      updatedAt: Date.now(),
    })

    // Check if OpenCode is enabled — route through OpenCode API
    const providers = loadProviders()
    if (providers.opencode.enabled && providers.opencode.url) {
      await sendViaOpenCode(selectedAgent.id, content, providers.opencode.url, selectedSession.id)
      return
    }

    // Default: send to gateway (OpenClaw / mock)
    send({
      type: "agent.message",
      agentId: selectedAgent.id,
      content,
    })
  }

  async function sendViaOpenCode(agentId: string, content: string, serverUrl: string, _sessionId: string) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-opencode-url": serverUrl,
    }

    // Create session if we don't have one
    if (!opencodeSessionRef.current) {
      try {
        const res = await fetch("/api/agent/opencode", {
          method: "POST",
          headers,
          body: JSON.stringify({ action: "create" }),
        })
        const data = await res.json()
        opencodeSessionRef.current = data.id ?? data.sessionId ?? Object.keys(data)[0]
        if (!opencodeSessionRef.current) {
          // Try to get from session list
          const listRes = await fetch("/api/agent/opencode", {
            method: "POST",
            headers,
            body: JSON.stringify({ action: "sessions" }),
          })
          const sessions = await listRes.json()
          const list = Array.isArray(sessions) ? sessions : sessions.sessions ?? Object.values(sessions)
          if (list.length > 0) {
            const last = list[list.length - 1]
            opencodeSessionRef.current = typeof last === "string" ? last : last.id ?? last.sessionId
          }
        }
      } catch (err) {
        addMessage(agentId, {
          id: uid(),
          agentId,
          sessionId: _sessionId,
          role: "assistant",
          content: `Failed to create OpenCode session: ${err instanceof Error ? err.message : String(err)}`,
          timestamp: Date.now(),
        })
        return
      }
    }

    const openCodeSessionId = opencodeSessionRef.current
    if (!openCodeSessionId) {
      addMessage(agentId, {
        id: uid(),
        agentId,
        sessionId: _sessionId,
        role: "assistant",
        content: "No OpenCode session available.",
        timestamp: Date.now(),
      })
      return
    }

    // Add "thinking" placeholder
    const assistantMsgId = uid()
    addMessage(agentId, {
      id: assistantMsgId,
      agentId,
      sessionId: _sessionId,
      role: "assistant",
      content: "",
      isStreaming: true,
      timestamp: Date.now(),
    })

    // Send prompt
    try {
      const res = await fetch("/api/agent/opencode", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "prompt", sessionId: openCodeSessionId, content }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        useGatewayStore.getState().addMessage(agentId, {
          id: assistantMsgId,
          agentId,
          sessionId: _sessionId,
          role: "assistant",
          content: `OpenCode error: ${errData.error ?? errData.details ?? "Unknown error"}`,
          timestamp: Date.now(),
        })
        return
      }

      // Check if streaming
      const contentType = res.headers.get("content-type") ?? ""
      if (contentType.includes("text/event-stream") && res.body) {
        // Read SSE stream
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let fullText = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })

          // Parse SSE events
          for (const line of chunk.split("\n")) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6)
              if (data === "[DONE]") continue
              try {
                const event = JSON.parse(data)
                // Extract text from various event formats
                const text = event.content ?? event.text ?? event.delta?.text ?? event.message?.content ?? ""
                if (text) {
                  fullText += text
                  // Update message in store
                  useGatewayStore.setState((s) => ({
                    messages: {
                      ...s.messages,
                      [agentId]: (s.messages[agentId] ?? []).map((m) =>
                        m.id === assistantMsgId
                          ? { ...m, content: fullText, isStreaming: true }
                          : m
                      ),
                    },
                  }))
                }
              } catch { /* skip non-JSON lines */ }
            }
          }
        }

        // Mark as done
        useGatewayStore.setState((s) => ({
          messages: {
            ...s.messages,
            [agentId]: (s.messages[agentId] ?? []).map((m) =>
              m.id === assistantMsgId
                ? { ...m, isStreaming: false }
                : m
            ),
          },
        }))
      } else {
        // Non-streaming: read full response, then poll messages
        const responseData = await res.json()

        // Wait a bit for OpenCode to process, then fetch messages
        await new Promise((r) => setTimeout(r, 1000))
        const msgsRes = await fetch("/api/agent/opencode", {
          method: "POST",
          headers,
          body: JSON.stringify({ action: "messages", sessionId: openCodeSessionId }),
        })
        const msgsData = await msgsRes.json()
        const msgList = Array.isArray(msgsData) ? msgsData : msgsData.messages ?? Object.values(msgsData)

        // Find last assistant message
        const lastAssistant = [...msgList].reverse().find(
          (m: { role?: string }) => m.role === "assistant"
        )

        const responseText = lastAssistant?.content
          ?? (typeof responseData === "string" ? responseData : JSON.stringify(responseData, null, 2))

        useGatewayStore.setState((s) => ({
          messages: {
            ...s.messages,
            [agentId]: (s.messages[agentId] ?? []).map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: responseText, isStreaming: false }
                : m
            ),
          },
        }))
      }
    } catch (err) {
      useGatewayStore.setState((s) => ({
        messages: {
          ...s.messages,
          [agentId]: (s.messages[agentId] ?? []).map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: `OpenCode error: ${err instanceof Error ? err.message : String(err)}`, isStreaming: false }
              : m
          ),
        },
      }))
    }
  }

  function getLastMessagePreview(session: ChatSession): string | null {
    const msgs = storeMessages[session.agentId]
    if (!msgs?.length) return null
    // Filter messages for this session
    const sessionMsgs = msgs.filter((m) => !m.sessionId || m.sessionId === session.id)
    if (!sessionMsgs.length) return null
    const last = sessionMsgs[sessionMsgs.length - 1]
    return last.content.slice(0, 60) + (last.content.length > 60 ? "..." : "")
  }

  return (
    <div className="flex h-full">
      {/* Sessions sidebar */}
      <div className="w-72 border-r flex flex-col">
        <div className="px-3 py-3 border-b">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Chat Sessions</h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => {
                setSelectedAgentForNewSession(null)
                setNewSessionTitle("")
                setShowNewSessionDialog(true)
              }}
              disabled={agents.length === 0}
            >
              <Plus className="h-3.5 w-3.5" />
              New
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search sessions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="flex flex-col py-1">
            {filteredSessions.map((session) => {
              const agent = agents.find((a) => a.id === session.agentId)
              const lastMsg = getLastMessagePreview(session)
              const isActive = session.id === selectedSessionId
              return (
                <div
                  key={session.id}
                  onClick={() => setSelectedSessionId(session.id)}
                  className={cn(
                    "flex items-start gap-3 px-3 py-3 text-left transition-colors cursor-pointer group",
                    isActive
                      ? "bg-accent"
                      : "hover:bg-accent/50"
                  )}
                >
                  <div className="relative mt-0.5 shrink-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      <MessageSquare className="h-3.5 w-3.5" />
                    </div>
                    {agent && (
                      <span
                        className={cn(
                          "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card",
                          STATUS_DOT[agent.status]
                        )}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">
                        {session.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatDate(session.updatedAt)}
                      </span>
                    </div>
                    {agent && (
                      <p className="text-[10px] text-muted-foreground truncate">
                        with {agent.name}
                      </p>
                    )}
                    {lastMsg ? (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {lastMsg}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground/50 italic mt-0.5">
                        No messages yet
                      </p>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <div
                        className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded hover:bg-accent cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => handleDeleteSession(e, session.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )
            })}
            {filteredSessions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No sessions yet</p>
                <p className="text-xs text-center mt-1">
                  Click "New" to start chatting with an agent
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Chat area */}
      <div className="flex flex-1 flex-col">
        {selectedAgent && selectedSession ? (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 border-b px-4 py-2.5">
              <div className="relative">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  <MessageSquare className="h-3.5 w-3.5" />
                </div>
                <span
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card",
                    STATUS_DOT[selectedAgent.status]
                  )}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{selectedSession.title}</div>
                <div className="text-xs text-muted-foreground">
                  {selectedAgent.name} · {selectedAgent.role} · {selectedAgent.model}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs text-muted-foreground"
                onClick={() => openTab("agent-manager", `Agent: ${selectedAgent.name}`, "bot", { agentId: selectedAgent.id })}
              >
                <Bot className="h-3.5 w-3.5" />
                Agent
              </Button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1">
              <div className="max-w-2xl mx-auto px-4 py-3">
                {sessionMessages.map((msg, idx) => {
                  // Group consecutive messages by role — only show label on first
                  const prevMsg = sessionMessages[idx - 1]
                  const showLabel = !prevMsg || prevMsg.role !== msg.role

                  return (
                    <div key={msg.id} className={cn(
                      msg.role === "tool" && "pl-3",
                    )}>
                      {showLabel && msg.role !== "tool" && msg.role !== "user" && (
                        <div className="flex items-center gap-1.5 pt-3 pb-0.5">
                          <span className="text-xs font-medium text-muted-foreground">
                            {selectedAgent?.name ?? "Agent"}
                          </span>
                        </div>
                      )}
                      <MessageRow msg={msg} />
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />

                {sessionMessages.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <p className="text-sm">
                      Start a conversation in {selectedSession.title}
                    </p>
                    <p className="text-xs mt-2 text-muted-foreground/50">
                      Messages will appear here
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="border-t p-4">
              <div className="flex gap-2 max-w-2xl mx-auto">
                <Input
                  placeholder={`Message ${selectedAgent.name}...`}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  size="icon"
                  onClick={handleSend}
                  disabled={!inputText.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">
                {agents.length === 0
                  ? "No agents available. Connect to a gateway first."
                  : "Select or create a session to start chatting"}
              </p>
              {agents.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setShowNewSessionDialog(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Chat Session
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* New Session Dialog */}
      <Dialog open={showNewSessionDialog} onOpenChange={setShowNewSessionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Chat Session</DialogTitle>
            <DialogDescription>
              Select an agent to chat with and optionally name your session.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Agent selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Agent</label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => setSelectedAgentForNewSession(agent.id)}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-lg border text-left transition-all",
                      selectedAgentForNewSession === agent.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className="relative shrink-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {agent.name.slice(0, 2)}
                      </div>
                      <span
                        className={cn(
                          "absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-card",
                          STATUS_DOT[agent.status]
                        )}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{agent.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {agent.role}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              {agents.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No agents available. Connect to a gateway first.
                </p>
              )}
            </div>

            {/* Session title input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Session Title <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Input
                placeholder="e.g., Code Review, Debug Session..."
                value={newSessionTitle}
                onChange={(e) => setNewSessionTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && selectedAgentForNewSession) {
                    handleCreateNewSession()
                  }
                }}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowNewSessionDialog(false)
                  setSelectedAgentForNewSession(null)
                  setNewSessionTitle("")
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateNewSession}
                disabled={!selectedAgentForNewSession}
              >
                Start Chat
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
