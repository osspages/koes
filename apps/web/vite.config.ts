import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 3000,
  },
  build: {
    rolldownOptions: {
      // Provided by the Workers runtime (and Alchemy's Cloudflare Vite
      // plugin) — keep as a runtime import instead of bundling it.
      external: ["cloudflare:workers"],
    },
  },
  plugins: [
    tanstackStart({
      srcDirectory: "src",
    }),
    viteReact(),
  ],
});
