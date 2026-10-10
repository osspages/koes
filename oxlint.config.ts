import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";

export default defineConfig({
  extends: [core],
  ignorePatterns: ["**/routeTree.gen.ts"],
  rules: {
    // Effect.gen / Effect.fn use anonymous `function*` as idiom.
    "func-names": ["error", "always", { generators: "never" }],
    "func-style": "off",
    "sort-keys": "off",
    "react/function-component-definition": "allow",
    "no-use-before-define": [
      "error",
      {
        functions: false,
        variables: false,
        classes: true,
        allowNamedExports: false,
      },
    ],
  },
});
