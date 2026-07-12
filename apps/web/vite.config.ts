import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    exclude: [
      ...configDefaults.exclude,
      "../../.github/utils/tests/test_*.py",
    ],
  },
});
