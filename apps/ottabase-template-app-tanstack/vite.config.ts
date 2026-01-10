import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// SPA fallback plugin for client-side routing
function spaFallback(): Plugin {
  return {
    name: "spa-fallback",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Skip API routes
        if (req.url?.startsWith("/api")) {
          return next();
        }

        // Skip asset requests (files with extensions)
        const urlPath = (req.url || "").split(/[?#]/, 1)[0];
        const hasExtension = /\.[a-zA-Z0-9]+$/.test(urlPath);
        if (hasExtension) {
          return next();
        }

        // For HTML requests without extensions, serve index.html
        const acceptsHtml = req.headers.accept?.includes("text/html");
        if (acceptsHtml) {
          req.url = "/index.html";
        }

        next();
      });
    },
  };
}

export default defineConfig(async () => {
  const { default: tsconfigPaths } = await import("vite-tsconfig-paths");

  return {
    plugins: [
      tsconfigPaths({
        projects: [path.resolve(__dirname, "./tsconfig.json")],
        ignoreConfigErrors: true,
      }),
      react(),
      spaFallback(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    css: {
      // Lightning CSS cannot safely transform some Tailwind arbitrary variants, so keep PostCSS handling
      transformer: "postcss",
    },
    build: {
      outDir: "dist",
      sourcemap: true,
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks: {
            mantine: [
              "@mantine/core",
              "@mantine/hooks",
              "@mantine/modals",
              "@mantine/notifications",
              "@mantine/carousel",
            ],
            tanstack: [
              "@tanstack/react-query",
              "@tanstack/react-query-devtools",
              "@tanstack/react-router",
            ],
            ottaeditor: ["@ottabase/ottaeditor"],
          },
        },
      },
    },
    server: {
      port: 5174,
      strictPort: true,
      proxy: {
        "/api": {
          target: "http://127.0.0.1:8790",
          changeOrigin: true,
          secure: false,
        },
      },
    },
    preview: {
      port: 4173,
    },
  };
});
