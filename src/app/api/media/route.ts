import { NextRequest } from "next/server"
import fs from "fs/promises"
import path from "path"

// Media base directory — stored alongside the project
const MEDIA_DIR = path.join(process.cwd(), "media")

async function ensureMediaDir() {
  try {
    await fs.mkdir(MEDIA_DIR, { recursive: true })
  } catch {
    // exists
  }
}

/** GET /api/media — list all files, or read a specific file */
export async function GET(request: NextRequest) {
  await ensureMediaDir()
  const filePath = request.nextUrl.searchParams.get("path")

  if (filePath) {
    // Read specific file
    const fullPath = path.join(MEDIA_DIR, filePath)
    if (!fullPath.startsWith(MEDIA_DIR)) {
      return Response.json({ error: "Invalid path" }, { status: 400 })
    }

    try {
      const stat = await fs.stat(fullPath)
      if (stat.isDirectory()) {
        const entries = await fs.readdir(fullPath, { withFileTypes: true })
        const items = entries.map((e) => ({
          name: e.name,
          path: path.join(filePath, e.name),
          isDir: e.isDirectory(),
        }))
        return Response.json({ items })
      }

      const ext = path.extname(fullPath).toLowerCase()
      if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"].includes(ext)) {
        const data = await fs.readFile(fullPath)
        const mimeMap: Record<string, string> = {
          ".png": "image/png",
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".gif": "image/gif",
          ".webp": "image/webp",
          ".svg": "image/svg+xml",
        }
        return new Response(data, {
          headers: { "Content-Type": mimeMap[ext] ?? "application/octet-stream" },
        })
      }

      // Text/markdown files
      const content = await fs.readFile(fullPath, "utf-8")
      return Response.json({ content, path: filePath })
    } catch {
      return Response.json({ error: "File not found" }, { status: 404 })
    }
  }

  // List all files recursively
  async function listFiles(dir: string, base: string = ""): Promise<Array<{ name: string; path: string; isDir: boolean; size: number; modified: number }>> {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    const results: Array<{ name: string; path: string; isDir: boolean; size: number; modified: number }> = []

    for (const entry of entries) {
      const rel = base ? `${base}/${entry.name}` : entry.name
      const full = path.join(dir, entry.name)
      const stat = await fs.stat(full)

      if (entry.isDirectory()) {
        results.push({ name: entry.name, path: rel, isDir: true, size: 0, modified: stat.mtimeMs })
        const children = await listFiles(full, rel)
        results.push(...children)
      } else {
        results.push({ name: entry.name, path: rel, isDir: false, size: stat.size, modified: stat.mtimeMs })
      }
    }
    return results
  }

  try {
    const files = await listFiles(MEDIA_DIR)
    return Response.json({ files })
  } catch {
    return Response.json({ files: [] })
  }
}

/** POST /api/media — create/update a file */
export async function POST(request: NextRequest) {
  await ensureMediaDir()

  const contentType = request.headers.get("content-type") ?? ""

  if (contentType.includes("multipart/form-data")) {
    // File upload
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const filePath = formData.get("path") as string | null

    if (!file || !filePath) {
      return Response.json({ error: "file and path required" }, { status: 400 })
    }

    const fullPath = path.join(MEDIA_DIR, filePath)
    if (!fullPath.startsWith(MEDIA_DIR)) {
      return Response.json({ error: "Invalid path" }, { status: 400 })
    }

    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    const buffer = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(fullPath, buffer)

    return Response.json({ ok: true, path: filePath })
  }

  // JSON body — text/markdown content
  const body = await request.json()
  const { path: filePath, content } = body

  if (!filePath || content === undefined) {
    return Response.json({ error: "path and content required" }, { status: 400 })
  }

  const fullPath = path.join(MEDIA_DIR, filePath)
  if (!fullPath.startsWith(MEDIA_DIR)) {
    return Response.json({ error: "Invalid path" }, { status: 400 })
  }

  await fs.mkdir(path.dirname(fullPath), { recursive: true })
  await fs.writeFile(fullPath, content, "utf-8")

  return Response.json({ ok: true, path: filePath })
}

/** DELETE /api/media — delete a file */
export async function DELETE(request: NextRequest) {
  await ensureMediaDir()
  const filePath = request.nextUrl.searchParams.get("path")

  if (!filePath) {
    return Response.json({ error: "path required" }, { status: 400 })
  }

  const fullPath = path.join(MEDIA_DIR, filePath)
  if (!fullPath.startsWith(MEDIA_DIR)) {
    return Response.json({ error: "Invalid path" }, { status: 400 })
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
    return Response.json({ error: "File not found" }, { status: 404 })
  }
}
