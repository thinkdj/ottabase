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
    build: {
      outDir: "dist",
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            // Separate vendor chunks to reduce main bundle size
            'react-vendor': ['react', 'react-dom'],
            'tanstack-vendor': ['@tanstack/react-router', '@tanstack/react-query'],
            'mantine-vendor': [
              '@mantine/core', 
              '@mantine/hooks', 
              '@mantine/modals',
              '@mantine/notifications',
              '@mantine/carousel'
            ],
            'ottabase-ui': [
              '@ottabase/ui-components',
              '@ottabase/ui-mantine',
              '@ottabase/ui-shadcn',
              '@ottabase/ui-code-highlight'
            ],
          },
        },
      },
      // Increase chunk size warning limit to 1000 kB (from default 500 kB)
      // since the app includes comprehensive demo pages
      chunkSizeWarningLimit: 1000,
    },
    server: {
      port: 5174,
      strictPort: true,
      proxy: {
        "/api": {
          target: "http://localhost:8790",
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
