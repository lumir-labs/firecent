import { defineConfig } from "eslint/config";
import expo from "eslint-config-expo/flat.js";

export default defineConfig([
  ...expo,
  {
    // `eslint-import-resolver-typescript` lee los `paths` del tsconfig
    // (@app/lib → packages, @/* → src). Sin esto, `import/no-unresolved`
    // no entiende los alias del monorepo.
    settings: {
      "import/resolver": {
        typescript: {
          project: ["./tsconfig.json", "../../packages/lib/tsconfig.json"],
        },
      },
    },
  },
]);

