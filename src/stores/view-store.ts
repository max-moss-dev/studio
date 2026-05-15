"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { ViewDefinition } from "@/lib/types"
import {
  fetchPlugin,
  pluginToView,
  exportPluginManifest,
} from "@/lib/plugin-loader"
import { generateSkill } from "@/lib/skill-generator"

// Built-in views registered at startup
const BUILT_IN_VIEWS: ViewDefinition[] = [
  {
    id: "agent-manager",
    title: "Agent Manager",
    icon: "bot",
    type: "built-in",
  },
  {
    id: "kanban",
    title: "Kanban",
    icon: "kanban",
    type: "built-in",
  },
  {
    id: "chats",
    title: "Chats",
    icon: "message-square",
    type: "built-in",
  },
  {
    id: "office",
    title: "Network",
    icon: "share-2",
    type: "built-in",
  },
  {
    id: "media",
    title: "Media",
    icon: "file-text",
    type: "built-in",
  },
  {
    id: "todo",
    title: "Tasks",
    icon: "check-circle",
    type: "built-in",
  },
  {
    id: "app-factory",
    title: "MCP Apps",
    icon: "server",
    type: "built-in",
  },
  {
    id: "settings",
    title: "Settings",
    icon: "settings",
    type: "built-in",
  },
  {
    id: "view-picker",
    title: "New Tab",
    icon: "layout-grid",
    type: "built-in",
  },
]

/**
 * Validate a ViewPackage JSON for import.
 */
function validateViewPackage(data: unknown): ViewDefinition {
  if (!data || typeof data !== "object") {
    throw new Error("View package must be a JSON object")
  }
  const d = data as Record<string, unknown>
  if (typeof d.id !== "string" || !d.id.trim()) {
    throw new Error("View package must have a non-empty 'id'")
  }
  if (typeof d.title !== "string" || !d.title.trim()) {
    throw new Error("View package must have a non-empty 'title'")
  }
  if (typeof d.code !== "string" || !d.code.trim()) {
    throw new Error("View package must have non-empty 'code'")
  }

  return {
    id: d.id,
    title: d.title,
    icon: typeof d.icon === "string" ? d.icon : "sparkles",
    type: "ai-generated",
    code: d.code,
    dependencies: d.dependencies && typeof d.dependencies === "object"
      ? d.dependencies as Record<string, string>
      : undefined,
    skill: typeof d.skill === "string" ? d.skill : undefined,
    description: typeof d.description === "string" ? d.description : undefined,
    author: typeof d.author === "string" ? d.author : undefined,
    version: typeof d.version === "string" ? d.version : undefined,
    createdAt: typeof d.createdAt === "number" ? d.createdAt : Date.now(),
  }
}

interface ViewState {
  views: ViewDefinition[]
  installing: boolean
  installError: string | null

  registerView: (view: ViewDefinition) => void
  removeView: (id: string) => void
  getView: (id: string) => ViewDefinition | undefined
  getAiViews: () => ViewDefinition[]
  getBuiltInViews: () => ViewDefinition[]
  getPlugins: () => ViewDefinition[]

  // Plugin actions
  installPlugin: (url: string) => Promise<ViewDefinition>
  exportPlugin: (id: string) => string | null
  clearInstallError: () => void

  // ViewPackage import/export
  importPackage: (json: string) => ViewDefinition
  exportPackage: (id: string) => string | null
  importPackageFromUrl: (url: string) => Promise<ViewDefinition>
}

export const useViewStore = create<ViewState>()(
  persist(
    (set, get) => ({
      views: [...BUILT_IN_VIEWS],
      installing: false,
      installError: null,

      registerView(view: ViewDefinition) {
        // Auto-generate skill if view has code but no skill
        let viewWithSkill = view
        if (view.code && !view.skill) {
          viewWithSkill = {
            ...view,
            skill: generateSkill({
              title: view.title,
              code: view.code,
              dependencies: view.dependencies,
            }),
          }
        }
        set((s) => {
          const filtered = s.views.filter((v) => v.id !== viewWithSkill.id)
          return { views: [...filtered, viewWithSkill] }
        })
      },

      removeView(id: string) {
        set((s) => ({
          views: s.views.filter(
            (v) => v.id !== id || v.type === "built-in"
          ),
        }))
      },

      getView(id: string) {
        return get().views.find((v) => v.id === id)
      },

      getAiViews() {
        return get().views.filter((v) => v.type === "ai-generated")
      },

      getBuiltInViews() {
        return get().views.filter((v) => v.type === "built-in")
      },

      getPlugins() {
        return get().views.filter((v) => v.type === "plugin")
      },

      async installPlugin(url: string) {
        set({ installing: true, installError: null })
        try {
          const plugin = await fetchPlugin(url)
          const view = pluginToView(plugin)
          set((s) => {
            const filtered = s.views.filter((v) => v.id !== view.id)
            return { views: [...filtered, view], installing: false }
          })
          return view
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Failed to install plugin"
          set({ installing: false, installError: message })
          throw err
        }
      },

      exportPlugin(id: string) {
        const view = get().views.find((v) => v.id === id)
        if (!view || !view.code) return null
        return exportPluginManifest(view)
      },

      clearInstallError() {
        set({ installError: null })
      },

      // ── ViewPackage import/export ──────────────────────

      importPackage(json: string): ViewDefinition {
        const data = JSON.parse(json)
        const view = validateViewPackage(data)
        set((s) => {
          const filtered = s.views.filter((v) => v.id !== view.id)
          return { views: [...filtered, view] }
        })
        return view
      },

      exportPackage(id: string): string | null {
        const view = get().views.find((v) => v.id === id)
        if (!view || !view.code) return null

        const pkg: Record<string, unknown> = {
          id: view.id,
          title: view.title,
          icon: view.icon,
          description: view.description,
          code: view.code,
        }

        if (view.dependencies && Object.keys(view.dependencies).length > 0) {
          pkg.dependencies = view.dependencies
        }
        if (view.skill) {
          pkg.skill = view.skill
        }
        if (view.author) pkg.author = view.author
        if (view.version) pkg.version = view.version

        return JSON.stringify(pkg, null, 2)
      },

      async importPackageFromUrl(url: string): Promise<ViewDefinition> {
        set({ installing: true, installError: null })
        try {
          const res = await fetch(url)
          if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`)
          const json = await res.text()
          const view = get().importPackage(json)
          set({ installing: false })
          return view
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Failed to import from URL"
          set({ installing: false, installError: message })
          throw err
        }
      },
    }),
    {
      name: "openclaw-views",
      partialize: (state) => ({ views: state.views }),
      merge: (persisted, current) => {
        const persistedState = persisted as Partial<ViewState> | undefined
        if (!persistedState?.views) return current
        // Preserve installed plugins and AI views across reloads
        const userViews = persistedState.views.filter(
          (v) => v.type === "ai-generated" || v.type === "plugin"
        )
        return {
          ...current,
          views: [...BUILT_IN_VIEWS, ...userViews],
        }
      },
    }
  )
)
