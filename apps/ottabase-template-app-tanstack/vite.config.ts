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
    optimizeDeps: {
      include: [
        "html-react-parser",
        "@wooorm/starry-night",
        "hast-util-to-jsx-runtime",
      ],
    },
    build: {
      outDir: "dist",
      sourcemap: true,
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // Core vendor chunks
            if (id.includes("node_modules")) {
              // React ecosystem
              if (id.includes("react") || id.includes("react-dom")) {
                return "vendor-react";
              }
              
              // Mantine UI library
              if (id.includes("@mantine/")) {
                return "vendor-mantine";
              }
              
              // TanStack libraries
              if (id.includes("@tanstack/")) {
                return "vendor-tanstack";
              }
              
              // Radix UI - group all radix components together
              if (id.includes("@radix-ui/")) {
                return "vendor-radix";
              }
              
              // Lucide icons
              if (id.includes("lucide-react")) {
                return "vendor-icons";
              }
              
              // Editor libraries
              if (id.includes("@ottabase/ottaeditor") || id.includes("@tiptap") || id.includes("prosemirror")) {
                return "vendor-editor";
              }
              
              // Other large dependencies
              if (id.includes("html-react-parser") || id.includes("@wooorm") || id.includes("hast-util")) {
                return "vendor-parser";
              }
            }
            
            // App chunks by feature
            if (id.includes("/src/pages/demo/")) {
              const parts = id.split("/");
              const demoIndex = parts.indexOf("demo");
              if (demoIndex !== -1 && demoIndex < parts.length - 1) {
                return `demo-${parts[demoIndex + 1]}`;
              }
            }
          },
        },
      },
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
