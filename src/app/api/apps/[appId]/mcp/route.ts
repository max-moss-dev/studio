import { NextRequest } from "next/server"
import {
  getAppWorkspace,
  listAppFiles,
  readAppFile,
  writeAppFile,
} from "@/lib/app-workspaces"

const MCP_VERSION = "2025-06"

interface JSONRPCRequest {
  jsonrpc: "2.0"
  id: string | number | null
  method: string
  params?: unknown
}

function response(id: JSONRPCRequest["id"], result: unknown) {
  return Response.json({ jsonrpc: "2.0", id, result })
}

function error(id: JSONRPCRequest["id"], code: number, message: string) {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } })
}

const tools = [
  {
    name: "app.info",
    description: "Get metadata for this generated app workspace.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "app.files.list",
    description: "List files in this app workspace.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "app.files.read",
    description: "Read a UTF-8 text file from this app workspace.",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
      additionalProperties: false,
    },
  },
  {
    name: "app.files.write",
    description: "Write a UTF-8 text file into this app workspace.",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string" }, content: { type: "string" } },
      required: ["path", "content"],
      additionalProperties: false,
    },
  },
]

export async function GET(_: NextRequest, context: { params: Promise<{ appId: string }> }) {
  const { appId } = await context.params
  const app = await getAppWorkspace(appId)
  return Response.json({
    name: app.mcp.serverName,
    protocol: MCP_VERSION,
    app,
    endpoint: app.mcp.endpoint,
    tools: tools.map((tool) => tool.name),
  })
}

export async function POST(request: NextRequest, context: { params: Promise<{ appId: string }> }) {
  const { appId } = await context.params
  let body: JSONRPCRequest

  try {
    body = await request.json()
  } catch {
    return error(null, -32700, "Invalid JSON")
  }

  const { id, method, params } = body

  try {
    switch (method) {
      case "initialize": {
        const app = await getAppWorkspace(appId)
        return response(id, {
          protocolVersion: MCP_VERSION,
          capabilities: { tools: { listChanged: true } },
          serverInfo: { name: app.mcp.serverName, version: "0.1.0" },
        })
      }
      case "tools/list":
        return response(id, { tools })
      case "tools/call": {
        const { name, arguments: args = {} } = params as { name?: string; arguments?: Record<string, unknown> }
        let data: unknown
        if (name === "app.info") data = await getAppWorkspace(appId)
        else if (name === "app.files.list") data = { files: await listAppFiles(appId) }
        else if (name === "app.files.read") data = await readAppFile(appId, String(args.path ?? ""))
        else if (name === "app.files.write") data = await writeAppFile(appId, String(args.path ?? ""), String(args.content ?? ""))
        else return error(id, -32601, `Tool not found: ${name}`)

        return response(id, { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] })
      }
      case "ping":
        return response(id, {})
      default:
        return error(id, -32601, `Method not found: ${method}`)
    }
  } catch (err) {
    return error(id, -32603, err instanceof Error ? err.message : String(err))
  }
}
