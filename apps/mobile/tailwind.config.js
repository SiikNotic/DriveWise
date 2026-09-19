/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Same teal brand color as apps/web's --primary token (globals.css) —
        // kept in sync by hand since there's no shared CSS between platforms.
        primary: "#0f766e",
        "primary-foreground": "#ffffff",
        background: "#f4f7f6",
        card: "#ffffff",
        foreground: "#14201f",
        "muted-foreground": "#657371",
        border: "#e4e2dd",
        destructive: "#b3261e",
        positive: "#006300",
        warning: "#fab219",
      },
    },
  },
  plugins: [],
};
