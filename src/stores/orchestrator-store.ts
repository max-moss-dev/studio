"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

export { ORCHESTRATOR_AGENT_ID } from "@studio/core"

interface OrchestratorState {
  /** Whether the sidebar is currently open */
  isOpen: boolean
  /** The persistent session ID for the orchestrator sidebar chat */
  sessionId: string | null
  toggle: () => void
  setOpen: (v: boolean) => void
  setSessionId: (id: string | null) => void
}

export const useOrchestratorStore = create<OrchestratorState>()(
  persist(
    (set) => ({
      isOpen: true,
      sessionId: null,
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
      setOpen: (v) => set({ isOpen: v }),
      setSessionId: (id) => set({ sessionId: id }),
    }),
    { name: "studio-orchestrator" }
  )
)
