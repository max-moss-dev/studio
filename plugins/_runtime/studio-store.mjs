/**
 * @studio/store runtime shim for Studio plugins.
 * esbuild aliases "@studio/store" → this file.
 * Exposes Studio Zustand stores to plugins.
 */
const s = globalThis.__studio_store

export const useGatewayStore = s?.useGatewayStore
export const useTabStore = s?.useTabStore
