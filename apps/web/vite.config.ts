import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

const apiOrigin = process.env.HALLIGALLI_API_ORIGIN ?? "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  test: {
    exclude: [
      ...configDefaults.exclude,
      "../../.github/utils/tests/test_*.py",
    ],
  },
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
