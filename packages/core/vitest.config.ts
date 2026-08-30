import { defineConfig } from "vitest/config";

const VIRTUAL = "\0node-sqlite-shim";

/**
 * Vite 5 kent `node:sqlite` niet als ingebouwde module: die kwam er later bij.
 * Het voorvoegsel wordt eraf gehaald, waarna hij een pakket `sqlite` van schijf
 * probeert te laden en de hele testrun afbreekt. Deze plugin geeft in plaats
 * daarvan een moduletje terug dat de echte ingebouwde module via `createRequire`
 * ophaalt, dus buiten Vite om. Kan weg zodra Vite is bijgewerkt.
 */
export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 20000,
    hookTimeout: 20000,
  },
  plugins: [
    {
      name: "node-sqlite-shim",
      enforce: "pre",
      resolveId(id) {
        return id === "node:sqlite" ? VIRTUAL : null;
      },
      load(id) {
        if (id !== VIRTUAL) return null;
        return [
          'import { createRequire } from "node:module";',
          'const sqlite = createRequire(import.meta.url)("node:sqlite");',
          "export const DatabaseSync = sqlite.DatabaseSync;",
          "export const StatementSync = sqlite.StatementSync;",
        ].join("\n");
      },
    },
  ],
});
