import type { Configuration } from "webpack";
import * as path from "path";

import { rules } from "./webpack.rules";
import { plugins } from "./webpack.plugins";

export const mainConfig: Configuration = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: "./src/main.ts",
  // Put your normal webpack config below here
  module: {
    rules,
  },
  plugins,
  resolve: {
    extensions: [".js", ".ts", ".jsx", ".tsx", ".css", ".json"],
    modules: ["node_modules", path.resolve(__dirname, "../../node_modules")],
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@mcp_router/shared": path.resolve(
        __dirname,
        "../../packages/shared/src",
      ),
    },
  },
  externals: {
    "isolated-vm": "commonjs isolated-vm",
  },
};
