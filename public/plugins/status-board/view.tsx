function StatusCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{
      padding: 20,
      borderRadius: 12,
      background: "var(--card, #1a1a2e)",
      border: "1px solid var(--border, #333)",
      minWidth: 140,
      textAlign: "center",
    }}>
      <div style={{ fontSize: 32, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 13, color: "var(--muted-foreground, #888)", marginTop: 4 }}>{label}</div>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function View({ agents }: { agents: any[] }) {
  const online = (agents || []).filter(a => a.status === "online").length
  const busy = (agents || []).filter(a => a.status === "busy").length
  const offline = (agents || []).filter(a => a.status === "offline").length
  const total = (agents || []).length

  return (
    <div style={{ padding: 32 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24, color: "var(--foreground, #fff)" }}>
        Agent Status Board
      </h2>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <StatusCard label="Total" value={total} color="var(--foreground, #fff)" />
        <StatusCard label="Online" value={online} color="#22c55e" />
        <StatusCard label="Busy" value={busy} color="#f59e0b" />
        <StatusCard label="Offline" value={offline} color="#ef4444" />
      </div>
      {(agents || []).length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 12, color: "var(--muted-foreground, #888)" }}>
            Agents
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {agents.map(a => (
              <div key={a.id} style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 16px",
                borderRadius: 8,
                border: "1px solid var(--border, #333)",
                background: "var(--card, #1a1a2e)",
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: a.status === "online" ? "#22c55e" : a.status === "busy" ? "#f59e0b" : "#ef4444",
                }} />
                <span style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground, #fff)" }}>{a.name}</span>
                <span style={{ fontSize: 12, color: "var(--muted-foreground, #888)", marginLeft: "auto" }}>{a.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
