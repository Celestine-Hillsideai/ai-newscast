import tseslint from "typescript-eslint";
import nextConfig from "eslint-config-next";

export default tseslint.config(
  {
    ignores: ["node_modules/**", ".trigger/**", "dist/**", ".next/**"],
  },
  ...tseslint.configs.recommended,
  ...nextConfig,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  }
);
