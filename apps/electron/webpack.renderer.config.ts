import type { Configuration } from "webpack";
import * as path from "path";

import { rules } from "./webpack.rules";
import { plugins } from "./webpack.plugins";

rules.push({
  test: /\.css$/,
  use: [
    { loader: "style-loader" },
    { loader: "css-loader" },
    {
      loader: "postcss-loader",
      // PostCSS plugins are defined in postcss.config.mjs
    },
  ],
});

export const rendererConfig: Configuration = {
  module: {
    rules,
  },
  plugins,
  resolve: {
    extensions: [".js", ".ts", ".jsx", ".tsx", ".css"],
    modules: [path.resolve(__dirname, "../../node_modules"), "node_modules"],
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@mcp-router/shared": path.resolve(
        __dirname,
        "../../packages/shared/src",
      ),
      "@mcp-router/platform-api": path.resolve(
        __dirname,
        "../../packages/platform-api/src",
      ),
      "@mcp-router/ui": path.resolve(__dirname, "../../packages/ui/src"),
      "@mcp-router/tailwind-config": path.resolve(
        __dirname,
        "../../packages/tailwind-config",
      ),
    },
  },
};
