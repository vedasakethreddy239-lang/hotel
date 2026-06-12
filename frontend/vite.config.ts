import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Local dev default: 5173 (npm run dev). Hosted preview passes PORT env (3000).
const port = Number(process.env.PORT) || 5173;

export default defineConfig({
  envPrefix: ["VITE_", "REACT_APP_"],
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    host: "0.0.0.0",
    port,
    allowedHosts: true,
    // When running behind the hosted HTTPS proxy (PORT is injected), HMR must use 443.
    hmr: process.env.PORT ? { clientPort: 443 } : undefined,
  },
});
