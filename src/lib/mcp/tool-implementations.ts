/**
 * MCP Server - Tool Implementations
 * 
 * Actual implementations of all MCP tools
 * These tools interact with the Studio's state and APIs
 */

import { z } from "zod"
import { registerTool, ToolResult } from "./tools"
import { useGatewayStore } from "@/stores/gateway-store"
import { useTabStore } from "@/stores/tab-store"
import {
  createAppWorkspace,
  getAppWorkspace,
  listAppFiles,
  listAppWorkspaces,
  readAppFile,
  writeAppFile,
} from "@/lib/app-workspaces"


// ============================================
// App Workspace Tools
// ============================================

registerTool({
  name: "studio.apps.list",
  description: "List app workspaces that expose their own app-scoped MCP tools",
  scopes: ["read"],
  inputSchema: z.object({}),
  handler: async () => ({
    success: true,
    data: { apps: await listAppWorkspaces() },
  }) as ToolResult,
})

registerTool({
  name: "studio.apps.create",
  description: "Create a new app workspace with an app-scoped MCP endpoint and writable files",
  scopes: ["write"],
  inputSchema: z.object({
    id: z.string().optional(),
    name: z.string().min(1),
    description: z.string().optional(),
    initialFiles: z.record(z.string()).optional(),
  }),
  handler: async (params) => {
    const { id, name, description, initialFiles } = params as {
      id?: string
      name: string
      description?: string
      initialFiles?: Record<string, string>
    }
    return {
      success: true,
      data: { app: await createAppWorkspace({ id, name, description, initialFiles }) },
    } as ToolResult
  },
})

registerTool({
  name: "studio.apps.info",
  description: "Get manifest, MCP endpoint, and file list for one app workspace",
  scopes: ["read"],
  inputSchema: z.object({ appId: z.string() }),
  handler: async (params) => ({
    success: true,
    data: { app: await getAppWorkspace((params as { appId: string }).appId) },
  }) as ToolResult,
})

registerTool({
  name: "studio.apps.files.list",
  description: "List files in an app workspace",
  scopes: ["read"],
  inputSchema: z.object({ appId: z.string() }),
  handler: async (params) => ({
    success: true,
    data: { files: await listAppFiles((params as { appId: string }).appId) },
  }) as ToolResult,
})

registerTool({
  name: "studio.apps.files.read",
  description: "Read a UTF-8 text file from an app workspace",
  scopes: ["read"],
  inputSchema: z.object({ appId: z.string(), path: z.string() }),
  handler: async (params) => {
    const { appId, path } = params as { appId: string; path: string }
    return { success: true, data: await readAppFile(appId, path) } as ToolResult
  },
})

registerTool({
  name: "studio.apps.files.write",
  description: "Write a UTF-8 text file to an app workspace",
  scopes: ["write"],
  inputSchema: z.object({ appId: z.string(), path: z.string(), content: z.string() }),
  handler: async (params) => {
    const { appId, path, content } = params as { appId: string; path: string; content: string }
    return { success: true, data: await writeAppFile(appId, path, content) } as ToolResult
  },
})

// ============================================
// Task/Kanban Tools
// ============================================

registerTool({
  name: "studio.tasks.list",
  description: "List all tasks on the Kanban board",
  scopes: ["read"],
  inputSchema: z.object({
    status: z.enum(["queue", "in_progress", "review", "done", "all"]).optional(),
    limit: z.number().optional(),
  }),
  handler: async (params) => {
    const { status, limit } = params as { status?: string; limit?: number }
    
    // Access the store state
    const state = useGatewayStore.getState()
    const tasks = state.tasks || []
    
    let filtered = tasks
    if (status && status !== "all") {
      filtered = tasks.filter((t) => t.status === status)
    }
    
    if (limit) {
      filtered = filtered.slice(0, limit)
    }
    
    return {
      success: true,
      data: {
        tasks: filtered.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          assigneeId: t.assigneeId,
          duration: t.duration,
          tokens: t.tokens,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        })),
        total: tasks.length,
        filtered: filtered.length,
      },
    } as ToolResult
  },
})

