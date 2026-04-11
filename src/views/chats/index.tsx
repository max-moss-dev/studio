"use client"

import { useState, useRef, useEffect } from "react"
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
function MessageRow({ msg }: { msg: Message }) {
  // Tool result messages
  if (msg.role === "tool") {
    return <ToolResultBlock message={msg} />
  }

  // User messages
  if (msg.role === "user") {
    const displayText = msg.content.replace(/^\[System:[\s\S]*?\]\n\n/, '')
    if (!displayText) return null
    return (
      <div className="py-2">
        <p className="text-sm whitespace-pre-wrap">{displayText}</p>
      </div>
    )
  }

  // Assistant messages — data is pre-parsed at store level
  const hasContent = msg.content.trim().length > 0
  const hasTools = msg.toolCalls && msg.toolCalls.length > 0
  if (!hasContent && !hasTools && !msg.isToolStreaming) return null

  return (
    <div className="py-2">
      {hasContent && (
        <MarkdownRenderer content={msg.content} className="text-sm" />
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
          <span>Generating...</span>
        </div>
      )}
    </div>
  )
}

export default function ChatsView({ agents, messages: _messages, send, initialAgentId }: ViewProps & { initialAgentId?: string }) {
  const openTab = useTabStore((s) => s.openTab)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(
    initialAgentId ?? agents[0]?.id ?? null
  )
  const [inputText, setInputText] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const addMessage = useGatewayStore((s) => s.addMessage)
  // Subscribe directly to store messages — ensures re-renders on every streaming delta
  const storeMessages = useGatewayStore((s) => s.messages)

  const selectedAgent = agents.find((a) => a.id === selectedAgentId)
  const agentMessages = selectedAgentId
    ? (storeMessages[selectedAgentId] ?? [])
    : []


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

  // Auto-scroll on new messages or content changes (streaming)
  const lastMsgContent = agentMessages[agentMessages.length - 1]?.content
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [agentMessages.length, lastMsgContent])

  function handleSend() {
    if (!inputText.trim() || !selectedAgentId) return

    // Add user message locally
    const userMsg: Message = {
      id: uid(),
      agentId: selectedAgentId,
      role: "user",
      content: inputText.trim(),
      timestamp: Date.now(),
    }
    addMessage(selectedAgentId, userMsg)

    // Send to gateway
    send({
      type: "agent.message",
      agentId: selectedAgentId,
      content: inputText.trim(),
    })
    setInputText("")
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
                      msg.role === "user" && "border-l-2 border-muted-foreground/20 pl-3",
                      msg.role === "tool" && "pl-3",
                    )}>
                      {showLabel && msg.role !== "tool" && (
                        <div className="flex items-center gap-1.5 pt-3 pb-0.5">
                          <span className="text-xs font-medium text-muted-foreground">
                            {msg.role === "user" ? "You" : selectedAgent?.name ?? "Agent"}
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
