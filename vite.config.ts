import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

// Config estándar (sin Lovable). Nitro empaqueta el servidor SSR y las
// server functions con el preset de Vercel → genera `.vercel/output`.
export default defineConfig({
  server: { port: 3000 },
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // Entry propio: envuelve SSR con página de error amigable.
      server: { entry: "server" },
    }),
    nitro({ preset: process.env.NITRO_PRESET ?? "vercel" }),
    viteReact(),
    tailwindcss(),
  ],
  resolve: {
    dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-start"],
  },
});
