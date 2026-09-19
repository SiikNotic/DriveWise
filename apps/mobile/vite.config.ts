import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";

// Capacitor's WebView loads the app from a local scheme (https://localhost),
// not a real remote origin, so `crossorigin` on <script>/<link> tags (Vite's
// default, meant for CDN-hosted subresource integrity) forces a CORS-mode
// fetch that gains nothing here — everything is same-origin — and on some
// WebView/Capacitor version combinations that fetch can simply fail with no
// visible error, leaving a permanently blank white screen. Strip it.
function stripCrossorigin(): Plugin {
  return {
    name: "strip-crossorigin",
    transformIndexHtml: {
      order: "post",
      handler: (html) => html.replace(/\s+crossorigin(="[^"]*")?/g, ""),
    },
  };
}

// Capacitor loads the built app from a file:// (or capacitor://) origin
// inside the native WebView, not from a server root — an absolute "/" base
// would try to load assets from the device's filesystem root instead of
// relative to index.html. "./" is the standard base for a Capacitor webDir.
export default defineConfig({
  plugins: [
    react(),
    // Dual-builds the app: a modern `type="module"` bundle for WebViews that
    // support ES modules, and an automatic `nomodule`/SystemJS-loaded
    // fallback bundle for ones that don't. Needed because this app's
    // minSdkVersion (24, Android 7) covers devices whose system WebView may
    // predate ES module script support entirely.
    legacy(),
    stripCrossorigin(),
  ],
  base: "./",
  server: { host: true, port: 5173 },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
