import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import topLevelAwait from "vite-plugin-top-level-await";
import wasm from "vite-plugin-wasm";

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [
    wasm(),
    react({
      // Enhanced error handling for React components
      babel: {
        plugins: [
          // Add error boundary support
          ["@babel/plugin-transform-react-jsx", { runtime: "automatic" }]
        ]
      }
    }),
    tailwindcss(),
    topLevelAwait(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: {
        enabled: true,
      },
      manifest: {
        name: "Tonk App",
        short_name: "Tonk App",
        description: "My new Tonk App",
      },
    }),
  ],
  server: {
    port: 3000,
    hmr: {
      // Improve HMR stability and prevent unnecessary reloads
      overlay: false,
    },
    watch: {
      // Ignore server files from HMR to prevent page reloads
      ignored: [
        '**/server/public/**',
        '**/src/plugins/**',
        '**/node_modules/**'
      ]
    },
    proxy: {
      "/sync": {
        target: "ws://localhost:7777",
        ws: true,
        changeOrigin: true,
      },
      "/.well-known/root.json": {
        target: "http://localhost:7777",
        changeOrigin: true,
      },
      "/api": {
        target: "http://localhost:6080",
        changeOrigin: true,
        secure: false,
        ws: true, // Enable websocket proxying
      },
    },
  },
  build: {
    sourcemap: true,
    outDir: "dist",
    assetsDir: "assets",
    rollupOptions: {
      // Improves chunking to address the large file size warning
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          automerge: ["@automerge/automerge"],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      target: "esnext",
    },
  },
  esbuild: {
    target: "esnext",
  },
});
