/**
 * Multi-provider configuration.
 * OpenClaw = multi-agent orchestrator (WebSocket gateway)
 * OpenCode = universal coding agent (HTTP server, any LLM backend)
 */

export type ProviderId = "openclaw" | "opencode"

export interface ProviderConfig {
  enabled: boolean
  url?: string
  apiKey?: string
}

export type ProvidersConfig = Record<ProviderId, ProviderConfig>

const STORAGE_KEY = "studio-providers"

const DEFAULT_CONFIG: ProvidersConfig = {
  openclaw: { enabled: false, url: "ws://localhost:18789", apiKey: "" },
  opencode: { enabled: false, url: "http://localhost:4096" },
}

export function loadProviders(): ProvidersConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        openclaw: { ...DEFAULT_CONFIG.openclaw, ...parsed.openclaw },
        opencode: { ...DEFAULT_CONFIG.opencode, ...parsed.opencode },
      }
    }
  } catch {}
  return { ...DEFAULT_CONFIG }
}

export function saveProviders(config: ProvidersConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch {}
}

export function getEnabledProviders(config: ProvidersConfig): ProviderId[] {
  return (Object.keys(config) as ProviderId[]).filter((id) => config[id].enabled)
}
