import type { Configuration } from "webpack";
import * as path from "path";

import { rules } from "./webpack.rules";
import { plugins } from "./webpack.plugins";

const devServerPort = Number(process.env.WEBPACK_DEV_SERVER_PORT || 9000);
const requestedDevServerHost =
  process.env.WEBPACK_DEV_SERVER_HOST || "127.0.0.1";

// Electron renderer cannot reliably connect to 0.0.0.0/:: as a browser host.
// Normalize wildcard hosts to loopback while preserving explicit host overrides.
const isWildcardHost =
  requestedDevServerHost === "0.0.0.0" || requestedDevServerHost === "::";
const devServerHost = isWildcardHost ? "127.0.0.1" : requestedDevServerHost;

if (isWildcardHost) {
  console.warn(
    `[webpack.renderer] WEBPACK_DEV_SERVER_HOST=${requestedDevServerHost} is not a browser-reachable host for Electron; using ${devServerHost} instead.`,
  );
}

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
  devServer: {
    host: devServerHost,
    port: devServerPort,
    client: {
      webSocketURL: {
        hostname: devServerHost,
        port: devServerPort,
        pathname: "/ws",
        protocol: "ws",
      },
    },
  },
  module: {
    rules,
  },
  plugins,
  resolve: {
    extensions: [".js", ".ts", ".jsx", ".tsx", ".css"],
    modules: [path.resolve(__dirname, "../../node_modules"), "node_modules"],
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@mcp_router/shared": path.resolve(
        __dirname,
        "../../packages/shared/src",
      ),
      "@mcp_router/ui": path.resolve(__dirname, "../../packages/ui/src"),
      "@mcp_router/tailwind-config": path.resolve(
        __dirname,
        "../../packages/tailwind-config",
      ),
    },
  },
};
