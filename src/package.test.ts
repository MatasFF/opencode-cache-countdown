import { expect, test } from "bun:test"

test("the published TUI entry is compiled JavaScript", async () => {
  const pkg = await Bun.file(new URL("../package.json", import.meta.url)).json()
  // OpenCode's Solid transform skips node_modules, so a .tsx entry would be
  // transpiled with the React JSX runtime and fail with "Cannot find package
  // 'react'". The package must ship the output of `bun run compile`.
  expect(pkg.exports["./tui"]).toMatch(/\.js$/)
  expect(pkg.files).toContain("dist")
})
