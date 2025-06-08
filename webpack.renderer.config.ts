import type { Configuration } from 'webpack';
import { rules } from './webpack.rules';
import path from "path";

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
  plugins: [],
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'], // , '.json'
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
};
