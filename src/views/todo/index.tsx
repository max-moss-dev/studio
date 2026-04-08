"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Plus,
  Trash2,
  Check,
  Circle,
  CheckCircle2,
  Tag,
  Bot,
  RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils"

// --- Types ---

interface TodoItem {
  id: string
  text: string
  done: boolean
  category: string
  createdBy: string // "user" or agent name
  createdAt: string
}

// --- Markdown <-> Todo parsing ---

const TODO_FILE = "tasks/todo.json"

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

// --- Category colors ---

const CATEGORY_COLORS: Record<string, string> = {
  general: "var(--color-text-primary)",
  bug: "var(--color-status-error)",
  feature: "var(--color-status-online)",
  research: "var(--color-accent)",
  urgent: "var(--color-status-busy)",
  idea: "var(--color-role-reviewer)",
}

const CATEGORIES = Object.keys(CATEGORY_COLORS)

// --- Component ---

export default function TodoView() {
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [newText, setNewText] = useState("")
  const [newCategory, setNewCategory] = useState("general")
  const [filter, setFilter] = useState<"all" | "active" | "done">("all")
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Load todos from media
  const loadTodos = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/media?path=${encodeURIComponent(TODO_FILE)}`)
      if (!res.ok) {
        // File doesn't exist yet — start fresh
        setTodos([])
        setLoading(false)
        return
      }
      const data = await res.json()
      if (data.content) {
        const parsed = JSON.parse(data.content)
        setTodos(Array.isArray(parsed) ? parsed : [])
      }
    } catch {
      setTodos([])
    }
    setLoading(false)
  }, [])

  // Save todos to media
  const saveTodos = useCallback(async (items: TodoItem[]) => {
    try {
      await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: TODO_FILE,
          content: JSON.stringify(items, null, 2),
        }),
      })
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    loadTodos()
  }, [loadTodos])

  // Poll for changes (agents might add tasks)
  useEffect(() => {
    const interval = setInterval(loadTodos, 5000)
    return () => clearInterval(interval)
  }, [loadTodos])

  function addTodo() {
    if (!newText.trim()) return
    const item: TodoItem = {
      id: generateId(),
      text: newText.trim(),
      done: false,
      category: newCategory,
      createdBy: "user",
      createdAt: new Date().toISOString(),
    }
    const updated = [item, ...todos]
    setTodos(updated)
    saveTodos(updated)
    setNewText("")
  }

  function toggleTodo(id: string) {
    const updated = todos.map((t) =>
      t.id === id ? { ...t, done: !t.done } : t
    )
    setTodos(updated)
    saveTodos(updated)
  }

  function deleteTodo(id: string) {
    const updated = todos.filter((t) => t.id !== id)
    setTodos(updated)
    saveTodos(updated)
  }

  function clearDone() {
    const updated = todos.filter((t) => !t.done)
    setTodos(updated)
    saveTodos(updated)
  }

  const filtered = todos.filter((t) => {
    if (filter === "active" && t.done) return false
    if (filter === "done" && !t.done) return false
    if (categoryFilter && t.category !== categoryFilter) return false
    return true
  })

  const activeCount = todos.filter((t) => !t.done).length
  const doneCount = todos.filter((t) => t.done).length

  return (
    <div className="flex h-full flex-col" style={{ background: "var(--color-bg-base)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <div className="flex-1">
          <h2 className="text-base font-semibold" style={{ color: "var(--color-text-bright)" }}>
            Tasks
          </h2>
          <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
            {activeCount} active · {doneCount} done · synced to media base
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={loadTodos}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Add task */}
      <div className="flex gap-2 px-4 py-3 border-b">
        <Input
          placeholder="Add a task..."
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTodo()}
          className="flex-1 h-8 text-sm"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-bright)" }}
        />
        <select
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          className="h-8 rounded-md border px-2 text-xs"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-bright)" }}
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <Button size="sm" className="h-8 gap-1.5" onClick={addTodo} disabled={!newText.trim()}>
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 px-4 py-2 border-b">
        <div className="flex gap-1">
          {(["all", "active", "done"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="rounded-full px-2.5 py-1 text-[11px] transition-colors cursor-pointer"
              style={{
                background: filter === f ? "var(--color-border)" : "transparent",
                color: filter === f ? "var(--color-text-bright)" : "var(--color-text-secondary)",
              }}
            >
              {f === "all" ? `All ${todos.length}` : f === "active" ? `Active ${activeCount}` : `Done ${doneCount}`}
            </button>
          ))}
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex gap-1">
          <button
            onClick={() => setCategoryFilter(null)}
            className="rounded-full px-2 py-1 text-[11px] transition-colors cursor-pointer"
            style={{
              background: categoryFilter === null ? "var(--color-border)" : "transparent",
              color: categoryFilter === null ? "var(--color-text-bright)" : "var(--color-text-secondary)",
            }}
          >
            All
          </button>
          {CATEGORIES.map((cat) => {
            const count = todos.filter((t) => t.category === cat).length
            if (count === 0) return null
            return (
              <button
                key={cat}
                onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] transition-colors cursor-pointer"
                style={{
                  background: categoryFilter === cat ? "var(--color-border)" : "transparent",
                  color: categoryFilter === cat ? "var(--color-text-bright)" : "var(--color-text-secondary)",
                }}
              >
                <span
                  className="rounded-full"
                  style={{ width: 6, height: 6, background: CATEGORY_COLORS[cat] }}
                />
                {cat}
              </button>
            )
          })}
        </div>
        {doneCount > 0 && (
          <>
            <div className="flex-1" />
            <button
              onClick={clearDone}
              className="text-[11px] cursor-pointer hover:underline"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Clear done
            </button>
          </>
        )}
      </div>

      {/* Task list */}
      <ScrollArea className="flex-1">
        {loading && todos.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: "var(--color-text-secondary)" }}>
            Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center" style={{ color: "var(--color-text-secondary)" }}>
            <Check className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              {todos.length === 0
                ? "No tasks yet. Add one above or ask an agent!"
                : "No tasks match this filter"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {filtered.map((todo) => (
              <div
                key={todo.id}
                className="group flex items-start gap-3 px-4 py-2.5 border-b border-surface hover:bg-surface/50 transition-colors"
              >
                {/* Checkbox */}
                <button
                  onClick={() => toggleTodo(todo.id)}
                  className="mt-0.5 shrink-0 cursor-pointer"
                >
                  {todo.done ? (
                    <CheckCircle2 className="h-5 w-5" style={{ color: "var(--color-status-online)" }} />
                  ) : (
                    <Circle className="h-5 w-5" style={{ color: "var(--color-text-secondary)" }} />
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p
                    className={cn("text-sm", todo.done && "line-through")}
                    style={{ color: todo.done ? "var(--color-text-secondary)" : "var(--color-text-bright)" }}
                  >
                    {todo.text}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {/* Category tag */}
                    <span
                      className="flex items-center gap-1 text-[10px] rounded-full px-1.5 py-0.5"
                      style={{
                        color: CATEGORY_COLORS[todo.category] ?? "var(--color-text-secondary)",
                        background: `color-mix(in srgb, ${CATEGORY_COLORS[todo.category] ?? "var(--color-text-secondary)"} 8%, transparent)`,
                      }}
                    >
                      <Tag className="h-2.5 w-2.5" />
                      {todo.category}
                    </span>

                    {/* Created by */}
                    {todo.createdBy !== "user" && (
                      <span
                        className="flex items-center gap-0.5 text-[10px]"
                        style={{ color: "var(--color-accent)" }}
                      >
                        <Bot className="h-2.5 w-2.5" />
                        {todo.createdBy}
                      </span>
                    )}

                    {/* Time */}
                    <span className="text-[10px]" style={{ color: "var(--color-text-secondary)" }}>
                      {new Date(todo.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>

                {/* Delete */}
                <button
                  onClick={() => deleteTodo(todo.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/20 transition-opacity shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
