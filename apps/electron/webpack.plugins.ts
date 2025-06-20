const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");

// Disable type checking during development
const isProduction = process.env.NODE_ENV === "production";

export const plugins = isProduction
  ? [
      new ForkTsCheckerWebpackPlugin({
        logger: "webpack-infrastructure",
      }),
    ]
  : [];
