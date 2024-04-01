const path = require("path");
const HTMLPlugin = require("html-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");


module.exports = {
  entry: {
    index: "./src/index.tsx",
    options: "./src/options.tsx",
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
    ...getHtmlPlugins(["index", "options"]),
  ],
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    fallback: {
      // enable use of LangChain document loaders
      fs: false, // TextLoader
      zlib: false, // WebPDFLoader
      http: false, // WebPDFLoader
      https: false, // WebPDFLoader
      url: false, // WebPDFLoader
    }
  },
  output: {
    path: path.join(__dirname, "dist/js"),
    filename: "[name].js",
  },
  externals: {
    // enable use of LangChain document loaders
    "node:fs/promises": "commonjs2 node:fs/promises", // TextLoader
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
