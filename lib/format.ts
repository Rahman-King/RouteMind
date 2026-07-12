export function initials(name?: string, email?: string) {
  const source = (name || email || "?").trim()
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return source.slice(0, 2).toUpperCase()
}

export function timeAgo(ts: number) {
  const diff = Date.now() - ts
  const mins = Math.round(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d`
  const weeks = Math.round(days / 7)
  return `${weeks}w`
}

export function compactNumber(n: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n)
}

export function currency(n: number) {
  return `$${n.toFixed(n < 1 ? 4 : 2)}`
}
