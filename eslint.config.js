import config from "@markormesher/eslint-config";

export default [
  ...config,
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // this project has a lot of inherited methods or callbacks with an async signature that don't always need to be async
      "@typescript-eslint/require-await": "off",
    },
  },
];