registerTool({
  name: "studio.tasks.create",
  description: "Create a new task on the Kanban board",
  scopes: ["write", "tasks"],
  inputSchema: z.object({
    title: z.string().min(1),
    status: z.enum(["queue", "in_progress", "review", "done"]).default("queue"),
    assigneeId: z.string().optional(),
    description: z.string().optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
    tags: z.array(z.string()).optional(),
  }),
  handler: async (params) => {
    const { title, status = "queue", assigneeId, description, priority, tags } = params as {
      title: string
      status: "queue" | "in_progress" | "review" | "done"
      assigneeId?: string
      description?: string
      priority?: "low" | "medium" | "high"
      tags?: string[]
    }
    
    // Create task via store action
    const state = useGatewayStore.getState()
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    
    const newTask = {
      id: taskId,
      title,
      status,
      assigneeId: assigneeId || null,
      description: description || "",
      priority: priority || "medium",
      tags: tags || [],
      duration: 0,
      tokens: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    
    // Add task to store
    state.tasks.push(newTask)
    
    return {
      success: true,
      data: {
        task: newTask,
        message: `Task "${title}" created successfully`,
      },
    } as ToolResult
  },
})

registerTool({
  name: "studio.tasks.update",
  description: "Update an existing task",
  scopes: ["write", "tasks"],
  inputSchema: z.object({
    taskId: z.string(),
    title: z.string().optional(),
    status: z.enum(["queue", "in_progress", "review", "done"]).optional(),
    assigneeId: z.string().nullable().optional(),
    description: z.string().optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
    tags: z.array(z.string()).optional(),
  }),
  handler: async (params) => {
    const { taskId, ...updates } = params as {
      taskId: string
      title?: string
      status?: "queue" | "in_progress" | "review" | "done"
      assigneeId?: string | null
      description?: string
      priority?: "low" | "medium" | "high"
      tags?: string[]
    }
    
    const state = useGatewayStore.getState()
    const task = state.tasks.find((t) => t.id === taskId)
    
    if (!task) {
      return {
        success: false,
        error: `Task not found: ${taskId}`,
      } as ToolResult
    }
    
    // Update task
    Object.assign(task, { ...updates, updatedAt: Date.now() })
    
    return {
      success: true,
      data: {
        task,
        message: "Task updated successfully",
      },
    } as ToolResult
  },
})

registerTool({
  name: "studio.tasks.delete",
  description: "Delete a task",
  scopes: ["write", "tasks"],
  inputSchema: z.object({
    taskId: z.string(),
  }),
  handler: async (params) => {
    const { taskId } = params as { taskId: string }
    
    const state = useGatewayStore.getState()
    const taskIndex = state.tasks.findIndex((t) => t.id === taskId)
    
    if (taskIndex === -1) {
      return {
        success: false,
        error: `Task not found: ${taskId}`,
      } as ToolResult
    }
    
    const task = state.tasks[taskIndex]
    state.tasks.splice(taskIndex, 1)
    
    return {
      success: true,
      data: {
        deletedTask: task,
        message: `Task "${task.title}" deleted`,
      },
    } as ToolResult
  },
})

// ============================================
// View/Tab Tools
// ============================================

registerTool({
  name: "studio.views.list",
  description: "List all open views/tabs",
  scopes: ["read"],
  inputSchema: z.object({}),
  handler: async () => {
    const tabStore = useTabStore.getState()
    const tabs = tabStore.tabs
    
    return {
      success: true,
      data: {
        tabs: tabs.map((t) => ({
          id: t.id,
          viewId: t.viewId,
          title: t.title,
          icon: t.icon,
          isActive: t.id === tabStore.activeTabId,
        })),
        activeTabId: tabStore.activeTabId,
      },
    } as ToolResult
  },
})

registerTool({
  name: "studio.views.open",
  description: "Open a view in a new tab",
  scopes: ["write"],
  inputSchema: z.object({
    viewId: z.string(),
    title: z.string(),
    icon: z.string().optional(),
  }),
  handler: async (params) => {
    const { viewId, title, icon = "sparkles" } = params as {
      viewId: string
      title: string
      icon?: string
    }
    
    const tabStore = useTabStore.getState()
    const tabId = tabStore.openTab(viewId, title, icon)
    
    return {
      success: true,
      data: {
        tabId,
        viewId,
        title,
        message: `Opened "${title}"`,
      },
    } as ToolResult
  },
})

registerTool({
  name: "studio.views.close",
  description: "Close a tab",
  scopes: ["write"],
  inputSchema: z.object({
    tabId: z.string(),
  }),
  handler: async (params) => {
    const { tabId } = params as { tabId: string }
    
    const tabStore = useTabStore.getState()
    tabStore.closeTab(tabId)
    
    return {
      success: true,
      data: {
        closedTabId: tabId,
      },
    } as ToolResult
  },
})

// ============================================
// Plugin Tools
// ============================================

registerTool({
  name: "studio.plugins.list",
  description: "List all installed plugins",
  scopes: ["read", "plugins"],
  inputSchema: z.object({}),
  handler: async () => {
    // This would need to call the plugin API
    // For now, return placeholder
    return {
      success: true,
      data: {
        plugins: [],
        message: "Plugin listing requires server-side implementation",
      },
    } as ToolResult
  },
})

registerTool({
  name: "studio.plugins.build",
  description: "Build a plugin from source",
  scopes: ["write", "plugins"],
  inputSchema: z.object({
    pluginId: z.string(),
  }),
  handler: async (params) => {
    const { pluginId } = params as { pluginId: string }
    
    // Call the plugins API
    const response = await fetch("/api/plugins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "build", pluginId }),
    })
    
    const result = await response.json()
    
    return {
      success: !result.error,
      data: result,
      error: result.error,
    } as ToolResult
  },
})

registerTool({
  name: "studio.plugins.write",
  description: "Write a source file to a plugin",
  scopes: ["write", "plugins"],
  inputSchema: z.object({
    pluginId: z.string(),
    filePath: z.string(),
    content: z.string(),
  }),
  handler: async (params) => {
    const { pluginId, filePath, content } = params as {
      pluginId: string
      filePath: string
      content: string
    }
    
    const response = await fetch("/api/plugins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "write", pluginId, filePath, content }),
    })
    
    const result = await response.json()
    
    return {
      success: !result.error,
      data: result,
      error: result.error,
    } as ToolResult
  },
})

// ============================================
// Server Info
// ============================================

registerTool({
  name: "studio.info",
  description: "Get server information and available tools",
  scopes: ["read"],
  inputSchema: z.object({}),
  handler: async () => {
    return {
      success: true,
      data: {
        name: "Studio MCP Server",
        version: "1.0.0",
        capabilities: [
          "tasks.list",
          "tasks.create", 
          "tasks.update",
          "tasks.delete",
          "views.list",
          "views.open",
          "views.close",
          "plugins.list",
          "plugins.build",
          "plugins.write",
          "apps.list",
          "apps.create",
          "apps.info",
          "apps.files.list",
          "apps.files.read",
          "apps.files.write",
        ],
      },
    } as ToolResult
  },
})
