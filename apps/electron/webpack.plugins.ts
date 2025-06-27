const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");

// Disable type checking during development
const isProduction = process.env.NODE_ENV === "production";

// Disable type checking completely for now
// isProduction
//   ? [
//       new ForkTsCheckerWebpackPlugin({
//         logger: "webpack-infrastructure",
//       }),
//     ]
//   : [];
export const plugins = [];
