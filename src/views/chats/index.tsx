"use client"

import { useState, useRef, useEffect } from "react"
import type { ViewProps, Agent, Message } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Send,
  Bot,
  User,
  Wrench,
  ChevronDown,
  ChevronRight,
  Search,
  FileText,
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

function ToolCallBlock({ message }: { message: Message }) {
  const [expanded, setExpanded] = useState(false)
  const openTab = useTabStore((s) => s.openTab)

  // Media tool result (no toolCall object, just content)
  if (!message.toolCall) {
    if (!message.content) return null

    const filePath = parseMediaPath(message.content)

    if (filePath) {
      const fileName = filePath.split("/").pop() ?? filePath
      return (
        <div className="rounded-md border bg-muted/30 text-xs">
          <button
            onClick={() => openTab("media", `Media: ${fileName}`, "file-text", { path: filePath })}
            className="flex w-full items-center gap-2 px-3 py-2 text-left cursor-pointer hover:bg-muted/50"
          >
            <FileText className="h-3 w-3 text-muted-foreground" />
            <span className="font-medium">Open {fileName}</span>
            <ChevronRight className="ml-auto h-3 w-3" />
          </button>
        </div>
      )
    }

    return (
      <div className="rounded-md border bg-muted/30 text-xs">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center gap-2 px-3 py-2 text-left cursor-pointer hover:bg-muted/50"
        >
          <Wrench className="h-3 w-3 text-muted-foreground" />
          <span className="font-medium">Tool Result</span>
          {expanded ? (
            <ChevronDown className="ml-auto h-3 w-3" />
          ) : (
            <ChevronRight className="ml-auto h-3 w-3" />
          )}
        </button>
        {expanded && (
          <div className="border-t px-3 py-2">
            <pre className="rounded bg-background p-2 font-mono text-[11px] overflow-auto max-h-40 whitespace-pre-wrap">
              {message.content}
            </pre>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-md border bg-muted/30 text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left cursor-pointer hover:bg-muted/50"
      >
        <Wrench className="h-3 w-3 text-muted-foreground" />
        <span className="font-medium">{message.toolCall.name}</span>
        {expanded ? (
          <ChevronDown className="ml-auto h-3 w-3" />
        ) : (
          <ChevronRight className="ml-auto h-3 w-3" />
        )}
      </button>
      {expanded && (
        <div className="border-t px-3 py-2 space-y-2">
          <div>
            <span className="text-muted-foreground">Input:</span>
            <pre className="mt-1 rounded bg-background p-2 font-mono text-[11px] overflow-auto max-h-32">
              {JSON.stringify(message.toolCall.input, null, 2)}
            </pre>
          </div>
          {message.toolCall.output != null && (
            <div>
              <span className="text-muted-foreground">Output:</span>
              <pre className="mt-1 rounded bg-background p-2 font-mono text-[11px] overflow-auto max-h-32">
                {typeof message.toolCall.output === "string"
                  ? message.toolCall.output
                  : JSON.stringify(message.toolCall.output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ChatsView({ agents, messages, send, initialAgentId }: ViewProps & { initialAgentId?: string }) {
  const openTab = useTabStore((s) => s.openTab)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(
    initialAgentId ?? agents[0]?.id ?? null
  )
  const [inputText, setInputText] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const addMessage = useGatewayStore((s) => s.addMessage)

  const selectedAgent = agents.find((a) => a.id === selectedAgentId)
  const agentMessages = selectedAgentId
    ? (messages[selectedAgentId] ?? [])
    : []

  // Sort agents: online first, then by last message time
  const sortedAgents = [...agents].sort((a, b) => {
    const aOnline = a.status !== "offline" ? 1 : 0
    const bOnline = b.status !== "offline" ? 1 : 0
    if (aOnline !== bOnline) return bOnline - aOnline

    const aLast = messages[a.id]?.at(-1)?.timestamp ?? 0
    const bLast = messages[b.id]?.at(-1)?.timestamp ?? 0
    return bLast - aLast
  })

  const filteredAgents = searchQuery
    ? sortedAgents.filter((a) =>
        a.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : sortedAgents

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [agentMessages.length])

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
    const msgs = messages[agentId]
    if (!msgs?.length) return null
    const last = msgs[msgs.length - 1]
    return last.content.slice(0, 50) + (last.content.length > 50 ? "..." : "")
  }

  return (
    <div className="flex h-full">
      {/* Agent sidebar */}
      <div className="w-64 border-r flex flex-col">
        <div className="p-2">
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
            <ScrollArea className="flex-1 p-4">
              <div className="flex flex-col gap-3 max-w-2xl mx-auto">
                {agentMessages.map((msg) => {
                  if (msg.role === "tool") {
                    return <div key={msg.id}><ToolCallBlock message={msg} /></div>
                  }

                  // Strip tool call blocks from assistant messages
                  // Strip system prefix from user messages
                  let displayText = msg.content
                  if (msg.role === "assistant") {
                    displayText = displayText.replace(/```tool\s*\n[\s\S]*?```/g, '').trim()
                  } else if (msg.role === "user") {
                    displayText = displayText.replace(/^\[System:[\s\S]*?\]\n\n/, '')
                  }

                  if (!displayText) return <div key={msg.id} />

                  return (
                    <div key={msg.id}>
                      <div
                        className={cn(
                          "flex gap-2",
                          msg.role === "user" ? "flex-row-reverse" : "flex-row"
                        )}
                      >
                        <div className="mt-1 shrink-0">
                          {msg.role === "user" ? (
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20">
                              <User className="h-3.5 w-3.5 text-primary" />
                            </div>
                          ) : (
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
                              <Bot className="h-3.5 w-3.5" />
                            </div>
                          )}
                        </div>
                        <div
                          className={cn(
                            "max-w-[75%] rounded-lg px-3 py-2",
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          )}
                        >
                          {msg.role === "assistant" ? (
                            <MarkdownRenderer content={displayText} className="text-sm" />
                          ) : (
                            <p className="text-sm whitespace-pre-wrap">
                              {displayText}
                            </p>
                          )}
                          <span
                            className={cn(
                              "block text-[10px] mt-1",
                              msg.role === "user"
                                ? "text-primary-foreground/60"
                                : "text-muted-foreground"
                            )}
                          >
                            {formatTime(msg.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />

                {agentMessages.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <Bot className="h-8 w-8 mb-2" />
                    <p className="text-sm">
                      Start a conversation with {selectedAgent.name}
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
