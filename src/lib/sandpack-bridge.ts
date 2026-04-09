/**
 * Sandpack Bridge — postMessage protocol between host app and Sandpack iframe.
 *
 * Host sends ViewProps to iframe via postMessage.
 * Iframe sends GatewayMessages back to host via postMessage.
 *
 * This file also contains the bridge wrapper source code that gets
 * injected into every Sandpack view as `/bridge.tsx`.
 */

import type { GatewayMessage } from "@/lib/types"

// ── Message types ────────────────────────────────────────

/** Messages sent from host to Sandpack iframe */
export type HostMessage =
  | { type: "props"; data: Record<string, unknown> }
  | { type: "props-update"; data: Record<string, unknown> }

/** Messages sent from Sandpack iframe to host */
export type ViewMessage =
  | { type: "send"; payload: GatewayMessage }
  | { type: "ready" }
  | { type: "error"; message: string }

// ── Bridge wrapper source ────────────────────────────────

/**
 * This code is injected into every Sandpack view as `/bridge.tsx`.
 * It provides:
 * - useViewProps() hook — returns live ViewProps from host
 * - send(msg) — sends a GatewayMessage to the host
 * - ViewBridge — wrapper component that manages the postMessage lifecycle
 */
export const BRIDGE_SOURCE = `
import { useState, useEffect, createContext, useContext, useCallback } from "react"

const ViewContext = createContext(null)

export function useViewProps() {
  const ctx = useContext(ViewContext)
  if (!ctx) throw new Error("useViewProps must be used inside a view rendered by Studio")
  return ctx
}

export function send(msg) {
  window.parent.postMessage({ type: "send", payload: msg }, "*")
}

export function ViewBridge({ children }) {
  const [props, setProps] = useState(null)

  useEffect(() => {
    function handler(e) {
      if (!e.data || typeof e.data.type !== "string") return
      if (e.data.type === "props") {
        setProps(e.data.data)
      }
      if (e.data.type === "props-update") {
        setProps((prev) => prev ? { ...prev, ...e.data.data } : e.data.data)
      }
    }
    window.addEventListener("message", handler)
    window.parent.postMessage({ type: "ready" }, "*")
    return () => window.removeEventListener("message", handler)
  }, [])

  if (!props) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        color: "#abb2bf",
        fontFamily: "system-ui, sans-serif",
        fontSize: 14,
        background: "#282c34",
      }}>
        Loading...
      </div>
    )
  }

  return <ViewContext.Provider value={props}>{children}</ViewContext.Provider>
}
`.trim()

/**
 * App.tsx wrapper that imports the user's view component
 * and wraps it in ViewBridge.
 */
export const APP_WRAPPER_SOURCE = `
import { ViewBridge } from "./bridge"
import View from "./view"

export default function App() {
  return (
    <ViewBridge>
      <View />
    </ViewBridge>
  )
}
`.trim()

/**
 * Minimal index.tsx that renders the App.
 */
export const INDEX_SOURCE = `
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App"

const root = createRoot(document.getElementById("root"))
root.render(
  <StrictMode>
    <App />
  </StrictMode>
)
`.trim()

/**
 * HTML template for the Sandpack preview with OneDark theme.
 */
export const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #282c34;
      color: #abb2bf;
      font-family: system-ui, -apple-system, sans-serif;
      overflow: auto;
    }
    #root { min-height: 100vh; }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: #282c34; }
    ::-webkit-scrollbar-thumb { background: #4b5263; border-radius: 3px; }
  </style>
</head>
<body>
  <div id="root"></div>
</body>
</html>`
