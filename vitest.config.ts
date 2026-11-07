import { defineConfig } from "vitest/config";
import tsConfigPaths from "vite-tsconfig-paths";

// Config de tests aislada: sin plugins de TanStack Start / Nitro.
export default defineConfig({
  plugins: [tsConfigPaths({ projects: ["./tsconfig.json"] })],
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
