// Pure helpers for the cache TTL footer plugin. Kept separate so they can be
// exercised without the TUI runtime.

export const DEFAULT_TTL_MS = 5 * 60_000

const UNITS: Record<string, number> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
}

/** Parse a models.dev-style lifetime such as "5m", "1h" or "30s". */
export function parseTTL(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined
  const match = /^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/.exec(value.trim())
  if (!match) return undefined
  const amount = Number(match[1])
  const unit = UNITS[match[2]!]!
  if (!Number.isFinite(amount) || amount <= 0) return undefined
  return amount * unit
}

/** Compact remaining time: "5m", "4m 22s", "42s", "1h 5m". */
export function formatDuration(ms: number): string {
  const seconds = Math.ceil(ms / 1_000)
  if (seconds >= 3_600) {
    const hours = Math.floor(seconds / 3_600)
    const minutes = Math.floor((seconds % 3_600) / 60)
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60)
    const rest = seconds % 60
    return rest > 0 ? `${minutes}m ${rest}s` : `${minutes}m`
  }
  return `${seconds}s`
}

export type CacheMessage = {
  readonly id: string
  readonly type: string
  readonly status?: string
  readonly time: { readonly created: number }
  readonly tokens?: { readonly cache: { readonly read: number; readonly write: number } }
  readonly model?: { readonly providerID: string; readonly id: string }
}

export type CacheActivity = {
  readonly at: number
  readonly providerID: string
  readonly modelID: string
}

/**
 * The latest assistant step that actually used the provider prompt cache.
 * A cache hit refreshes the lifetime just like a write, so either resets it.
 * Steps before the last completed compaction are ignored: compaction replaces
 * the cached prefix with a new summary.
 */
export function findLatestCacheActivity(
  messages: ReadonlyArray<CacheMessage>,
  boundary?: string,
): CacheActivity | undefined {
  const boundaryIndex = boundary ? messages.findIndex((message) => message.id === boundary) : -1
  if (boundary && boundaryIndex === -1) return undefined
  const end = boundaryIndex === -1 ? messages.length : boundaryIndex
  const compactionIndex = messages.findLastIndex(
    (message, index) => message.type === "compaction" && message.status === "completed" && index < end,
  )
  for (let index = end - 1; index > compactionIndex; index--) {
    const message = messages[index]!
    if (message.type !== "assistant" || !message.model) continue
    const tokens = message.tokens
    if (!tokens || tokens.cache.read + tokens.cache.write <= 0) continue
    return {
      at: message.time.created,
      providerID: message.model.providerID,
      modelID: message.model.id,
    }
  }
  return undefined
}
