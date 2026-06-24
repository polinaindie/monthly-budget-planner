import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" makes the build work from any subpath (e.g. GitHub Pages /repo/)
export default defineConfig({
  plugins: [react()],
  base: "./",
});
