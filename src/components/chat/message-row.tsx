"use client"

/**
 * Shared chat message components — used by both ChatsView and OrchestratorSidebar.
 */

import { useState, memo } from "react"
import type { Message } from "@/lib/types"
import { Wrench, ChevronDown, ChevronRight, FileText, Loader2 } from "lucide-react"
import { MarkdownRenderer } from "@/components/markdown-renderer"
import { useTabStore } from "@/stores/tab-store"

export const STATUS_DOT: Record<string, string> = {
  online: "bg-[#98c379]",
  busy: "bg-[#e5c07b]",
  offline: "bg-[#5c6370]",
  error: "bg-[#e06c75]",
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatDate(ts: number): string {
  const date = new Date(ts)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  if (isToday) return formatTime(ts)
  return date.toLocaleDateString([], { month: "short", day: "numeric" })
}

export function parseMediaPath(content: string): string | null {
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
export function ToolResultBlock({ message }: { message: Message }) {
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
export function InlineToolCall({ name, input }: { name: string; input: unknown }) {
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
export const MessageRow = memo(function MessageRow({ msg }: { msg: Message }) {
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
