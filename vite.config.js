import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import pkg from "./package.json";

export default defineConfig({
  define: {
    // Single-sourced app version (see ProfilePage "About" line).
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: "generateSW",
      registerType: "prompt",
      // We keep our own manifest.webmanifest in /public (with shortcuts etc.).
      injectManifest: false,
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico,webmanifest}"],
        cleanupOutdatedCaches: true,
        navigateFallback: "/index.html",
      },
    }),
  ],
  build: {
    // Production hardening: drop console/debugger statements and minify
    // aggressively so no debug output or internal names ship to devices.
    minify: "esbuild",
    esbuild: {
      pure: ["console.log", "console.debug", "console.info"],
      drop: ["debugger"],
    },
    sourcemap: false,
    target: "es2020",
  },
  server: {
    // Exposed on the LAN so you can open the dev server from a phone; drop
    // this (or set host: false) if you only develop on localhost.
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
  },
});
