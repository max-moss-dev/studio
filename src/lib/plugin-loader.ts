"use client"

import type { ViewDefinition } from "@/lib/types"

/**
 * Plugin manifest (plugin.json) — metadata only, no code.
 */
export interface PluginManifest {
  id: string
  title: string
  icon?: string
  description?: string
  author?: string
  version?: string
  entry: string // relative path to source file, e.g. "view.tsx"
}

/**
 * Result of fetching a plugin — manifest + resolved source code.
 */
export interface FetchedPlugin {
  manifest: PluginManifest
  code: string
  sourceUrl: string // the URL used to install
}

/**
 * Registry manifest — a list of available plugins at a known URL.
 */
export interface PluginRegistry {
  name: string
  plugins: Array<{
    id: string
    title: string
    description?: string
    author?: string
    version?: string
    icon?: string
    url: string // URL to the plugin (repo, gist, or direct)
  }>
}

// ── URL type detection ───────────────────────────────────

type PluginSourceType = "github-repo" | "github-gist" | "direct-tsx" | "direct-manifest"

function detectSourceType(url: string): PluginSourceType {
  const u = new URL(url)

  // GitHub gist: https://gist.github.com/user/abc123
  if (u.hostname === "gist.github.com") {
    return "github-gist"
  }

  // GitHub repo: https://github.com/user/repo (no file extension)
  if (u.hostname === "github.com" && !u.pathname.includes(".")) {
    return "github-repo"
  }

  // Direct .tsx/.jsx/.ts file
  if (/\.(tsx?|jsx?)$/.test(u.pathname)) {
    return "direct-tsx"
  }

  // Assume it's a direct URL to plugin.json
  return "direct-manifest"
}

// ── GitHub repo fetching ─────────────────────────────────

/** Parse "github.com/user/repo" → { owner, repo } with optional branch */
function parseGitHubRepoUrl(url: string): { owner: string; repo: string; branch?: string } {
  const u = new URL(url)
  const parts = u.pathname.replace(/^\//, "").replace(/\/$/, "").split("/")
  // github.com/user/repo or github.com/user/repo/tree/branch
  const owner = parts[0]
  const repo = parts[1]
  const branch = parts[2] === "tree" ? parts[3] : undefined
  return { owner, repo, branch }
}

async function fetchFromGitHubRepo(url: string): Promise<FetchedPlugin> {
  const { owner, repo, branch } = parseGitHubRepoUrl(url)

  // Try common branches
  const branches = branch ? [branch] : ["main", "master"]

  let manifestJson: PluginManifest | null = null
  let usedBranch = ""

  for (const b of branches) {
    const manifestUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${b}/plugin.json`
    const res = await fetch(manifestUrl)
    if (res.ok) {
      manifestJson = await res.json()
      usedBranch = b
      break
    }
  }

  if (!manifestJson || !usedBranch) {
    throw new Error(`Could not find plugin.json in ${owner}/${repo} (tried branches: ${branches.join(", ")})`)
  }

  const manifest = validateManifest(manifestJson)
  const entryUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${usedBranch}/${manifest.entry}`
  const codeRes = await fetch(entryUrl)
  if (!codeRes.ok) {
    throw new Error(`Could not fetch entry file: ${manifest.entry} (${codeRes.status})`)
  }
  const code = await codeRes.text()

  return { manifest, code, sourceUrl: url }
}

// ── GitHub gist fetching ─────────────────────────────────

async function fetchFromGitHubGist(url: string): Promise<FetchedPlugin> {
  const gistId = new URL(url).pathname.split("/").pop()
  if (!gistId) throw new Error("Invalid gist URL")

  const apiRes = await fetch(`https://api.github.com/gists/${gistId}`)
  if (!apiRes.ok) throw new Error(`Failed to fetch gist: ${apiRes.status}`)

  const gist = await apiRes.json()
  const files = gist.files as Record<string, { filename: string; content: string }>

  // Find plugin.json
  const manifestFile = Object.values(files).find((f) => f.filename === "plugin.json")
  if (!manifestFile) {
    // Single-file gist: look for a .tsx/.jsx file
    const sourceFile = Object.values(files).find((f) =>
      /\.(tsx?|jsx?)$/.test(f.filename)
    )
    if (!sourceFile) throw new Error("Gist must contain plugin.json or a .tsx/.jsx source file")

    return {
      manifest: {
        id: gistId,
        title: sourceFile.filename.replace(/\.(tsx?|jsx?)$/, ""),
        entry: sourceFile.filename,
      },
      code: sourceFile.content,
      sourceUrl: url,
    }
  }

  const manifest = validateManifest(JSON.parse(manifestFile.content))
  const entryFile = Object.values(files).find((f) => f.filename === manifest.entry)
  if (!entryFile) {
    throw new Error(`Gist is missing entry file: ${manifest.entry}`)
  }

  return { manifest, code: entryFile.content, sourceUrl: url }
}

// ── Direct URL fetching ──────────────────────────────────

async function fetchFromDirectManifest(url: string): Promise<FetchedPlugin> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch plugin.json: ${res.status}`)

  const manifest = validateManifest(await res.json())

  // Resolve entry file relative to manifest URL
  const base = url.substring(0, url.lastIndexOf("/") + 1)
  const entryUrl = new URL(manifest.entry, base).href
  const codeRes = await fetch(entryUrl)
  if (!codeRes.ok) throw new Error(`Failed to fetch entry file: ${manifest.entry} (${codeRes.status})`)

  return { manifest, code: await codeRes.text(), sourceUrl: url }
}

async function fetchFromDirectSource(url: string): Promise<FetchedPlugin> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch source: ${res.status}`)

  const code = await res.text()
  const filename = new URL(url).pathname.split("/").pop() ?? "view.tsx"
  const id = filename.replace(/\.(tsx?|jsx?)$/, "")

  return {
    manifest: { id, title: id, entry: filename },
    code,
    sourceUrl: url,
  }
}

