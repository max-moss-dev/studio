/**
 * MCP Server - Tool Registry
 * 
 * Defines all available tools that external agents can invoke.
 * Each tool has a schema, handler, and required scopes.
 */

import { NextRequest } from "next/server"
import { z } from "zod"
import { APIKey, APIKeyScope, validateAPIKey } from "./api-keys"

// Tool definition
export interface MCPTool {
  name: string
  description: string
  inputSchema: z.ZodType<unknown>
  scopes: APIKeyScope[]
  handler: (params: unknown, context: ToolContext) => Promise<ToolResult>
}

// Tool execution context
export interface ToolContext {
  keyData: APIKey
  request: NextRequest
  startTime: number
}

// Tool execution result
export interface ToolResult {
  success: boolean
  data?: unknown
  error?: string
  meta?: {
    duration: number
    timestamp: string
  }
}

// Tool registry
const tools: Map<string, MCPTool> = new Map()

/**
 * Register a tool
 */
export function registerTool(tool: MCPTool): void {
  tools.set(tool.name, tool)
}

/**
 * Get all registered tools
 */
export function getAllTools(): MCPTool[] {
  return Array.from(tools.values())
}

/**
 * Get a specific tool
 */
export function getTool(name: string): MCPTool | undefined {
  return tools.get(name)
}

/**
 * Execute a tool
 */
export async function executeTool(
  name: string,
  params: unknown,
  apiKey: string,
  request: NextRequest
): Promise<ToolResult> {
  const tool = getTool(name)
  
  if (!tool) {
    return {
      success: false,
      error: `Tool "${name}" not found`,
    }
  }
  
  // Validate API key
  const validation = await validateAPIKey(apiKey, tool.scopes)
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error || "Unauthorized",
    }
  }
  
  // Validate params
  try {
    tool.inputSchema.parse(params)
  } catch (err) {
    return {
      success: false,
      error: `Invalid params: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
  
  // Execute
  const startTime = Date.now()
  const context: ToolContext = {
    keyData: validation.keyData!,
    request,
    startTime,
  }
  
  try {
    const result = await tool.handler(params, context)
    return {
      ...result,
      meta: {
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      meta: {
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
    }
  }
}

// ============================================
// Schema Helpers
// ============================================

export const TaskStatusSchema = z.enum(["queue", "in_progress", "review", "done"])
export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: TaskStatusSchema,
  assigneeId: z.string().nullable().optional(),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  tags: z.array(z.string()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const ViewSchema = z.object({
  id: z.string(),
  type: z.enum(["kanban", "chat", "agent-manager", "plugin", "custom"]),
  title: z.string(),
  state: z.record(z.unknown()).optional(),
})

export const PluginSchema = z.object({
  id: z.string(),
  title: z.string(),
  version: z.string(),
  hasBundle: z.boolean(),
  entry: z.string().optional(),
})
