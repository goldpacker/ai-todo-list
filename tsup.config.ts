import { defineConfig } from "tsup";

// Builds the `todo` bin. Everything is bundled except better-sqlite3, a native module that must
// load from node_modules. CJS keeps Node from guessing the module type (package.json has no "type").
export default defineConfig({
  entry: { cli: "src/cli/main.ts" },
  outDir: "dist",
  format: ["cjs"],
  platform: "node",
  target: "node20",
  banner: { js: "#!/usr/bin/env node" },
  external: ["better-sqlite3"],
  noExternal: [/^(?!better-sqlite3$).*/],
  shims: true,
  clean: true,
  splitting: false,
  sourcemap: false,
});
