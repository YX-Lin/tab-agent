import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    bin: "src/bin.ts",
    "native-host": "src/native-host.ts",
  },
  format: "esm",
  platform: "node",
    target: "node22",
  sourcemap: true,
  clean: true,
  splitting: false,
  banner: { js: "#!/usr/bin/env node" },
  noExternal: ["@tab-title-agent/shared"],
});
