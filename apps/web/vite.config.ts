import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { readFile } from "node:fs/promises";

const mapLibreFiles = [
  "maplibre-gl-worker.mjs",
  "maplibre-gl-shared.mjs"
] as const;
const mapLibreAssetRoot = new URL(
  "../../node_modules/maplibre-gl/dist/",
  import.meta.url
);

const mapLibreWorkerAssets = (): Plugin => {
  const readAsset = (fileName: (typeof mapLibreFiles)[number]) =>
    readFile(new URL(fileName, mapLibreAssetRoot));

  return {
    name: "maplibre-worker-assets",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const fileName = request.url?.split("?")[0]?.slice(1);
        if (!mapLibreFiles.includes(fileName as (typeof mapLibreFiles)[number])) {
          next();
          return;
        }
        response.statusCode = 200;
        response.setHeader("Content-Type", "text/javascript; charset=utf-8");
        response.end(
          await readAsset(fileName as (typeof mapLibreFiles)[number])
        );
      });
    },
    async generateBundle() {
      for (const fileName of mapLibreFiles) {
        this.emitFile({
          type: "asset",
          fileName,
          source: await readAsset(fileName)
        });
      }
    }
  };
};

export default defineConfig({
  plugins: [react(), mapLibreWorkerAssets()],
  optimizeDeps: {
    exclude: ["maplibre-gl"]
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8787"
    }
  },
  build: {
    target: "es2022",
    sourcemap: true
  }
});
