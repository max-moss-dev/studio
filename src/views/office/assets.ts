import type { AgentRole, AgentStatus } from "@/lib/types"

export const ROLE_COLORS: Record<AgentRole, { primary: string; secondary: string }> = {
  orchestrator: { primary: "#3b82f6", secondary: "#1d4ed8" },
  coder: { primary: "#22c55e", secondary: "#15803d" },
  reviewer: { primary: "#a855f7", secondary: "#7e22ce" },
  researcher: { primary: "#f97316", secondary: "#c2410c" },
  custom: { primary: "#6b7280", secondary: "#4b5563" },
}

export const STATUS_RING_COLORS: Record<AgentStatus, string> = {
  online: "#22c55e",
  busy: "#eab308",
  offline: "#6b7280",
  error: "#ef4444",
}

export function createCharacterSvg(
  initials: string,
  role: AgentRole,
  status: AgentStatus
): string {
  const colors = ROLE_COLORS[role]
  const ringColor = STATUS_RING_COLORS[status]

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="64" viewBox="0 0 48 64">
  <!-- Status ring -->
  <circle cx="24" cy="20" r="18" fill="none" stroke="${ringColor}" stroke-width="2.5" opacity="0.8"/>
  <!-- Head -->
  <circle cx="24" cy="20" r="14" fill="${colors.primary}"/>
  <!-- Initials -->
  <text x="24" y="25" text-anchor="middle" font-family="system-ui, sans-serif" font-size="12" font-weight="600" fill="white">${initials}</text>
  <!-- Body -->
  <path d="M12 40 C12 34, 36 34, 36 40 L38 58 C38 60, 8 60, 8 58 Z" fill="${colors.secondary}" opacity="0.9"/>
  <!-- Shoulder highlights -->
  <ellipse cx="14" cy="42" rx="4" ry="3" fill="${colors.primary}" opacity="0.4"/>
  <ellipse cx="34" cy="42" rx="4" ry="3" fill="${colors.primary}" opacity="0.4"/>
</svg>`.trim()

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function createDeskSvg(): string {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="80" height="48" viewBox="0 0 80 48">
  <!-- Desk top (isometric) -->
  <polygon points="40,4 76,20 40,36 4,20" fill="#2a2a2e" stroke="#3a3a3e" stroke-width="1"/>
  <!-- Desk front -->
  <polygon points="4,20 40,36 40,44 4,28" fill="#222226" stroke="#3a3a3e" stroke-width="0.5"/>
  <!-- Desk side -->
  <polygon points="40,36 76,20 76,28 40,44" fill="#1a1a1e" stroke="#3a3a3e" stroke-width="0.5"/>
  <!-- Monitor -->
  <rect x="28" y="2" width="24" height="16" rx="2" fill="#111115" stroke="#444" stroke-width="0.5"/>
  <rect x="30" y="4" width="20" height="12" rx="1" fill="#1a1a2e" opacity="0.8"/>
  <!-- Screen glow -->
  <rect x="31" y="5" width="18" height="10" rx="0.5" fill="#2563eb" opacity="0.15"/>
</svg>`.trim()

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function createFloorTileSvg(): string {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32" viewBox="0 0 64 32">
  <polygon points="32,0 64,16 32,32 0,16" fill="#18181b" stroke="#27272a" stroke-width="0.5"/>
</svg>`.trim()

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function createBubbleSvg(text: string, maxWidth: number = 160): string {
  const truncated = text.length > 40 ? text.slice(0, 37) + "..." : text
  const width = Math.min(Math.max(truncated.length * 6 + 16, 60), maxWidth)
  const height = 28

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height + 8}" viewBox="0 0 ${width} ${height + 8}">
  <rect x="0" y="0" width="${width}" height="${height}" rx="6" fill="#27272a" opacity="0.95"/>
  <polygon points="${width / 2 - 4},${height} ${width / 2},${height + 6} ${width / 2 + 4},${height}" fill="#27272a" opacity="0.95"/>
  <text x="${width / 2}" y="${height / 2 + 4}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="9" fill="#d4d4d8">${truncated}</text>
</svg>`.trim()

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
