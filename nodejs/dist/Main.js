"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process = require("child_process");
const fs = require("fs");
const path = require("path");
const util_1 = require("util");
const Package_1 = require("./Package");
class Main {
    static async run() {
        if (process.argv.length > 2) {
            Main.checkArgs();
            if (process.argv.indexOf("-h") !== -1 || process.argv.indexOf("--help") !== -1) {
                return Main.introduce();
            }
            for (let i = 2; i < process.argv.length; i++) {
                switch (process.argv[i]) {
                    case "-w":
                    case "--watch":
                        Main.watch = true;
                        console.log("run webpack on watch mode");
                        break;
                    case "--write-webpack-config":
                    case "--wwc":
                        Main.writeWebpackConfig = true;
                        console.log("write webpack config");
                        break;
                    case "--skip-install":
                    case "--webpack":
                        Main.skipInstall = true;
                        console.log("skip install dependencies");
                        break;
                    case "--clear":
                    case "-c":
                        Main.clean = true;
                        console.log("remove packages node_modules");
                        break;
                    case "-i":
                    case "--install":
                    case "--skip-webpack":
                        Main.skipWebpack = true;
                        console.log("skip run webpack");
                        break;
                    case "--production":
                        Main.mode = "production";
                        console.log("run webpack on production mode");
                        break;
                }
            }
        }
        process.chdir(__dirname);
        await Main.initDependencies();
        const packages = await Main.initPackages();
        const fronts = [];
        for (const p of packages) {
            const packageFronts = await p.getFrontends();
            fronts.push(...packageFronts);
            for (const front of packageFronts) {
                if (Main.clean) {
                    await front.clean();
                }
                await front.initDependencies();
                await Main.installDependencies(front.path);
            }
        }
        let entries = {};
        if (!Main.skipWebpack || Main.writeWebpackConfig) {
            Main.JalnoResolver = require("./JalnoResolver").default;
            await Main.JalnoResolver.initSources(fronts);
            entries = await Main.getEntries(fronts);
        }
        if (!Main.skipWebpack) {
            Main.runWebpack(entries);
        }
        if (Main.writeWebpackConfig) {
            const modules = Main.JalnoResolver.getModules();
            Main.exportWebpackConfig(fronts, modules, entries);
        }
    }
    static async updateJalnoMoudles(modules) {
        const jalnoPath = path.resolve(__dirname, "..", "jalno.json");
        if (!await util_1.promisify(fs.exists)(jalnoPath)) {
            return;
        }
        const jalno = JSON.parse(await util_1.promisify(fs.readFile)(jalnoPath, "UTF8"));
        jalno.modules = modules;
        await util_1.promisify(fs.writeFile)(path.resolve("..", "jalno.json"), JSON.stringify(jalno, null, 2), "UTF8");
    }
    static checkArgs() {
        for (let i = 2; i < process.argv.length; i++) {
            switch (process.argv[i]) {
                case "-h":
                case "--help":
                case "-w":
                case "--watch":
                case "--write-webpack-config":
                case "--wwc":
                case "--skip-install":
                case "--webpack":
                case "--clear":
                case "-c":
                case "-i":
                case "--install":
                case "--skip-webpack":
                case "--production":
                    continue;
                default:
                    console.error(`\u001b[1m\u001b[31mCommand line option ${process.argv[i]} is not understood in combination with the other options\u001b[39m\u001b[22m`);
                    process.exit(1);
            }
        }
        if ((process.argv.indexOf("--skip-install") !== -1 || process.argv.indexOf("--webpack") !== -1) &&
            (process.argv.indexOf("-i") !== -1 || process.argv.indexOf("--skip-webpack") !== -1 || process.argv.indexOf("--install") !== -1) &&
            process.argv.indexOf("--wwc") === -1 && process.argv.indexOf("--write-webpack-config") === -1 &&
            process.argv.indexOf("-c") === -1 && process.argv.indexOf("--clear") === -1) {
            console.error(`\u001b[1m\u001b[31mConnot use skip webpack and skip install options in same time\u001b[39m\u001b[22m`);
            process.exit(1);
        }
        if ((process.argv.indexOf("-w") !== -1 || process.argv.indexOf("--watch") !== -1) &&
            (process.argv.indexOf("--skip-webpack") !== -1 || process.argv.indexOf("--install") !== -1)) {
            console.error(`\u001b[1m\u001b[31mConnot use skip webpack and watch webpack options in same time\u001b[39m\u001b[22m`);
            process.exit(1);
        }
    }
    static introduce() {
        console.log(`Node Webpack ${process.env.npm_package_version}\n
usage npm run [options] [-- ...args] command\n
node webpack is a commandline package manager and provides commands for
installing and managing as well as querying information about packages.\n
Most used commands:
	build - compile source files
	start - install dependencies and run webpack
Options:
	-h, --help			Print this message.
	--w, --watch			Turn on webpack watch mode. This means that after the initial build, webpack will continue to watch for changes in any of the resolved files.
	--wwc, --write-webpack-config	Export webpack config to webpack.config.js .
	--webpack, --skip-install	Skip install dependencies and just run webpack.
	-i, --install, --skip-webpack	Skip webpack and just install dependencies.
	--c, --clear			Remove package node_modules.
	--production			Change webpack mode to production [default is development]`);
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
    static async initDependencies() {
        if (Main.skipInstall) {
            return;
        }
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
        await Main.installDependencies();
        await new Promise((resolve, reject) => {
            Main.npm.link("npm", (err) => {
                if (err) {
                    return reject(err);
                }
                resolve();
            });
        });
    }
    static async installDependencies(where = "") {
        if (Main.skipInstall) {
            return;
        }
        await new Promise((resolve, reject) => {
            Main.npm.load((err, result) => {
                if (err) {
                    return reject(err);
                }
                resolve(result);
            });
        });
        await new Promise((resolve, reject) => {
            Main.npm.config.set("unsafe-perm", true);
            Main.npm.commands.install(where, [], (err, result, result2, result3, result4) => {
                if (err) {
                    return reject(err);
                }
                resolve({ result, result2, result3, result4 });
            });
        });
    }
    static async runWebpack(entries) {
        const webpack = require("webpack");
        const MiniCssExtractPlugin = require("mini-css-extract-plugin");
        const CleanCSSPlugin = require("less-plugin-clean-css");
        const precss = require("precss");
        const autoprefixer = require("autoprefixer");
        const outputPath = path.resolve("..", "..", "storage", "public", "frontend", "dist");
        let compiler;
        try {
            compiler = webpack({
                entry: entries,
                stats: {
                    all: false,
                    colors: false,
                    modules: false,
                },
                devtool: false,
                optimization: {
                    splitChunks: {
                        cacheGroups: {
                            common: {
                                name: "common",
                                filename: "common.js",
                                test(module, chunks) {
                                    return Main.JalnoResolver.isCommonModule(module);
                                },
                            },
                        },
                    },
                },
                output: {
                    filename: "[name].js",
                    chunkFilename: "common.js",
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
                                    options: {
                                        minimize: false,
                                    },
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
                mode: Main.mode,
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
            });
        }
        catch (err) {
            if (err.name === "WebpackOptionsValidationError") {
                console.error(`\u001b[1m\u001b[31m${err.message}\u001b[39m\u001b[22m`);
                process.exit(1);
            }
            throw err;
        }
        if (process.stderr.isTTY) {
            process.stderr.clearLine(0);
        }
        new webpack.ProgressPlugin({
            profile: false,
        }).apply(compiler);
        const compilerCallback = async (err, stats) => {
            if (err) {
                throw err;
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
            await util_1.promisify(fs.writeFile)(path.resolve("..", "result.json"), JSON.stringify(result, null, 2), "UTF8");
        };
        compiler.devtool = false;
        if (Main.watch) {
            const watchOptions = {};
            if (watchOptions.hasOwnProperty("stdin")) {
                process.stdin.on("end", (_) => {
                    process.exit();
                });
                process.stdin.resume();
            }
            await compiler.watch(watchOptions, compilerCallback);
            console.error("\nwebpack is watching the files…\n");
        }
        else {
            compiler.run((err, stats) => {
                if (compiler.close) {
                    compiler.close((err2) => {
                        compilerCallback(err || err2, stats);
                    });
                }
                else {
                    compilerCallback(err, stats);
                }
            });
        }
    }
    static async getEntries(fronts) {
        const entries = {};
        for (const front of fronts) {
            const frontEntries = await front.getEntries();
            if (frontEntries !== undefined) {
                if (entries[frontEntries.name] === undefined) {
                    entries[frontEntries.name] = frontEntries.entries;
                }
                else {
                    for (const entry of frontEntries.entries) {
                        if (entries[frontEntries.name].indexOf(entry) === -1) {
                            entries[frontEntries.name].push(entry);
                        }
                    }
                }
            }
        }
        return entries;
    }
    static async exportWebpackConfig(fronts, modules, entries) {
        await util_1.promisify(fs.writeFile)(path.resolve("..", "jalno.json"), JSON.stringify({
            mode: Main.mode,
            fronts: fronts,
            entries: entries,
            modules: modules,
        }, null, 2), "UTF8");
        const config = `const webpack = require("webpack");
const path = require("path");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CleanCSSPlugin = require("less-plugin-clean-css");
const precss = require("precss");
const autoprefixer = require("autoprefixer");
const JalnoResolver = require("./dist/JalnoResolver").default;
const Front = require("./dist/Front").default;
const Module = require("./dist/Module").default;
const jalno = require("./jalno.json");
const modules = {};
for (const packageName in jalno.modules) {
	if (jalno.modules[packageName] !== undefined) {
		for (const regex in jalno.modules[packageName]) {
			if (jalno.modules[packageName][regex] !== undefined) {
				if (modules[packageName] === undefined) {
					modules[packageName] = {};
				}
				modules[packageName][regex] = Module.unserialize(jalno.modules[packageName][regex]);
			}
		}
	}
}
JalnoResolver.setModules(modules);
const fronts = [];
for (const front of jalno.fronts) {
	fronts.push(Front.unserialize(front));
}
JalnoResolver.setFronts(fronts);
const outputPath = path.resolve("..", "storage", "public", "frontend", "dist");
module.exports = {
	entry: jalno.entries,
	stats: {
		all: false,
		colors: false,
		modules: false,
	},
	devtool: false,
	optimization: {
		splitChunks: {
			cacheGroups: {
				common: {
					name: "common",
					filename: "common.js",
					test(module, chunks) {
						return JalnoResolver.isCommonModule(module);
					},
				},
			},
		},
	},
	output: {
		filename: "[name].js",
		chunkFilename: "[name].js",
		path: outputPath,
	},
	resolve: {
		plugins: [new JalnoResolver("module", "resolve")],
		extensions: [".ts", ".js", ".less", ".css", ".sass", ".scss"],
	},
	module: {
		rules: [
			{
				test: /\.css$/,
				use: [
					MiniCssExtractPlugin.loader,
					"style-loader",
					"css-loader",
				],
			},
			{
				test: /\.less$/,
				use: [
					MiniCssExtractPlugin.loader,
					"style-loader",
					"css-loader",
					"less-loader"
				],
			},
			{
				test: /\.(scss)$/,
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
	mode: jalno.mode,
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
};`;
        await util_1.promisify(fs.writeFile)(path.resolve("..", "webpack.config.js"), config, "UTF8");
    }
}
Main.watch = false;
Main.skipInstall = false;
Main.writeWebpackConfig = false;
Main.skipWebpack = false;
Main.clean = false;
Main.mode = "development";
exports.default = Main;
Main.run();
