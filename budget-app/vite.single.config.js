import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Inlines all JS and CSS into a single index.html so the app runs from
// any static host without a build step — just upload the one file.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: "dist-single",
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
  },
});
