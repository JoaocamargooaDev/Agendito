import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const config = defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  globalIgnores([".next/**", ".next-*/**", "node_modules/**", "out/**", "dist/**", "next-env.d.ts"]),
]);

export default config;
