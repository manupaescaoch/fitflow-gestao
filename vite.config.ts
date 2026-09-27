import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

// Configuração independente do editor Lovable. O deploy é um Worker Cloudflare.
export default defineConfig(({ command }) => ({
  plugins: [
    tailwindcss(),
    tsconfigPaths(),
    tanstackStart({
      importProtection: { client: { excludeFiles: ["**/src/server/**"] } },
    }),
    ...(command === "build"
      ? [nitro({ preset: "cloudflare-module", cloudflare: { nodeCompat: true, deployConfig: true } })]
      : []),
    react(),
  ],
}));
