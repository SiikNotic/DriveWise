import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Capacitor loads the built app from a file:// (or capacitor://) origin
// inside the native WebView, not from a server root — an absolute "/" base
// would try to load assets from the device's filesystem root instead of
// relative to index.html. "./" is the standard base for a Capacitor webDir.
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { host: true, port: 5173 },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
