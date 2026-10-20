import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const apiOrigin = process.env.HALLIGALLI_API_ORIGIN ?? "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": apiOrigin,
      "/ws": {
        target: apiOrigin.replace(/^http/, "ws"),
        ws: true,
      },
    },
  },
});
