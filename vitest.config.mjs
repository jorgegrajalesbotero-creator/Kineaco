import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Alias @/* -> raíz del proyecto (igual que jsconfig.json), para que los tests
// resuelvan los imports de la app tal cual lo hace Next.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
  },
});
