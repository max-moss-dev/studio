"use client"

import { useState, useRef, useEffect, memo } from "react"
import type { ViewProps, Agent, Message } from "@/lib/types"
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
} from "lucide-react"
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
    const displayText = msg.content.replace(/^\[System:[\s\S]*?\]\n\n/, '')
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
  // Pick initial agent: explicit initialAgentId > last active (from localStorage) > first with messages > first agent
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(() => {
    if (initialAgentId) return initialAgentId
    try {
      const saved = localStorage.getItem("openclaw-last-chat-agent")
      if (saved && agents.some((a) => a.id === saved)) return saved
    } catch { /* ignore */ }
    return agents[0]?.id ?? null
  })
  const [inputText, setInputText] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const addMessage = useGatewayStore((s) => s.addMessage)
  // Subscribe to store messages
  const storeMessages = useGatewayStore((s) => s.messages)
  const agentMessages = selectedAgentId
    ? (storeMessages[selectedAgentId] ?? EMPTY_MESSAGES)
    : EMPTY_MESSAGES

  const selectedAgent = agents.find((a) => a.id === selectedAgentId)


  // Sort agents: online first, then by last message time
  const sortedAgents = [...agents].sort((a, b) => {
    const aOnline = a.status !== "offline" ? 1 : 0
    const bOnline = b.status !== "offline" ? 1 : 0
    if (aOnline !== bOnline) return bOnline - aOnline

    const aLast = storeMessages[a.id]?.at(-1)?.timestamp ?? 0
    const bLast = storeMessages[b.id]?.at(-1)?.timestamp ?? 0
    return bLast - aLast
  })

  const filteredAgents = searchQuery
    ? sortedAgents.filter((a) =>
        a.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : sortedAgents

  // Persist last active agent
  useEffect(() => {
    if (selectedAgentId) {
      try { localStorage.setItem("openclaw-last-chat-agent", selectedAgentId) } catch { /* ignore */ }
    }
  }, [selectedAgentId])

  // Scroll: jump to bottom instantly on initial load / agent switch,
  // smooth scroll only on new messages after that
  const prevMsgCountRef = useRef<number>(0)
  const isInitialRef = useRef(true)

  // On initial load or agent switch — jump to bottom instantly (no animation)
  useEffect(() => {
    isInitialRef.current = true
    prevMsgCountRef.current = 0
  }, [selectedAgentId])

  useEffect(() => {
    if (isInitialRef.current) {
      // Instant jump on first render / agent switch
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" })
      isInitialRef.current = false
      prevMsgCountRef.current = agentMessages.length
      return
    }
    if (agentMessages.length > prevMsgCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
    prevMsgCountRef.current = agentMessages.length
  }, [agentMessages.length])

  // OpenCode session tracking (persisted across renders)
  const opencodeSessionRef = useRef<string | null>(null)

  async function handleSend() {
    if (!inputText.trim() || !selectedAgentId) return

    const content = inputText.trim()
    setInputText("")

    // Add user message locally
    const userMsg: Message = {
      id: uid(),
      agentId: selectedAgentId,
      role: "user",
      content,
      timestamp: Date.now(),
    }
    addMessage(selectedAgentId, userMsg)

    // Check if OpenCode is enabled — route through OpenCode API
    const providers = loadProviders()
    if (providers.opencode.enabled && providers.opencode.url) {
      await sendViaOpenCode(selectedAgentId, content, providers.opencode.url)
      return
    }

    // Default: send to gateway (OpenClaw / mock)
    send({
      type: "agent.message",
      agentId: selectedAgentId,
      content,
    })
  }

  async function sendViaOpenCode(agentId: string, content: string, serverUrl: string) {
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
          role: "assistant",
          content: `Failed to create OpenCode session: ${err instanceof Error ? err.message : String(err)}`,
          timestamp: Date.now(),
        })
        return
      }
    }

    const sessionId = opencodeSessionRef.current
    if (!sessionId) {
      addMessage(agentId, {
        id: uid(), agentId, role: "assistant",
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
        body: JSON.stringify({ action: "prompt", sessionId, content }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        useGatewayStore.getState().addMessage(agentId, {
          id: assistantMsgId, agentId, role: "assistant",
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
          body: JSON.stringify({ action: "messages", sessionId }),
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

  function getLastMessage(agentId: string): string | null {
    const msgs = storeMessages[agentId]
    if (!msgs?.length) return null
    const last = msgs[msgs.length - 1]
    return last.content.slice(0, 50) + (last.content.length > 50 ? "..." : "")
  }

  return (
    <div className="flex h-full">
      {/* Agent sidebar */}
      <div className="w-64 border-r flex flex-col">
        <div className="px-3 py-2">
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">Conversations</h3>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search agents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="flex flex-col">
            {filteredAgents.map((agent) => {
              const lastMsg = getLastMessage(agent.id)
              const isActive = agent.id === selectedAgentId
              return (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgentId(agent.id)}
                  className={cn(
                    "flex items-start gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer",
                    isActive
                      ? "bg-accent"
                      : "hover:bg-accent/50"
                  )}
                >
                  <div className="relative mt-0.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {agent.name.slice(0, 2)}
                    </div>
                    <span
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card",
                        STATUS_DOT[agent.status]
                      )}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">
                        {agent.name}
                      </span>
                    </div>
                    {lastMsg ? (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {lastMsg}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground/50 italic mt-0.5">
                        No messages
                      </p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Chat area */}
      <div className="flex flex-1 flex-col">
        {selectedAgent ? (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 border-b px-4 py-2.5">
              <div className="relative">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  {selectedAgent.name.slice(0, 2)}
                </div>
                <span
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card",
                    STATUS_DOT[selectedAgent.status]
                  )}
                />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{selectedAgent.name}</div>
                <div className="text-xs text-muted-foreground">
                  {selectedAgent.role} · {selectedAgent.model}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs text-muted-foreground"
                onClick={() => openTab("agent-manager", `Agent: ${selectedAgent.name}`, "bot", { agentId: selectedAgent.id })}
              >
                <Bot className="h-3.5 w-3.5" />
                Config
              </Button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1">
              <div className="max-w-2xl mx-auto px-4 py-3">
                {agentMessages.map((msg, idx) => {
                  // Group consecutive messages by role — only show label on first
                  const prevMsg = agentMessages[idx - 1]
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

                {agentMessages.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <p className="text-sm">
                      Start a conversation with {selectedAgent?.name}
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
            <p className="text-sm">Select an agent to start chatting</p>
          </div>
        )}
      </div>
    </div>
  )
}
