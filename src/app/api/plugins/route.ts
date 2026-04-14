/**
 * Plugin Management API
 *
 * POST /api/plugins
 *   { action: "write",       pluginId, filePath, content }   → write source file
 *   { action: "build",       pluginId }                      → esbuild compile
 *   { action: "list" }                                       → list all plugins
 *   { action: "get-source",  pluginId, filePath? }           → read source file(s)
 *   { action: "get-manifest",pluginId }                      → read plugin.json
 *   { action: "clone-view",  viewId }                        → read built-in view source
 *   { action: "install-deps",pluginId, deps }                → npm install in plugin dir
 *   { action: "delete",      pluginId }                      → remove plugin
 *
 * GET /api/plugins?id={pluginId}&file=bundle  → serve compiled bundle.mjs
 */

import { NextRequest } from "next/server"
import fs from "fs/promises"
import path from "path"
import { execFile } from "child_process"
import { promisify } from "util"

const execFileAsync = promisify(execFile)

const PLUGINS_DIR = path.join(process.cwd(), "plugins")
const VIEWS_DIR = path.join(process.cwd(), "src", "views")
const RUNTIME_DIR = path.join(PLUGINS_DIR, "_runtime")

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true })
}

function pluginDir(id: string) {
  return path.join(PLUGINS_DIR, id)
}

function pluginSrcDir(id: string) {
  return path.join(pluginDir(id), "src")
}

function pluginDistDir(id: string) {
  return path.join(pluginDir(id), "dist")
}

/** Validate plugin/file paths stay within plugins dir */
function safePluginPath(pluginId: string, filePath?: string): string {
  const base = pluginDir(pluginId)
  if (!filePath) return base
  const resolved = path.join(base, filePath)
  if (!resolved.startsWith(PLUGINS_DIR)) throw new Error("Invalid path")
  return resolved
}

// ── GET — serve bundle ──────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const pluginId = searchParams.get("id")
  const file = searchParams.get("file")

  if (!pluginId) return Response.json({ error: "id required" }, { status: 400 })

  try {
    if (file === "bundle") {
      const bundlePath = path.join(pluginDistDir(pluginId), "bundle.mjs")
      const code = await fs.readFile(bundlePath, "utf-8")
      return new Response(code, {
        headers: {
          "Content-Type": "text/javascript",
          "Cache-Control": "no-cache",
        },
      })
    }

    return Response.json({ error: "Unknown file" }, { status: 400 })
  } catch {
    return Response.json({ error: "Not found" }, { status: 404 })
  }
}