// ── Main fetch entry point ───────────────────────────────

/**
 * Fetch a plugin from any supported URL type:
 * - GitHub repo: https://github.com/user/repo
 * - GitHub gist: https://gist.github.com/user/id
 * - Direct plugin.json URL: https://example.com/plugins/my-plugin/plugin.json
 * - Direct .tsx source URL: https://example.com/my-view.tsx
 */
export async function fetchPlugin(url: string): Promise<FetchedPlugin> {
  const type = detectSourceType(url)
  switch (type) {
    case "github-repo":
      return fetchFromGitHubRepo(url)
    case "github-gist":
      return fetchFromGitHubGist(url)
    case "direct-tsx":
      return fetchFromDirectSource(url)
    case "direct-manifest":
      return fetchFromDirectManifest(url)
  }
}

// ── Validation ───────────────────────────────────────────

function validateManifest(data: unknown): PluginManifest {
  if (!data || typeof data !== "object") {
    throw new Error("Plugin manifest must be a JSON object")
  }

  const d = data as Record<string, unknown>

  if (typeof d.id !== "string" || !d.id.trim()) {
    throw new Error("Plugin must have a non-empty 'id' field")
  }
  if (typeof d.title !== "string" || !d.title.trim()) {
    throw new Error("Plugin must have a non-empty 'title' field")
  }
  if (typeof d.entry !== "string" || !d.entry.trim()) {
    throw new Error("Plugin must have a non-empty 'entry' field pointing to the source file")
  }

  return {
    id: d.id,
    title: d.title,
    icon: typeof d.icon === "string" ? d.icon : "sparkles",
    description: typeof d.description === "string" ? d.description : undefined,
    author: typeof d.author === "string" ? d.author : undefined,
    version: typeof d.version === "string" ? d.version : undefined,
    entry: d.entry,
  }
}

// ── Conversion helpers ───────────────────────────────────

/**
 * Convert a fetched plugin to a ViewDefinition for the store.
 */
export function pluginToView(plugin: FetchedPlugin): ViewDefinition {
  return {
    id: `plugin-${plugin.manifest.id}`,
    title: plugin.manifest.title,
    icon: plugin.manifest.icon ?? "sparkles",
    type: "plugin",
    code: plugin.code,
    description: plugin.manifest.description,
    author: plugin.manifest.author,
    version: plugin.manifest.version,
    sourceUrl: plugin.sourceUrl,
    sourceEntry: plugin.manifest.entry,
    createdAt: Date.now(),
  }
}

/**
 * Export a ViewDefinition as a plugin.json manifest string (for sharing).
 */
export function exportPluginManifest(view: ViewDefinition): string {
  const manifest: PluginManifest = {
    id: view.id.replace(/^plugin-/, ""),
    title: view.title,
    icon: view.icon,
    description: view.description,
    author: view.author,
    version: view.version ?? "0.1.0",
    entry: view.sourceEntry ?? "view.tsx",
  }
  return JSON.stringify(manifest, null, 2)
}

/**
 * Fetch a plugin registry manifest.
 */
export async function fetchRegistry(url: string): Promise<PluginRegistry> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch registry: ${res.status}`)
  const data = await res.json()
  if (!data?.plugins || !Array.isArray(data.plugins)) {
    throw new Error("Invalid registry format: must have a 'plugins' array")
  }
  return data as PluginRegistry
}
