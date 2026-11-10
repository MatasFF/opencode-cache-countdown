// @bun
// src/tui.tsx
import { effect as _$effect } from "@opentui/solid";
import { insert as _$insert } from "@opentui/solid";
import { setProp as _$setProp } from "@opentui/solid";
import { createElement as _$createElement } from "@opentui/solid";
import { createComponent as _$createComponent } from "@opentui/solid";
import { Plugin } from "@opencode/plugin/tui";
import { createMemo, createSignal, onCleanup, Show } from "solid-js";

// src/logic.ts
var DEFAULT_TTL_MS = 5 * 60000;
var UNITS = {
  ms: 1,
  s: 1000,
  m: 60000,
  h: 3600000,
  d: 86400000
};
function parseTTL(value) {
  if (typeof value !== "string")
    return;
  const match = /^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/.exec(value.trim());
  if (!match)
    return;
  const amount = Number(match[1]);
  const unit = UNITS[match[2]];
  if (!Number.isFinite(amount) || amount <= 0)
    return;
  return amount * unit;
}
function formatDuration(ms) {
  const seconds = Math.ceil(ms / 1000);
  if (seconds >= 3600) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor(seconds % 3600 / 60);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return rest > 0 ? `${minutes}m ${rest}s` : `${minutes}m`;
  }
  return `${seconds}s`;
}
function findLatestCacheActivity(messages, boundary) {
  const boundaryIndex = boundary ? messages.findIndex((message) => message.id === boundary) : -1;
  if (boundary && boundaryIndex === -1)
    return;
  const end = boundaryIndex === -1 ? messages.length : boundaryIndex;
  const compactionIndex = messages.findLastIndex((message, index) => message.type === "compaction" && message.status === "completed" && index < end);
  for (let index = end - 1;index > compactionIndex; index--) {
    const message = messages[index];
    if (message.type !== "assistant" || !message.model)
      continue;
    const tokens = message.tokens;
    if (!tokens || tokens.cache.read + tokens.cache.write <= 0)
      continue;
    return {
      at: message.time.created,
      providerID: message.model.providerID,
      modelID: message.model.id
    };
  }
  return;
}

// src/tui.tsx
function CacheTtl(props) {
  const [now, setNow] = createSignal(Date.now());
  const ticker = setInterval(() => setNow(Date.now()), 1000);
  onCleanup(() => clearInterval(ticker));
  const session = createMemo(() => props.sessionID ? props.context.data.session.get(props.sessionID) : undefined);
  const activity = createMemo(() => {
    if (!props.sessionID)
      return;
    return findLatestCacheActivity(props.context.data.session.message.list(props.sessionID), session()?.revert?.messageID);
  });
  const ttl = createMemo(() => {
    const current = activity();
    if (!current)
      return DEFAULT_TTL_MS;
    const location = session()?.location;
    const models = location ? props.context.data.location.model.list(location) : undefined;
    const model = models?.find((item) => item.providerID === current.providerID && item.id === current.modelID);
    return parseTTL(model?.settings?.cache?.ttl) ?? parseTTL(props.context.options.ttl) ?? DEFAULT_TTL_MS;
  });
  const remaining = createMemo(() => {
    const current = activity();
    if (!current)
      return;
    return Math.max(0, Math.min(ttl(), current.at + ttl() - now()));
  });
  const label = createMemo(() => {
    const left = remaining();
    if (left === undefined)
      return;
    return left <= 0 ? "cache expired" : `cache ${formatDuration(left)}`;
  });
  const color = createMemo(() => {
    const left = remaining();
    if (left === undefined)
      return props.context.theme.text.muted;
    if (left <= 0)
      return props.context.theme.text.feedback.error.base;
    if (left <= 60000)
      return props.context.theme.text.feedback.warning.base;
    return props.context.theme.text.muted;
  });
  return _$createComponent(Show, {
    get when() {
      return label();
    },
    children: (value) => (() => {
      var _el$ = _$createElement("text");
      _$setProp(_el$, "wrapMode", "none");
      _$setProp(_el$, "flexShrink", 0);
      _$insert(_el$, value);
      _$effect((_$p) => _$setProp(_el$, "fg", color(), _$p));
      return _el$;
    })()
  });
}
var tui_default = Plugin.define({
  id: "cache-countdown",
  setup(context) {
    context.ui.slot({
      append: "prompt.footer",
      render: (props) => _$createComponent(CacheTtl, {
        context,
        get sessionID() {
          return props.sessionID;
        }
      })
    });
  }
});
export {
  tui_default as default
};
