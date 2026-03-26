/**
 * OpenClaw Gateway WebSocket client.
 *
 * Implements the real OpenClaw protocol:
 *   - Framing: req/res/event
 *   - Handshake: wait for connect.challenge → send connect req → receive hello-ok res
 *   - Tick keepalive based on policy.tickIntervalMs
 */

type MessageHandler = (data: unknown) => void

let _reqId = 0
function nextReqId(): string {
  return `hub-${Date.now().toString(36)}-${(++_reqId).toString(36)}`
}

// Pending request waiting for a response
interface PendingReq {
  resolve: (payload: unknown) => void
  reject: (error: unknown) => void
  timer: ReturnType<typeof setTimeout>
}

export class WsClient {
  private ws: WebSocket | null = null
  private url: string = ""
  private apiKey: string = ""
  private handlers: Set<MessageHandler> = new Set()
  private pendingReqs: Map<string, PendingReq> = new Map()
  private reconnectAttempt = 0
  private maxReconnectDelay = 30_000
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private tickTimer: ReturnType<typeof setInterval> | null = null
  private _connected = false
  private _authenticated = false
  private _intentionalClose = false

  get connected(): boolean {
    return this._connected && this._authenticated
  }

  connect(url: string, apiKey: string): void {
    this._intentionalClose = false
    this.url = url
    this.apiKey = apiKey
    this.reconnectAttempt = 0
    this.doConnect()
  }

  disconnect(): void {
    this._intentionalClose = true
    this.cleanup()
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this._connected = false
    this._authenticated = false
  }

  /**
   * Send a raw JSON frame. For internal use and mock compatibility.
   */
  sendRaw(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }

  /**
   * Send an RPC request and return a promise for the response payload.
   */
  request(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = nextReqId()
      const timer = setTimeout(() => {
        this.pendingReqs.delete(id)
        reject(new Error(`Request ${method} timed out`))
      }, 30_000)

      this.pendingReqs.set(id, { resolve, reject, timer })
      this.sendRaw({ type: "req", id, method, params })
    })
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  private doConnect(): void {
    try {
      // Connect to bare WS URL — auth happens via the protocol handshake
      this.ws = new WebSocket(this.url)

      this.ws.onopen = () => {
        this._connected = true
        this.reconnectAttempt = 0
        // Don't notify _connected yet — wait for handshake to complete.
        // The gateway will send a connect.challenge event first.
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string)
          this.handleFrame(data)
        } catch {
          // Ignore malformed messages
        }
      }

      this.ws.onclose = () => {
        this._connected = false
        this._authenticated = false
        this.stopTick()
        this.notify({ type: "_disconnected" })
        if (!this._intentionalClose) {
          this.scheduleReconnect()
        }
      }

      this.ws.onerror = () => {
        // onclose will fire after onerror
      }
    } catch {
      this.scheduleReconnect()
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleFrame(frame: any): void {
    if (!frame || typeof frame !== "object" || !frame.type) return

    switch (frame.type) {
      case "event":
        this.handleEvent(frame)
        break

      case "res":
        this.handleResponse(frame)
        break

      case "req":
        // Gateway sending a request to us (rare, but handle gracefully)
        // For now just ack it
        this.sendRaw({ type: "res", id: frame.id, ok: true, payload: {} })
        break
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleEvent(frame: any): void {
    const eventName = frame.event as string

    if (eventName === "connect.challenge") {
      // Gateway is challenging us — respond with connect request
      this.sendConnectRequest(frame.payload?.nonce)
      return
    }

    // Forward all other events to handlers
    this.notify(frame)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleResponse(frame: any): void {
    const id = frame.id as string
    const pending = this.pendingReqs.get(id)

    if (pending) {
      clearTimeout(pending.timer)
      this.pendingReqs.delete(id)

      if (frame.ok) {
        // Check if this is the hello-ok response
        if (frame.payload?.type === "hello-ok") {
          this.onHandshakeComplete(frame.payload)
        }
        pending.resolve(frame.payload)
      } else {
        pending.reject(frame.error || { message: "Request failed" })
      }
      return
    }

    // Unsolicited response — might be the connect response
    if (frame.ok && frame.payload?.type === "hello-ok") {
      this.onHandshakeComplete(frame.payload)
    }
  }

  private sendConnectRequest(nonce?: string): void {
    const id = nextReqId()

    // Register as pending so we catch the hello-ok response
    const timer = setTimeout(() => {
      this.pendingReqs.delete(id)
      console.error("[WsClient] Connect handshake timed out")
      this.notify({ type: "_disconnected" })
    }, 15_000)

    this.pendingReqs.set(id, {
      resolve: () => {},
      reject: (err) => console.error("[WsClient] Connect rejected:", err),
      timer,
    })

    const connectReq = {
      type: "req",
      id,
      method: "connect",
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: "openclaw-hub",
          version: "0.1.0",
          platform: "web",
          mode: "operator",
        },
        role: "operator",
        scopes: ["operator.read", "operator.write"],
        caps: [],
        commands: [],
        permissions: {},
        auth: { token: this.apiKey },
        locale: navigator?.language ?? "en-US",
        userAgent: "openclaw-hub/0.1.0",
        ...(nonce
          ? {
              device: {
                id: this.getDeviceId(),
                nonce,
              },
            }
          : {}),
      },
    }

    this.sendRaw(connectReq)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private onHandshakeComplete(payload: any): void {
    this._authenticated = true

    // Start tick keepalive based on server policy
    const tickMs = payload?.policy?.tickIntervalMs ?? 15_000
    this.startTick(tickMs)

    // Store device token if issued
    if (payload?.auth?.deviceToken) {
      try {
        localStorage.setItem("openclaw-device-token", payload.auth.deviceToken)
      } catch {
        // ignore
      }
    }

    // Notify handlers that we're fully connected
    this.notify({ type: "_connected", payload })
  }

  private getDeviceId(): string {
    try {
      let id = localStorage.getItem("openclaw-hub-device-id")
      if (!id) {
        id = `hub-${crypto.randomUUID()}`
        localStorage.setItem("openclaw-hub-device-id", id)
      }
      return id
    } catch {
      return `hub-${Date.now().toString(36)}`
    }
  }

  private scheduleReconnect(): void {
    if (this._intentionalClose) return
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempt),
      this.maxReconnectDelay
    )
    this.reconnectAttempt++
    this.reconnectTimer = setTimeout(() => this.doConnect(), delay)
  }

  private startTick(intervalMs: number): void {
    this.stopTick()
    // OpenClaw uses tick-based keepalive, not ping/pong
    this.tickTimer = setInterval(() => {
      this.sendRaw({
        type: "req",
        id: nextReqId(),
        method: "tick",
        params: {},
      })
    }, intervalMs)
  }

  private stopTick(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer)
      this.tickTimer = null
    }
  }

  private cleanup(): void {
    this.stopTick()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    // Reject all pending requests
    for (const [id, pending] of this.pendingReqs) {
      clearTimeout(pending.timer)
      pending.reject(new Error("Connection closed"))
    }
    this.pendingReqs.clear()
  }

  private notify(data: unknown): void {
    for (const handler of this.handlers) {
      handler(data)
    }
  }
}
