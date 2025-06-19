import type { Configuration } from 'webpack';
import * as path from 'path';

import { rules } from './webpack.rules';
import { plugins } from './webpack.plugins';

rules.push({
  test: /\.css$/,
  use: [
    { loader: 'style-loader' },
    { loader: 'css-loader' },
    {
      loader: 'postcss-loader',
      options: {
        postcssOptions: {
          plugins: [
            require('@tailwindcss/postcss'), // Use the Tailwind CSS PostCSS plugin
            require('autoprefixer'), // Autoprefixer for browser compatibility
          ],
        },
      },
    },
  ],
});

export const rendererConfig: Configuration = {
  module: {
    rules,
  },
  plugins,
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
    modules: [path.resolve(__dirname, '../../node_modules'), 'node_modules'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@mcp-router/shared': path.resolve(__dirname, '../../packages/shared/src'),
    }
  },
};
