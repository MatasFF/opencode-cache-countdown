import { Plugin } from "@opencode/plugin/tui"
import { createMemo, createSignal, onCleanup, Show } from "solid-js"
import { DEFAULT_TTL_MS, findLatestCacheActivity, formatDuration, parseTTL } from "./logic"

function CacheTtl(props: { context: Plugin.Context; sessionID?: string }) {
  // One tick a second is enough for a minute-scale countdown.
  const [now, setNow] = createSignal(Date.now())
  const ticker = setInterval(() => setNow(Date.now()), 1_000)
  onCleanup(() => clearInterval(ticker))

  const session = createMemo(() => (props.sessionID ? props.context.data.session.get(props.sessionID) : undefined))

  const activity = createMemo(() => {
    if (!props.sessionID) return undefined
    return findLatestCacheActivity(
      props.context.data.session.message.list(props.sessionID),
      session()?.revert?.messageID,
    )
  })

  // Providers default to five minutes unless the model config asks for another
  // lifetime. The plugin option is a manual override for providers whose
  // implicit cache we cannot read from models.dev.
  const ttl = createMemo(() => {
    const current = activity()
    if (!current) return DEFAULT_TTL_MS
    const location = session()?.location
    const models = location ? props.context.data.location.model.list(location) : undefined
    const model = models?.find((item) => item.providerID === current.providerID && item.id === current.modelID)
    return parseTTL(model?.settings?.cache?.ttl) ?? parseTTL(props.context.options.ttl) ?? DEFAULT_TTL_MS
  })

  const remaining = createMemo(() => {
    const current = activity()
    if (!current) return undefined
    return Math.max(0, Math.min(ttl(), current.at + ttl() - now()))
  })

  const label = createMemo(() => {
    const left = remaining()
    if (left === undefined) return undefined
    return left <= 0 ? "cache expired" : `cache ${formatDuration(left)}`
  })

  const color = createMemo(() => {
    const left = remaining()
    if (left === undefined) return props.context.theme.text.muted
    if (left <= 0) return props.context.theme.text.feedback.error.base
    if (left <= 60_000) return props.context.theme.text.feedback.warning.base
    return props.context.theme.text.muted
  })

  return (
    <Show when={label()}>
      {(value) => (
        <text fg={color()} wrapMode="none" flexShrink={0}>
          {value()}
        </text>
      )}
    </Show>
  )
}

export default Plugin.define({
  id: "cache-countdown",
  setup(context) {
    context.ui.slot({
      append: "prompt.footer",
      render: (props) => <CacheTtl context={context} sessionID={props.sessionID} />,
    })
  },
})
