// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

export default defineConfig({
  tanstackStart: {
    importProtection: {
      // This project intentionally places `*.functions.ts` files under
      // `src/server/` and relies on `createServerFn` to produce client-safe
      // RPC stubs. Real server-only modules use the `*.server.*` suffix and
      // are still guarded by Vite's standard SSR boundary. Exclude the
      // `src/server/**` tree from the default client-side block.
      client: {
        excludeFiles: ["**/src/server/**"],
      },
    },
  },
  vite: {
    plugins: [mcpPlugin()],
  },
});