// ── POST — actions ─────────────────────────────────────────

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { action } = body as { action: string }

  try {
    switch (action) {

      // ── write ──────────────────────────────────────────
      case "write": {
        const { pluginId, filePath, content } = body as {
          pluginId: string
          filePath: string
          content: string
        }
        if (!pluginId || !filePath || content === undefined) {
          return Response.json({ error: "pluginId, filePath, and content are required" })
        }

        const dest = path.join(pluginSrcDir(pluginId), filePath)
        if (!dest.startsWith(PLUGINS_DIR)) {
          return Response.json({ error: "Invalid path" })
        }

        await ensureDir(path.dirname(dest))
        await fs.writeFile(dest, content, "utf-8")

        // Create default plugin.json if it doesn't exist
        const manifestPath = path.join(pluginDir(pluginId), "plugin.json")
        try {
          await fs.access(manifestPath)
        } catch {
          const manifest = {
            id: pluginId,
            title: pluginId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            icon: "sparkles",
            version: "0.1.0",
            entry: "src/index.tsx",
          }
          await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2))
        }

        return Response.json({ ok: true, path: dest.replace(process.cwd(), "") })
      }

      // ── build ──────────────────────────────────────────
      case "build": {
        const { pluginId } = body as { pluginId: string }
        if (!pluginId) return Response.json({ error: "pluginId required" })

        const manifestPath = path.join(pluginDir(pluginId), "plugin.json")
        let entry = "src/index.tsx"
        try {
          const manifest = JSON.parse(await fs.readFile(manifestPath, "utf-8"))
          if (manifest.entry) entry = manifest.entry
        } catch { /* use default */ }

        const entryPath = path.join(pluginDir(pluginId), entry)
        const outDir = pluginDistDir(pluginId)
        const outFile = path.join(outDir, "bundle.mjs")

        await ensureDir(outDir)

        // Build via esbuild
        const esbuild = await import("esbuild")
        const result = await esbuild.build({
          entryPoints: [entryPath],
          bundle: true,
          format: "esm",
          outfile: outFile,
          // Alias studio modules to runtime shims (shared host instances)
          alias: {
            "react": path.join(RUNTIME_DIR, "react.mjs"),
            "react-dom": path.join(RUNTIME_DIR, "react.mjs"),
            "@studio/store": path.join(RUNTIME_DIR, "studio-store.mjs"),
            "lucide-react": path.join(RUNTIME_DIR, "lucide-react.mjs"),
          },
          // Path alias @/ → src/
          plugins: [{
            name: "studio-path-alias",
            setup(build) {
              build.onResolve({ filter: /^@\// }, (args) => ({
                path: path.join(process.cwd(), "src", args.path.slice(2)),
              }))
            },
          }],
          jsx: "automatic",
          jsxImportSource: "react",
          loader: { ".tsx": "tsx", ".ts": "ts", ".jsx": "jsx", ".js": "js", ".mjs": "js" },
          treeShaking: true,
          minify: false, // keep readable for debugging
          metafile: true,
          logLevel: "silent",
        })

        const warnings = result.warnings.map((w) => w.text)
        const errors = result.errors.map((e) => e.text)

        if (errors.length > 0) {
          return Response.json({ error: errors.join("\n"), warnings })
        }

        const stat = await fs.stat(outFile)
        return Response.json({
          ok: true,
          bundleSize: stat.size,
          bundlePath: outFile.replace(process.cwd(), ""),
          warnings,
        })
      }

      // ── list ───────────────────────────────────────────
      case "list": {
        await ensureDir(PLUGINS_DIR)
        const entries = await fs.readdir(PLUGINS_DIR, { withFileTypes: true })
        const plugins = await Promise.all(
          entries
            .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
            .map(async (e) => {
              const manifestPath = path.join(PLUGINS_DIR, e.name, "plugin.json")
              const bundlePath = path.join(PLUGINS_DIR, e.name, "dist", "bundle.mjs")
              let manifest: Record<string, unknown> = { id: e.name, title: e.name }
              let hasBundle = false

              try { manifest = JSON.parse(await fs.readFile(manifestPath, "utf-8")) } catch { /* none */ }
              try { await fs.access(bundlePath); hasBundle = true } catch { /* not built */ }

              return { ...manifest, id: e.name, hasBundle }
            })
        )
        return Response.json({ plugins })
      }

      // ── get-source ─────────────────────────────────────
      case "get-source": {
        const { pluginId, filePath } = body as { pluginId: string; filePath?: string }
        if (!pluginId) return Response.json({ error: "pluginId required" })

        if (filePath) {
          const fullPath = safePluginPath(pluginId, filePath)
          const content = await fs.readFile(fullPath, "utf-8")
          return Response.json({ content, path: filePath })
        }

        // Return all source files
        const srcDir = pluginSrcDir(pluginId)
        const files = await listFilesRecursive(srcDir, srcDir)
        const sources: Record<string, string> = {}
        await Promise.all(
          files.map(async (f) => {
            sources[f] = await fs.readFile(path.join(srcDir, f), "utf-8")
          })
        )
        return Response.json({ sources })
      }

      // ── get-manifest ───────────────────────────────────
      case "get-manifest": {
        const { pluginId } = body as { pluginId: string }
        if (!pluginId) return Response.json({ error: "pluginId required" })
        const manifestPath = path.join(pluginDir(pluginId), "plugin.json")
        const manifest = JSON.parse(await fs.readFile(manifestPath, "utf-8"))
        return Response.json({ manifest })
      }

      // ── clone-view ─────────────────────────────────────
      case "clone-view": {
        const { viewId } = body as { viewId: string }
        if (!viewId) return Response.json({ error: "viewId required" })

        const viewPath = path.join(VIEWS_DIR, viewId, "index.tsx")
        const fullPath = path.resolve(viewPath)
        if (!fullPath.startsWith(VIEWS_DIR)) return Response.json({ error: "Invalid viewId" })

        try {
          const source = await fs.readFile(viewPath, "utf-8")
          return Response.json({ source, viewId })
        } catch {
          return Response.json({ error: `Built-in view "${viewId}" not found` })
        }
      }

      // ── install-deps ───────────────────────────────────
      case "install-deps": {
        const { pluginId, deps } = body as {
          pluginId: string
          deps: Record<string, string>
        }
        if (!pluginId || !deps) return Response.json({ error: "pluginId and deps required" })

        const dir = pluginDir(pluginId)
        await ensureDir(dir)

        // Write/update package.json
        const pkgPath = path.join(dir, "package.json")
        let pkg: Record<string, unknown> = { name: pluginId, version: "0.1.0", private: true }
        try { pkg = JSON.parse(await fs.readFile(pkgPath, "utf-8")) } catch { /* new */ }
        pkg.dependencies = { ...(pkg.dependencies as object ?? {}), ...deps }
        await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2))

        // Install deps
        try {
          await execFileAsync("npm", ["install", "--prefix", dir], { timeout: 120_000 })
          return Response.json({ ok: true, installed: Object.keys(deps) })
        } catch (err) {
          return Response.json({ error: `npm install failed: ${String(err)}` })
        }
      }

      // ── delete ─────────────────────────────────────────
      case "delete": {
        const { pluginId } = body as { pluginId: string }
        if (!pluginId) return Response.json({ error: "pluginId required" })
        const dir = pluginDir(pluginId)
        if (!dir.startsWith(PLUGINS_DIR)) return Response.json({ error: "Invalid pluginId" })
        await fs.rm(dir, { recursive: true, force: true })
        return Response.json({ ok: true })
      }

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}

// ── helpers ────────────────────────────────────────────────

async function listFilesRecursive(dir: string, base: string): Promise<string[]> {
  const result: string[] = []
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const e of entries) {
      const full = path.join(dir, e.name)
      const rel = path.relative(base, full)
      if (e.isDirectory()) {
        result.push(...(await listFilesRecursive(full, base)))
      } else {
        result.push(rel)
      }
    }
  } catch { /* dir doesn't exist */ }
  return result
}
