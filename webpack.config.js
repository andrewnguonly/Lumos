const path = require("path");
const HTMLPlugin = require("html-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");

// Lumos -> lmohc - close enough :) ?
// Will transform to lmohcgekefgleibgbinobnfeaaodjbjm
const DEFAULT_MANIFEST_KEY = 'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC6xav25Jk/1V8cszjeDdtnSklgmJF0xyXe7DkVTij7j0of3wXMAJfONnxu5rgnAOaZPv/3Onxg7tJexuUnJNTW4VbMuNAoPQFtzAdz0PA5OQURxRGZclfJY9QMFW4VnAxcHnee6Vlz+kygutn1ioEmz/8SeBvFyyA561Weu1VW8wIDAQAB'

function prettyJson(obj) {
    return JSON.stringify(obj, null, 2);
}

function transformManifest(input) {
    const manifest = JSON.parse(input.toString())
    manifest.key = process.env.LUMOS_WEXT_MANIFEST_KEY ?? DEFAULT_MANIFEST_KEY
    return prettyJson(manifest)
}

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
                            compilerOptions: {noEmit: false},
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
                {
                    from: "manifest.json", to: "../manifest.json", transform: transformManifest
                },
                {from: "./src/assets", to: "../assets"},
            ],
        }),
        ...getHtmlPlugins(["index"]),
    ],
    resolve: {
        extensions: [".tsx", ".ts", ".js"],
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
