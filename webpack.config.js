const webpack = require("webpack");
const path = require("path");
const HTMLPlugin = require("html-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");


module.exports = {
  entry: {
    index: "./src/index.tsx",
    background: "./src/scripts/background.ts"
  },
  mode: "production",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: "ts-loader",
            options: {
              compilerOptions: { noEmit: false },
            }
          }],
        exclude: /node_modules/,
      },
      {
        include: path.resolve(__dirname, "node_modules/@chatscope/chat-ui-kit-styles/dist/default/styles.min.css"),
        test: /\.css$/i,
        use: [
          "style-loader",
          "css-loader",
        ],
      },
      {
        exclude: /node_modules/,
        test: /\.css$/i,
        use: [
          "style-loader",
          "css-loader"
        ]
      },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: "manifest.json", to: "../manifest.json" },
        { from: "./src/assets", to: "../assets" },
      ],
    }),
    new webpack.ProvidePlugin({ // needed for @mlc-ai/web-llm
      Buffer: ["buffer", "Buffer"],
    }),
    ...getHtmlPlugins(["index"]),
  ],
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    fallback: {
      "perf_hooks": false, // needed for @mlc-ai/web-llm
    }
  },
  output: {
    path: path.join(__dirname, "dist/js"),
    filename: "[name].js",
  },
};

function getHtmlPlugins(chunks) {
  return chunks.map(
    (chunk) =>
      new HTMLPlugin({
        title: "Lumos",
        filename: `${chunk}.html`,
        chunks: [chunk],
      })
  );
}
