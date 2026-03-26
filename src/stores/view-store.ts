"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { ViewDefinition } from "@/lib/types"

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
  registerView: (view: ViewDefinition) => void
  removeView: (id: string) => void
  getView: (id: string) => ViewDefinition | undefined
  getAiViews: () => ViewDefinition[]
  getBuiltInViews: () => ViewDefinition[]
}

export const useViewStore = create<ViewState>()(
  persist(
    (set, get) => ({
      views: [...BUILT_IN_VIEWS],

      registerView(view: ViewDefinition) {
        set((s) => {
          // Replace if same id exists
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
    }),
    {
      name: "openclaw-views",
      merge: (persisted, current) => {
        const persistedState = persisted as Partial<ViewState> | undefined
        if (!persistedState?.views) return current
        // Ensure built-in views are always present
        const aiViews = persistedState.views.filter(
          (v) => v.type === "ai-generated"
        )
        return {
          ...current,
          views: [...BUILT_IN_VIEWS, ...aiViews],
        }
      },
    }
  )
)
