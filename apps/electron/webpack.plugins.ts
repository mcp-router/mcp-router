const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");

// Enable type checking in both development and production
export const plugins = [
  new ForkTsCheckerWebpackPlugin({
    logger: "webpack-infrastructure",
    typescript: {
      configFile: "./tsconfig.json",
      build: true, // Enable incremental compilation
    },
    issue: {
      // Make TypeScript errors block the build
      include: [
        { file: "**/*.{ts,tsx}" },
      ],
      exclude: [
        { file: "**/node_modules/**/*" },
      ],
    },
    async: false, // Run type checking synchronously to block builds on errors
  }),
];
