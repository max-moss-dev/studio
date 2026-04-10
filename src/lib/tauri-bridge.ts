/**
 * Tauri bridge — utilities for detecting and interacting with the Tauri desktop shell.
 *
 * All Tauri-specific code should go through this module.
 * When running in a browser, all functions are safe no-ops.
 */

/** True when running inside a Tauri webview */
export const isTauri =
  typeof window !== "undefined" && "__TAURI__" in window

/**
 * Get the Tauri API module dynamically (only available in Tauri).
 * Returns null in browser.
 */
export async function getTauriApi() {
  if (!isTauri) return null
  try {
    return await import("@tauri-apps/api/core")
  } catch {
    return null
  }
}

/**
 * Invoke a Tauri command. No-op in browser.
 */
export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  const api = await getTauriApi()
  if (!api) return null
  return api.invoke<T>(cmd, args)
}

/**
 * Send a desktop notification. Falls back to Web Notification API in browsers.
 */
export async function sendNotification(title: string, body: string) {
  if (isTauri) {
    try {
      const { sendNotification: notify } = await import("@tauri-apps/plugin-notification")
      await notify({ title, body })
      return
    } catch {
      // Fall through to web notification
    }
  }

  // Browser fallback
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    new Notification(title, { body })
  }
}

/**
 * Open a native file dialog to pick a JSON file.
 * Returns file content as string, or null if cancelled.
 * In browser, returns null (use browser file picker instead).
 */
export async function openFileDialog(): Promise<string | null> {
  if (!isTauri) return null
  try {
    const { open } = await import("@tauri-apps/plugin-dialog")
    const { readTextFile } = await import("@tauri-apps/plugin-fs")
    const path = await open({
      filters: [{ name: "JSON", extensions: ["json"] }],
      multiple: false,
    })
    if (!path) return null
    return await readTextFile(path as string)
  } catch {
    return null
  }
}

/**
 * Open a native save dialog and write content to file.
 * In browser, returns false (use browser download instead).
 */
export async function saveFileDialog(
  content: string,
  defaultName: string
): Promise<boolean> {
  if (!isTauri) return false
  try {
    const { save } = await import("@tauri-apps/plugin-dialog")
    const { writeTextFile } = await import("@tauri-apps/plugin-fs")
    const path = await save({
      filters: [{ name: "JSON", extensions: ["json"] }],
      defaultPath: defaultName,
    })
    if (!path) return false
    await writeTextFile(path, content)
    return true
  } catch {
    return false
  }
}
