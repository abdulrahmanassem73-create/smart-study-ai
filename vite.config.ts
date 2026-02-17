import path from "path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          // Inject data-source attribute for AI agent source location
          "./scripts/babel-plugin-jsx-source-location.cjs",
        ],
      },
    }),
    tailwindcss(),
  ],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Manual chunks to reduce initial bundle and improve caching
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          // Charts (recharts + d3)
          // Note: recharts pulls d3-* packages; keep them together for caching.
          if (
            id.includes("/recharts/") ||
            id.includes("/d3-") ||
            id.includes("/d3/")
          ) {
            return "vendor-charts";
          }

          // Markdown / math rendering
          if (
            id.includes("/react-markdown/") ||
            id.includes("/remark-gfm/") ||
            id.includes("/remark-math/") ||
            id.includes("/rehype-katex/") ||
            id.includes("/katex/")
          ) {
            return "vendor-markdown";
          }

          // UI / icons
          if (
            id.includes("/@radix-ui/") ||
            id.includes("/lucide-react/") ||
            id.includes("/cmdk/") ||
            id.includes("/vaul/")
          ) {
            return "vendor-ui";
          }

          // Motion / animations
          if (id.includes("/framer-motion/")) return "vendor-motion";

          // Supabase client
          if (id.includes("/@supabase/")) return "vendor-supabase";

          return;
        },
      },
    },
  },
});
