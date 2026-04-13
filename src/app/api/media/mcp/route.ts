import { NextRequest } from "next/server"
import fs from "fs/promises"
import path from "path"

const MEDIA_DIR = path.join(process.cwd(), "media")

async function ensureDir(dir: string) {
  try {
    await fs.mkdir(dir, { recursive: true })
  } catch {
    // exists
  }
}

/**
 * POST /api/media/mcp — tool-call dispatcher
 * Body: { tool: "media.list" | "media.read" | "media.write" | "media.delete" | "todo.*", params: {...} }
 */
export async function POST(request: NextRequest) {
  await ensureDir(MEDIA_DIR)

  const body = await request.json()
  const { tool, params } = body as { tool: string; params: Record<string, unknown> }

  if (!tool) {
    return Response.json({ error: "tool is required" }, { status: 400 })
  }

  try {
    switch (tool) {
      case "media.list": {
        const subpath = (params?.path as string) ?? ""
        const dir = path.join(MEDIA_DIR, subpath)
        if (!dir.startsWith(MEDIA_DIR)) {
          return Response.json({ error: "Invalid path" })
        }

        try {
          const entries = await fs.readdir(dir, { withFileTypes: true })
          const items = await Promise.all(
            entries.map(async (e) => {
              const rel = subpath ? `${subpath}/${e.name}` : e.name
              const stat = await fs.stat(path.join(dir, e.name))
              return {
                name: e.name,
                path: rel,
                isDir: e.isDirectory(),
                size: stat.size,
                modified: stat.mtimeMs,
              }
            })
          )
          return Response.json({ items })
        } catch {
          return Response.json({ items: [] })
        }
      }

      case "media.read": {
        const filePath = params?.path as string
        if (!filePath) return Response.json({ error: "path is required" })

        const fullPath = path.join(MEDIA_DIR, filePath)
        if (!fullPath.startsWith(MEDIA_DIR)) {
          return Response.json({ error: "Invalid path" })
        }

        try {
          const content = await fs.readFile(fullPath, "utf-8")
          return Response.json({ content, path: filePath })
        } catch {
          return Response.json({ error: `File not found: ${filePath}` })
        }
      }

      case "media.write": {
        const filePath = params?.path as string
        const content = params?.content as string
        if (!filePath || content === undefined) {
          return Response.json({ error: "path and content are required" })
        }

        const fullPath = path.join(MEDIA_DIR, filePath)
        if (!fullPath.startsWith(MEDIA_DIR)) {
          return Response.json({ error: "Invalid path" })
        }

        await ensureDir(path.dirname(fullPath))
        await fs.writeFile(fullPath, content, "utf-8")
        return Response.json({ ok: true, path: filePath })
      }

      case "media.delete": {
        const filePath = params?.path as string
        if (!filePath) return Response.json({ error: "path is required" })

        const fullPath = path.join(MEDIA_DIR, filePath)
        if (!fullPath.startsWith(MEDIA_DIR)) {
          return Response.json({ error: "Invalid path" })
        }

        try {
          const stat = await fs.stat(fullPath)
          if (stat.isDirectory()) {
            await fs.rm(fullPath, { recursive: true })
          } else {
            await fs.unlink(fullPath)
          }
          return Response.json({ ok: true })
        } catch {
          return Response.json({ error: `File not found: ${filePath}` })
        }
      }

      // Todo tools — store in a JSON file for simplicity
      case "todo.add": {
        const todosPath = path.join(MEDIA_DIR, ".todos.json")
        const todos = await loadTodos(todosPath)
        const newTodo = {
          id: `todo-${Date.now()}`,
          text: params?.text as string ?? "",
          category: params?.category as string ?? "general",
          agentName: params?.agentName as string ?? "unknown",
          done: false,
          createdAt: Date.now(),
        }
        todos.push(newTodo)
        await fs.writeFile(todosPath, JSON.stringify(todos, null, 2))
        return Response.json({ ok: true, todo: newTodo })
      }

      case "todo.list": {
        const todosPath = path.join(MEDIA_DIR, ".todos.json")
        const todos = await loadTodos(todosPath)
        return Response.json({ todos })
      }

      case "todo.complete": {
        const todosPath = path.join(MEDIA_DIR, ".todos.json")
        const todos = await loadTodos(todosPath)
        const todoId = params?.id as string
        const todo = todos.find((t: { id: string }) => t.id === todoId)
        if (todo) {
          todo.done = true
          await fs.writeFile(todosPath, JSON.stringify(todos, null, 2))
          return Response.json({ ok: true, todo })
        }
        return Response.json({ error: `Todo not found: ${todoId}` })
      }

      default:
        return Response.json({ error: `Unknown tool: ${tool}` })
    }
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadTodos(todosPath: string): Promise<any[]> {
  try {
    const raw = await fs.readFile(todosPath, "utf-8")
    return JSON.parse(raw)
  } catch {
    return []
  }
}
