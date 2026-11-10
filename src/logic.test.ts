import { describe, expect, test } from "bun:test"
import { DEFAULT_TTL_MS, findLatestCacheActivity, formatDuration, parseTTL } from "./logic"

describe("parseTTL", () => {
  test("parses models.dev lifetimes", () => {
    expect(parseTTL("5m")).toBe(300_000)
    expect(parseTTL("1h")).toBe(3_600_000)
    expect(parseTTL("30s")).toBe(30_000)
    expect(parseTTL("1.5h")).toBe(5_400_000)
    expect(parseTTL("2d")).toBe(172_800_000)
  })

  test("rejects missing or invalid lifetimes", () => {
    expect(parseTTL(undefined)).toBeUndefined()
    expect(parseTTL("nope")).toBeUndefined()
    expect(parseTTL("0m")).toBeUndefined()
  })

  test("the default is five minutes", () => {
    expect(DEFAULT_TTL_MS).toBe(300_000)
  })
})

describe("formatDuration", () => {
  test("formats the way the footer shows it", () => {
    expect(formatDuration(300_000)).toBe("5m")
    expect(formatDuration(299_999)).toBe("5m")
    expect(formatDuration(262_000)).toBe("4m 22s")
    expect(formatDuration(191_000)).toBe("3m 11s")
    expect(formatDuration(60_000)).toBe("1m")
    expect(formatDuration(59_000)).toBe("59s")
    expect(formatDuration(42_000)).toBe("42s")
    expect(formatDuration(3_600_000)).toBe("1h")
    expect(formatDuration(3_900_000)).toBe("1h 5m")
  })
})

type Message = Parameters<typeof findLatestCacheActivity>[0][number]

const assistant = (id: string, at: number, read: number, write: number): Message => ({
  id,
  type: "assistant",
  time: { created: at },
  model: { providerID: "amazon-bedrock", id: "anthropic.claude-opus-5-5" },
  tokens: { cache: { read, write } },
})

describe("findLatestCacheActivity", () => {
  const messages: Message[] = [
    { id: "u1", type: "user", time: { created: 1_000 } },
    assistant("a1", 2_000, 0, 10_000),
    { id: "u2", type: "user", time: { created: 3_000 } },
    assistant("a2", 4_000, 10_000, 100),
  ]

  test("returns the newest cache read or write", () => {
    expect(findLatestCacheActivity(messages)).toEqual({
      at: 4_000,
      providerID: "amazon-bedrock",
      modelID: "anthropic.claude-opus-5-5",
    })
  })

  test("honours the revert boundary", () => {
    expect(findLatestCacheActivity(messages, "u2")?.at).toBe(2_000)
    expect(findLatestCacheActivity(messages, "missing")).toBeUndefined()
  })

  test("ignores messages without cache activity", () => {
    expect(findLatestCacheActivity([{ id: "u1", type: "user", time: { created: 1_000 } }])).toBeUndefined()
  })

  test("ignores cache activity from before the last completed compaction", () => {
    const compacted: Message[] = [
      ...messages,
      { id: "c1", type: "compaction", status: "completed", time: { created: 5_000 } },
    ]
    expect(findLatestCacheActivity(compacted)).toBeUndefined()

    const after: Message[] = [...compacted, assistant("a3", 6_000, 0, 20_000)]
    expect(findLatestCacheActivity(after)?.at).toBe(6_000)
  })
})
