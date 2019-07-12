"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process = require("child_process");
const fs = require("fs");
const path = require("path");
const util_1 = require("util");
const Package_1 = require("./Package");
class Main {
    static async run() {
        process.chdir(__dirname);
        await Main.installDependecies();
        const packages = await Main.initPackages();
        const fronts = [];
        for (const p of packages) {
            const packageFronts = await p.getFrontends();
            fronts.push(...packageFronts);
            for (const front of packageFronts) {
                console.log("Package: ", front.package.name + " and front is: " + front.name);
                await front.initDependencies();
                await Main.installDependencies(front.path);
            }
        }
        Main.JalnoResolver = require("./JalnoResolver").default;
        await Main.JalnoResolver.initSources(fronts);
        Main.runWebpack(fronts);
    }
    static async initPackages() {
        const packagesPath = path.resolve("..", "..", "..");
        const files = await util_1.promisify(fs.readdir)(packagesPath, {
            withFileTypes: true,
        });
        const packages = [];
        for (const file of files) {
            const packagepath = path.resolve(packagesPath, file.name);
            if (file.isDirectory() && await util_1.promisify(fs.exists)(packagepath + "/package.json")) {
                packages.push(new Package_1.default(packagesPath, file.name));
            }
        }
        return packages;
    }
    static async installDependecies() {
        if (!await util_1.promisify(fs.exists)(path.resolve("..", "node_modules", "npm"))) {
            let npmBin;
            try {
                const out = await util_1.promisify(child_process.exec)("which npm");
                npmBin = out.stdout.trimEnd();
            }
            catch (e) {
                throw new Error("Cannot find npm on this envirement");
            }
            const execFile = await util_1.promisify(child_process.execFile);
            try {
                await execFile(npmBin, ["link", "npm"]);
            }
            catch (e) {
                throw new Error("Cannot find npm in your global repository");
            }
        }
        Main.npm = require("npm");
        console.log("Package: node-webpack");
        await Main.installDependencies();
    }
    static async installDependencies(where = "") {
        console.log("Try to install assets");
        await new Promise((resolve, reject) => {
            Main.npm.load((err, result) => {
                if (err) {
                    return reject(err);
                }
                resolve(result);
            });
        });
        await new Promise((resolve, reject) => {
            Main.npm.commands.install(where, [], (err, result, result2, result3, result4) => {
                if (err) {
                    return reject(err);
                }
                resolve({
                    result, result2, result3, result4,
                });
            });
        });
    }
    static async runWebpack(fronts) {
        const webpack = require("webpack");
        const MiniCssExtractPlugin = require("mini-css-extract-plugin");
        const CleanCSSPlugin = require("less-plugin-clean-css");
        const precss = require("precss");
        const autoprefixer = require("autoprefixer");
        const entries = {};
        for (const front of fronts) {
            const frontEntries = await front.getEntries();
            if (frontEntries !== undefined) {
                if (entries[frontEntries.name] === undefined) {
                    entries[frontEntries.name] = frontEntries.entries;
                }
                else {
                    entries[frontEntries.name] = entries[frontEntries.name].concat(frontEntries.entries);
                }
            }
        }
        const outputPath = path.resolve("..", "..", "storage", "public", "frontend", "dist");
        webpack({
            entry: entries,
            stats: {
                all: false,
                colors: false,
                modules: false,
            },
            output: {
                filename: "[name].js",
                chunkFilename: "[name].js",
                path: outputPath,
            },
            resolve: {
                plugins: [new Main.JalnoResolver("module", "resolve")],
                extensions: [".ts", ".js", ".less", ".css", ".sass", ".scss"],
            },
            module: {
                rules: [
                    {
                        test: /\.(sc|sa|c)ss$/,
                        use: [
                            MiniCssExtractPlugin.loader,
                            "css-loader",
                            {
                                loader: "postcss-loader",
                                options: {
                                    plugins: () => {
                                        return [precss, autoprefixer];
                                    },
                                },
                            },
                            "sass-loader",
                        ],
                    },
                    {
                        test: /\.(less)$/,
                        use: [
                            MiniCssExtractPlugin.loader,
                            "css-loader",
                            {
                                loader: "less-loader",
                            },
                        ],
                    },
                    { test: /\.json$/, loader: "json-loader" },
                    { test: /\.png$/, loader: "file-loader" },
                    { test: /\.jpg$/, loader: "file-loader" },
                    { test: /\.gif$/, loader: "file-loader" },
                    { test: /\.woff2?$/, loader: "file-loader" },
                    { test: /\.eot$/, loader: "file-loader" },
                    { test: /\.ttf$/, loader: "file-loader" },
                    { test: /\.svg$/, loader: "file-loader" },
                    {
                        test: /\.tsx?$/,
                        loader: "ts-loader",
                        options: {
                            transpileOnly: true,
                            logLevel: "warn",
                            compilerOptions: {
                                sourceMap: false,
                            },
                        },
                    },
                ],
            },
            mode: "development",
            plugins: [
                new MiniCssExtractPlugin({
                    filename: "[name].css",
                }),
                new webpack.ProvidePlugin({
                    "$": "jquery",
                    "jQuery": "jquery",
                    "window.jQuery": "jquery",
                }),
            ],
        }, async (err, stats) => {
            if (err) {
                throw new Error(err);
            }
            const basePath = path.resolve("..", "..", "..", "..");
            const offset = (basePath + "/").length;
            for (const name in entries) {
                if (entries[name] !== undefined) {
                    for (const key in entries[name]) {
                        if (entries[name][key] !== undefined) {
                            entries[name][key] = entries[name][key].substr(offset);
                        }
                    }
                }
            }
            const result = {
                handledFiles: entries,
                outputedFiles: {},
            };
            const exists = util_1.promisify(fs.exists);
            for (const chunk of stats.compilation.chunks) {
                for (const file of chunk.files) {
                    const filePath = path.resolve(outputPath, file);
                    if (result.outputedFiles[chunk.id] === undefined) {
                        result.outputedFiles[chunk.id] = [];
                    }
                    if (await exists(filePath)) {
                        result.outputedFiles[chunk.id].push(filePath.substr(offset));
                    }
                }
            }
            await util_1.promisify(fs.writeFile)(path.resolve(__dirname + "..", "result.json"), JSON.stringify(result, null, 2), "UTF8");
        });
    }
}
exports.default = Main;
Main.run();
