import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      // Never use native browser popups: use the in-app confirmDialog()
      // (components/common/ConfirmDialog) and sonner toast() instead.
      "no-restricted-globals": [
        "error",
        { "name": "alert", "message": "Use sonner toast() instead of window.alert()." },
        { "name": "confirm", "message": "Use confirmDialog() from components/common/ConfirmDialog instead of window.confirm()." },
        { "name": "prompt", "message": "Use an in-app dialog instead of window.prompt()." },
      ],
      // console.error pops the Next.js dev overlay ("Console Error" stack trace)
      // even for errors that are already caught and shown to the user as a toast.
      "no-restricted-syntax": [
        "error",
        {
          "selector": "MemberExpression[object.name='console'][property.name='error']",
          "message": "Use logHandledError() from @/lib/log-error instead of console.error — console.error shows a developer stack-trace popup to non-developers.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
