import solidPlugin from "@opentui/solid/bun-plugin"

const result = await Bun.build({
  entrypoints: ["src/tui.tsx"],
  outdir: "dist",
  target: "bun",
  format: "esm",
  minify: false,
  plugins: [solidPlugin],
  external: ["@opencode/plugin", "@opencode/plugin/*", "solid-js", "solid-js/*", "@opentui/*"],
})

if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}
console.log(result.outputs.map((output) => output.path).join("\n"))
