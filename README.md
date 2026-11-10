# opencode-cache-countdown

[![CI](https://github.com/MatasFF/opencode-cache-countdown/actions/workflows/ci.yml/badge.svg)](https://github.com/MatasFF/opencode-cache-countdown/actions/workflows/ci.yml)

A tiny OpenCode TUI plugin that shows how much prompt-cache lifetime is left in
the prompt footer, next to the context usage:

```text
1 shell · 237.1K (24%)  ctrl+p commands  cache 4m 44s
```

It counts down to `cache expired`, turning amber under one minute. The timer
resets on every assistant step that reports a cache read or write, because a
cache hit refreshes the lifetime just like a write.

Works with any provider that reports prompt-cache usage: Anthropic, Amazon
Bedrock, OpenRouter, OpenAI, and others. Hidden until the session has actual
cache activity, so providers without cache reporting never show a misleading
timer.

## Requirements

- OpenCode **V2** (verified on `2.2.7`)
- The terminal UI (`tui`), not the desktop app

## Install

### From GitHub

```sh
opencode plugin add github:MatasFF/opencode-cache-countdown
```

### From npm (after publishing)

```sh
opencode plugin add opencode-cache-countdown
```

`opencode plugin add` detects that this is a TUI-only plugin and adds it to
`~/.config/opencode/cli.json` (not `opencode.json`).

### Manually

Add the package to the `plugins` array in `~/.config/opencode/cli.json`:

```jsonc
{
  "$schema": "https://opencode.ai/v2/cli.json",
  "plugins": ["github:MatasFF/opencode-cache-countdown"]
}
```

After the package is published to npm, `"opencode-cache-countdown"` also works.
A TUI-only plugin belongs in `cli.json`. Putting it in `opencode.json` also
works when the server part loads its TUI part, but `cli.json` is the direct
route.

Restart or reload OpenCode if the plugin does not appear immediately (the TUI
watches plugin directories and usually hot-loads it).

## How it decides the lifetime

1. The model's configured `settings.cache.ttl` (`5m`, `1h`, …), if present.
2. Otherwise **5 minutes**, the default for Anthropic and Amazon Bedrock.

That means a stock Bedrock setup shows `cache 5m` without changing any provider
configuration. If you configure a 1-hour cache, the footer follows it.

To override only the fallback (for a provider with a different implicit cache),
use the object form in `cli.json`:

```jsonc
{
  "plugins": [
    {
      "package": "opencode-cache-countdown",
      "options": { "ttl": "10m" }
    }
  ]
}
```

`options.ttl` does not change the provider's actual cache lifetime; it only
changes what the countdown assumes when the model has no configured TTL.

## How it works

- Finds the newest assistant step with `tokens.cache.read + write > 0`.
- Counts down from that step's request time.
- Ignores messages after a revert boundary and cache activity from before the
  last completed compaction, since compaction replaces the cached prefix.
- Renders in the `prompt.footer` slot, so it sits beside the context usage and
  cost.

## Development

```sh
bun install
bun test
bun run typecheck
```

To try the local checkout without publishing, add the absolute path to
`~/.config/opencode/cli.json`:

```jsonc
{
  "plugins": ["/absolute/path/to/opencode-cache-countdown"]
}
```

Or symlink it into the auto-discovery directory:

```sh
ln -s "$PWD" ~/.config/opencode/plugins/opencode-cache-countdown
```

## Publishing

```sh
npm login
npm publish
```

The package has no build step: OpenCode loads and transpiles `src/tui.tsx`
directly from the package's `./tui` export.

## Limitations

- TUI only. The desktop app uses a different plugin API.
- The timer exists only when the provider reports cache usage. If a provider
  caches implicitly without reporting cache tokens, there is nothing to count.
- Implicit-cache providers may use a lifetime other than five minutes; set
  `settings.cache.ttl` or the plugin's `options.ttl` to match.

## License

MIT
