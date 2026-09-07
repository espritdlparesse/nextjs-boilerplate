import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // any в проекте не осталось: пусть новый ломает проверку, а не копится.
      "@typescript-eslint/no-explicit-any": "error",
      // `const { consumed_at, ...rest } = payload` — это способ выбросить поле,
      // а не забытая переменная.
      "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true }],
      // Аватары и иконка вайбчека приходят как удаленные URL и data-URI,
      // next/image здесь только добавляет прослойку.
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;
