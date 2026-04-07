import { NextRequest } from "next/server"
import fs from "fs/promises"
import path from "path"

const VIEWS_DIR = path.join(process.cwd(), "src/views")

function isValidViewId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id)
}

/** GET /api/views?id=agent-manager — read source code of a view */
export async function GET(request: NextRequest) {
  const viewId = request.nextUrl.searchParams.get("id")

  if (!viewId) {
    try {
      const entries = await fs.readdir(VIEWS_DIR, { withFileTypes: true })
      const views = entries
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
      return Response.json({ views })
    } catch {
      return Response.json({ views: [] })
    }
  }

  if (!isValidViewId(viewId)) {
    return Response.json({ error: "Invalid view ID" }, { status: 400 })
  }

  const viewPath = path.join(VIEWS_DIR, viewId, "index.tsx")
  try {
    const code = await fs.readFile(viewPath, "utf-8")
    return Response.json({ id: viewId, code })
  } catch {
    return Response.json({ error: "View not found" }, { status: 404 })
  }
}

/** POST /api/views — create or update a view file */
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { id, code } = body

  if (!id || !code) {
    return Response.json({ error: "id and code required" }, { status: 400 })
  }

  if (!isValidViewId(id)) {
    return Response.json({ error: "Invalid view ID (alphanumeric, dashes, underscores only)" }, { status: 400 })
  }

  const viewDir = path.join(VIEWS_DIR, id)
  const viewPath = path.join(viewDir, "index.tsx")

  try {
    await fs.mkdir(viewDir, { recursive: true })
    await fs.writeFile(viewPath, code, "utf-8")
    return Response.json({ ok: true, id, path: viewPath })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}

/** DELETE /api/views?id=my-view — delete a custom view */
export async function DELETE(request: NextRequest) {
  const viewId = request.nextUrl.searchParams.get("id")

  if (!viewId || !isValidViewId(viewId)) {
    return Response.json({ error: "Invalid view ID" }, { status: 400 })
  }

  // Protect built-in views
  const PROTECTED = new Set(["agent-manager", "kanban", "chats", "office", "settings", "view-picker", "media", "todo", "code-editor"])
  if (PROTECTED.has(viewId)) {
    return Response.json({ error: "Cannot delete built-in view" }, { status: 403 })
  }

  const viewDir = path.join(VIEWS_DIR, viewId)
  try {
    await fs.rm(viewDir, { recursive: true })
    return Response.json({ ok: true })
  } catch {
    return Response.json({ error: "View not found" }, { status: 404 })
  }
}
