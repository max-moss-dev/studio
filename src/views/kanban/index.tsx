"use client"

import { useState } from "react"
import type { ViewProps, Task, TaskStatus } from "@/lib/types"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Plus, Clock, Coins, GripVertical, User } from "lucide-react"
import { cn } from "@/lib/utils"

const COLUMNS: { id: TaskStatus; title: string; color: string; dotColor: string }[] = [
  { id: "queue", title: "Queue", color: "text-[#5c6370]", dotColor: "bg-[#5c6370]" },
  { id: "in_progress", title: "In Progress", color: "text-[#61afef]", dotColor: "bg-[#61afef]" },
  { id: "review", title: "Review", color: "text-[#e5c07b]", dotColor: "bg-[#e5c07b]" },
  { id: "done", title: "Done", color: "text-[#98c379]", dotColor: "bg-[#98c379]" },
]

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  return `${(seconds / 3600).toFixed(1)}h`
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

export default function KanbanView({ tasks, agents, send }: ViewProps) {
  const [draggedTask, setDraggedTask] = useState<Task | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState("")

  function getColumnTasks(status: TaskStatus): Task[] {
    return tasks.filter((t) => t.status === status)
  }

  function getAgentName(assigneeId: string | null): string | null {
    if (!assigneeId) return null
    return agents.find((a) => a.id === assigneeId)?.name ?? null
  }

  function handleDragStart(e: React.DragEvent, task: Task) {
    setDraggedTask(task)
    e.dataTransfer.effectAllowed = "move"
  }

  function handleDragOver(e: React.DragEvent, status: TaskStatus) {
    e.preventDefault()
    setDragOverColumn(status)
  }

  function handleDragLeave() {
    setDragOverColumn(null)
  }

  function handleDrop(e: React.DragEvent, newStatus: TaskStatus) {
    e.preventDefault()
    setDragOverColumn(null)
    if (draggedTask && draggedTask.status !== newStatus) {
      send({
        type: "task.update",
        taskId: draggedTask.id,
        updates: { status: newStatus },
      })
    }
    setDraggedTask(null)
  }

  function handleAddTask() {
    if (!newTaskTitle.trim()) return
    send({ type: "task.create", title: newTaskTitle.trim() })
    setNewTaskTitle("")
    setShowAddDialog(false)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-lg font-semibold">Task Board</h2>
        <Button size="sm" className="gap-1.5" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4" />
          New Task
        </Button>
      </div>

      {/* Columns */}
      <div className="flex flex-1 gap-4 overflow-x-auto p-4">
        {COLUMNS.map((col) => {
          const columnTasks = getColumnTasks(col.id)
          return (
            <div
              key={col.id}
              className={cn(
                "flex w-72 shrink-0 flex-col rounded-lg border bg-card/50",
                dragOverColumn === col.id && "ring-2 ring-primary/50"
              )}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-3 py-2.5 border-b">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", col.dotColor)} />
                  <span className={cn("text-sm font-semibold", col.color)}>
                    {col.title}
                  </span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {columnTasks.length}
                </Badge>
              </div>

              {/* Tasks */}
              <ScrollArea className="flex-1 p-2">
                <div className="flex flex-col gap-2">
                  {columnTasks.map((task) => {
                    const agentName = getAgentName(task.assigneeId)
                    return (
                      <Card
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task)}
                        className={cn(
                          "cursor-grab active:cursor-grabbing transition-opacity rounded-[10px]",
                          draggedTask?.id === task.id && "opacity-50",
                          task.status === "done" && "opacity-50"
                        )}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start gap-2">
                            <GripVertical className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground/50" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium leading-snug">
                                {task.title}
                              </p>
                              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                                {agentName && (
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {agentName}
                                  </span>
                                )}
                                {task.duration > 0 && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatDuration(task.duration)}
                                  </span>
                                )}
                                {task.tokens > 0 && (
                                  <span className="flex items-center gap-1">
                                    <Coins className="h-3 w-3" />
                                    {formatTokens(task.tokens)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}

                  {columnTasks.length === 0 && (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      No tasks
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )
        })}
      </div>

      {/* Add Task Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Task</DialogTitle>
            <DialogDescription>
              Create a new task. It will be added to the Queue column.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <Input
              placeholder="Task title..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
            />
            <Button onClick={handleAddTask}>Create Task</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
