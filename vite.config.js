import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist" },
  // During local dev, proxy API calls to your Worker so CORS isn't needed locally
  server: {
    proxy: {
      "/api": {
        target: "https://kad-resource-utilization.paulawoyomia.workers.dev",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
