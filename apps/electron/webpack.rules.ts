import type { ModuleOptions } from "webpack";

export const rules: Required<ModuleOptions>["rules"] = [
  // Add support for JSON files (i18n dictionaries)
  // {
  //   test: /\.json$/,
  //   type: 'javascript/auto',
  //   include: /src\/locales/,
  //   use: [{ loader: 'json-loader' }]
  // },
  // Add support for native node modules
  {
    // We're specifying native_modules in the test because the asset relocator loader generates a
    // "fake" .node file which is really a cjs file.
    test: /native_modules[/\\].+\.node$/,
    use: "node-loader",
  },
  {
    test: /[/\\]node_modules[/\\].+\.(c?js|mjs|node)$/,
    parser: { amd: false },
    use: {
      loader: "@vercel/webpack-asset-relocator-loader",
      options: {
        outputAssetBase: "native_modules",
      },
    },
  },
  {
    test: /\.tsx?$/,
    exclude: /(node_modules|\.webpack)/,
    use: {
      loader: "ts-loader",
      options: {
        transpileOnly: true,
        compilerOptions: {
          noEmitOnError: false,
        },
      },
    },
  },
  // Add support for image files
  {
    test: /\.(png|jpe?g|gif|ico)$/i,
    type: "asset/resource",
  },
  // Add support for SVG files as strings
  {
    test: /\.svg$/i,
    type: "asset/source",
  },
];
