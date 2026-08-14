import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    host: true,
  },
  build: {
    chunkSizeWarningLimit: 2000,
  },
  plugins: [
    tailwindcss(),
    tanstackStart({
      server: { entry: "server" },
    }),
    react(),
  ],
});
