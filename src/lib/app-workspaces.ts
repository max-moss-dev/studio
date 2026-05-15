import type { Dirent } from "fs"
import fs from "fs/promises"
import path from "path"

export interface AppWorkspaceManifest {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
  entry: string
  mcp: {
    serverName: string
    endpoint: string
    tools: string[]
  }
}

export interface AppWorkspaceSummary extends AppWorkspaceManifest {
  fileCount: number
  files: string[]
}

const APPS_DIR = path.join(process.cwd(), "apps")
const DEFAULT_README = (name: string) => `# ${name}\n\nThis app workspace was created by Studio App Factory. AI agents can read and write files here through Studio MCP tools or the app-scoped MCP endpoint.\n`

export function sanitizeAppId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true })
}

function appDir(appId: string) {
  const safeId = sanitizeAppId(appId)
  if (!safeId) throw new Error("Invalid app id")
  return path.join(APPS_DIR, safeId)
}

function manifestPath(appId: string) {
  return path.join(appDir(appId), "app.json")
}

function filesDir(appId: string) {
  return path.join(appDir(appId), "files")
}

export function appFilePath(appId: string, filePath: string) {
  const base = filesDir(appId)
  const resolved = path.resolve(base, filePath)
  const relative = path.relative(base, resolved)
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Invalid file path")
  }
  return resolved
}

function appEndpoint(appId: string) {
  return `/api/apps/${sanitizeAppId(appId)}/mcp`
}

function createManifest(id: string, name: string, description = ""): AppWorkspaceManifest {
  const now = new Date().toISOString()
  return {
    id,
    name,
    description,
    createdAt: now,
    updatedAt: now,
    entry: "README.md",
    mcp: {
      serverName: `studio-app-${id}`,
      endpoint: appEndpoint(id),
      tools: [
        "app.info",
        "app.files.list",
        "app.files.read",
        "app.files.write",
      ],
    },
  }
}

export async function readManifest(appId: string): Promise<AppWorkspaceManifest> {
  return JSON.parse(await fs.readFile(manifestPath(appId), "utf-8")) as AppWorkspaceManifest
}

async function writeManifest(manifest: AppWorkspaceManifest) {
  manifest.updatedAt = new Date().toISOString()
  await ensureDir(appDir(manifest.id))
  await fs.writeFile(manifestPath(manifest.id), JSON.stringify(manifest, null, 2), "utf-8")
}

export async function ensureAppsDir() {
  await ensureDir(APPS_DIR)
}

export async function createAppWorkspace(input: {
  id?: string
  name: string
  description?: string
  initialFiles?: Record<string, string>
}): Promise<AppWorkspaceSummary> {
  const id = sanitizeAppId(input.id || input.name)
  if (!id) throw new Error("App id or name is required")

  await ensureDir(filesDir(id))
  const manifest = createManifest(id, input.name, input.description)
  await writeManifest(manifest)

  const files = Object.keys(input.initialFiles ?? {}).length > 0
    ? input.initialFiles!
    : { "README.md": DEFAULT_README(input.name) }

  for (const [filePath, content] of Object.entries(files)) {
    await writeAppFile(id, filePath, content, false)
  }

  return getAppWorkspace(id)
}

export async function listAppWorkspaces(): Promise<AppWorkspaceSummary[]> {
  await ensureAppsDir()
  const entries = await fs.readdir(APPS_DIR, { withFileTypes: true })
  const summaries = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        try {
          return await getAppWorkspace(entry.name)
        } catch {
          return null
        }
      })
  )
  return summaries.filter((summary): summary is AppWorkspaceSummary => summary !== null)
}

export async function getAppWorkspace(appId: string): Promise<AppWorkspaceSummary> {
  const manifest = await readManifest(appId)
  const files = await listAppFiles(appId)
  return {
    ...manifest,
    mcp: { ...manifest.mcp, endpoint: appEndpoint(manifest.id) },
    fileCount: files.length,
    files,
  }
}

export async function listAppFiles(appId: string): Promise<string[]> {
  const base = filesDir(appId)
  const result: string[] = []

  async function walk(dir: string) {
    let entries: Dirent[]
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      const rel = path.relative(base, full).replaceAll(path.sep, "/")
      if (entry.isDirectory()) {
        await walk(full)
      } else {
        result.push(rel)
      }
    }
  }

  await walk(base)
  return result.sort()
}

export async function readAppFile(appId: string, filePath: string) {
  const fullPath = appFilePath(appId, filePath)
  return {
    appId: sanitizeAppId(appId),
    path: filePath,
    content: await fs.readFile(fullPath, "utf-8"),
  }
}

export async function writeAppFile(appId: string, filePath: string, content: string, touchManifest = true) {
  const fullPath = appFilePath(appId, filePath)
  await ensureDir(path.dirname(fullPath))
  await fs.writeFile(fullPath, content, "utf-8")

  if (touchManifest) {
    const manifest = await readManifest(appId)
    await writeManifest(manifest)
  }

  return {
    appId: sanitizeAppId(appId),
    path: filePath,
    bytes: Buffer.byteLength(content, "utf-8"),
  }
}
