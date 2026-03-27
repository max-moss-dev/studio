"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { ViewDefinition } from "@/lib/types"
import {
  fetchPlugin,
  pluginToView,
  exportPluginManifest,
} from "@/lib/plugin-loader"

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
    title: "Office",
    icon: "building-2",
    type: "built-in",
  },
]

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
}

export const useViewStore = create<ViewState>()(
  persist(
    (set, get) => ({
      views: [...BUILT_IN_VIEWS],
      installing: false,
      installError: null,

      registerView(view: ViewDefinition) {
        set((s) => {
          const filtered = s.views.filter((v) => v.id !== view.id)
          return { views: [...filtered, view] }
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
