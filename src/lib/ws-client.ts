type MessageHandler = (data: unknown) => void

export class WsClient {
  private ws: WebSocket | null = null
  private url: string = ""
  private apiKey: string = ""
  private handlers: Set<MessageHandler> = new Set()
  private reconnectAttempt = 0
  private maxReconnectDelay = 30_000
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private _connected = false
  private _intentionalClose = false

  get connected(): boolean {
    return this._connected
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
  }

  send(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  private doConnect(): void {
    try {
      const separator = this.url.includes("?") ? "&" : "?"
      const wsUrl = `${this.url}${separator}apiKey=${encodeURIComponent(this.apiKey)}`
      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {
        this._connected = true
        this.reconnectAttempt = 0
        this.startPing()
        // Notify handlers of connection
        this.notify({ type: "_connected" })
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string)
          this.notify(data)
        } catch {
          // Ignore malformed messages
        }
      }

      this.ws.onclose = () => {
        this._connected = false
        this.stopPing()
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

  private scheduleReconnect(): void {
    if (this._intentionalClose) return
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempt),
      this.maxReconnectDelay
    )
    this.reconnectAttempt++
    this.reconnectTimer = setTimeout(() => this.doConnect(), delay)
  }

  private startPing(): void {
    this.pingTimer = setInterval(() => {
      this.send({ type: "ping" })
    }, 30_000)
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }

  private cleanup(): void {
    this.stopPing()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private notify(data: unknown): void {
    for (const handler of this.handlers) {
      handler(data)
    }
  }
}
