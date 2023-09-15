import * as child_process from "child_process";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import * as webpackTypes from "webpack";
import Front from "./Front";
import JalnoOptions from "./JalnoOptions";
import JalnoResolver, { IModules } from "./JalnoResolver";
import Language from "./Language";
import LessLoaderHelper from "./LessLoaderHelper";
import Package from "./Package";
import Translator from "./Translator";

export interface IEntries {
	[key: string]: string[];
}

type webpackMode = "production" | "development";

export default class Main {
	public static async run() {
		if (process.argv.length > 2) {
			await Main.checkArgs();
			if (process.argv.indexOf("-h") !== -1 || process.argv.indexOf("--help") !== -1) {
				return Main.introduce();
			}
			for (const arg of Main.args) {
                switch (typeof arg === "string" ? arg : arg[0]) {
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
                    case "--tsconfig":
                        Main.tsconfig = arg[1];
                        console.log(`Use tsconfig file in path ${Main.tsconfig}`);
                        break;
                }
            }
		}
		if (!Main.tsconfig) {
			Main.tsconfig = path.resolve("tsconfig.json");
		}
		process.chdir(__dirname);
		Main.jalnoOptions = await JalnoOptions.load();
		await Main.initDependencies();
		const packages = await Main.initPackages();
		const fronts: Front[] = [];
		for (const p of packages) {
			const packageFronts = await p.getFrontends();
			fronts.push(...packageFronts);
			for (const lang of await p.getLangs()) {
				Translator.addLang(lang.code, lang.path);
			}
			for (const front of packageFronts) {
				if (Main.clean) {
					await front.clean();
				}
				await front.initDependencies();
				await Main.installDependencies(front.path);
				for (const lang of await front.getLangs()) {
					Translator.addLang(lang.code, lang.path);
				}
			}
		}
		let entries: IEntries = {};
		if (! Main.skipWebpack || Main.writeWebpackConfig) {
			Main.JalnoResolver = require("./JalnoResolver").default;
			await Main.JalnoResolver.initSources(fronts);
			entries = await Main.getEntries(fronts);
			if (Translator.langs.length) {
				if (!entries.hasOwnProperty("common")) {
					entries.common = [];
				}
				await Translator.exportFile(Main.jalnoOptions.availableLangs);
				entries.common.push(Translator.filePath);
			}
		}
		if (! Main.skipWebpack) {
			Main.runWebpack(entries);
		}
		if (Main.writeWebpackConfig) {
			const modules = Main.JalnoResolver.getModules();
			Main.exportWebpackConfig(fronts, modules, entries);
		}
	}
	public static async updateJalnoMoudles(modules: IModules) {
		const jalnoPath = path.resolve(__dirname, "..", "jalno.json");
		if (! await promisify(fs.exists)(jalnoPath)) {
			return;
		}
		const jalno = JSON.parse(await promisify(fs.readFile)(jalnoPath, "UTF8"));
		jalno.modules = modules;
		await promisify(fs.writeFile)(path.resolve("..", "jalno.json"), JSON.stringify(jalno, null, 2), "UTF8");
	}
	private static JalnoResolver: any;
	private static watch = false;
	private static skipInstall = false;
	private static writeWebpackConfig = false;
	private static skipWebpack = false;
	private static clean = false;
	private static mode: webpackMode = "development";
	private static jalnoOptions: JalnoOptions;
	private static args: Array<string|string[]> = [];
	private static tsconfig: string;
	private static async checkArgs() {
		Main.args = [];
        for (let i = 2; i < process.argv.length; i++) {
            let arg: string | string[] = "";
            if (process.argv[i].search("=") > -1) {
                arg = process.argv[i].split("=");
            } else {
				arg = process.argv[i];
			}
			let isString = (typeof arg === "string");
            if (isString && arg === "--tsconfig" && (i + 1) in process.argv && !process.argv[i + 1].startsWith("--")) {
                i++;
				arg = [arg, process.argv[i]];
				isString = false;
			}
			const key = (isString ? arg : arg[0]);
            switch (key) {
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
					if (!isString) {
						arg = key;
					}
                    break;
                case "--tsconfig":
                    if (arg.length !== 2 || arg[1].length === 0) {
                        console.error(`\u001b[1m\u001b[31mError: switch 'tsconfig' requires an address\u001b[39m\u001b[22m`);
                        process.exit(1);
                    }
                    if (!arg[1].startsWith("packages")) {
                        console.error(`\u001b[1m\u001b[31mError: tsconfig path must start with 'packages'\u001b[39m\u001b[22m`);
                        process.exit(1);
                    }
                    const tsconfigPath = path.resolve("..", "..", "..", ...arg[1].split("/"));
                    if (!await promisify(fs.exists)(tsconfigPath)) {
                        console.error(`\u001b[1m\u001b[31mError: Can not find any tsconfig file in ${tsconfigPath}\u001b[39m\u001b[22m`);
                        process.exit(1);
                    }
                    (arg[1] as string) = tsconfigPath;
                    break;
                default:
                    console.error(`\u001b[1m\u001b[31mCommand line option ${key} is not understood in combination with the other options\u001b[39m\u001b[22m`);
                    process.exit(1);
            }

            Main.args.push(arg);
        }
		if (
			(process.argv.indexOf("--skip-install") !== -1 || process.argv.indexOf("--webpack") !== -1) &&
			(process.argv.indexOf("-i") !== -1 || process.argv.indexOf("--skip-webpack") !== -1 || process.argv.indexOf("--install") !== -1) &&
			process.argv.indexOf("--wwc") === -1 && process.argv.indexOf("--write-webpack-config") === -1 &&
			process.argv.indexOf("-c") === -1 && process.argv.indexOf("--clear") === -1
		) {
			console.error(`\u001b[1m\u001b[31mConnot use skip webpack and skip install options in same time\u001b[39m\u001b[22m`);
			process.exit(1);
		}
		if (
			(process.argv.indexOf("-w") !== -1 || process.argv.indexOf("--watch") !== -1) &&
			(process.argv.indexOf("--skip-webpack") !== -1 || process.argv.indexOf("--install") !== -1)
		) {
			console.error(`\u001b[1m\u001b[31mConnot use skip webpack and watch webpack options in same time\u001b[39m\u001b[22m`);
			process.exit(1);
		}
	}
	private static introduce() {
		console.table('process.env', process.env)
		console.log(`Node Webpack ${process.env.npm_package_version}\n
usage bun run [options] [-- ...args] command\n
node webpack is a commandline package manager and provides commands for
installing and managing as well as querying information about packages.\n
Most used commands:
	build - compile source files
	start - install dependencies and run webpack
Options:
	-h, --help			Print this message.
	-w, --watch			Turn on webpack watch mode. This means that after the initial build, webpack will continue to watch for changes in any of the resolved files.
	--wwc, --write-webpack-config	Export webpack config to webpack.config.js .
	--webpack, --skip-install	Skip install dependencies and just run webpack.
	-i, --install, --skip-webpack	Skip webpack and just install dependencies.
	-c, --clear			Remove package node_modules.
	--tsconfig			Set tsconfig.json file [default is node_webpack tsconfig]
	--production			Change webpack mode to production [default is development]`);
	}
	private static async initPackages(): Promise<Package[]> {
		const packagesPath = path.resolve("..", "..", "..");
		const files = await promisify(fs.readdir)(packagesPath, {
			withFileTypes: true,
		});
		const packages = [];
		for (const file of files) {
			const packagepath = path.resolve(packagesPath , file.name);
			if (file.isDirectory() && await promisify(fs.exists)(packagepath + "/package.json")) {
				packages.push(new Package(packagesPath, file.name));
			}
		}
		return packages;
	}
	private static async initDependencies() {
		if (Main.skipInstall) {
			return;
		}
		try {
			await promisify(child_process.exec)("bun --help");
		} catch (e) {
			throw new Error("Cannot find bun on this environment");
		}
		await Main.installDependencies();
	}
	private static async installDependencies(where = ""): Promise<void> {
		if (Main.skipInstall) {
			return;
		}
		where = where || path.resolve(__dirname, "../");

		return new Promise((resolve, reject) => {
			console.log(`check ${where}/package.json is exists?`);
			if (!fs.existsSync(`${where}/package.json`)) {
				console.log("is not exists, so skip this");
				return resolve();
			}
			console.log(`run bun install on ${where}`);
			const bun = child_process.spawn("bun", ["install"], { cwd: where, stdio: 'inherit' });
			bun.on("close", (code) => {
				console.log("\n\n"); // This make webpack output visible
				if (code == 0) {
					resolve();
				} else {
					reject();
				}
			});
		});
	}
	private static async runWebpack(entries: IEntries) {
		const webpack = require("webpack");
		const MiniCssExtractPlugin = require("mini-css-extract-plugin");
		const OptimizeCSSAssetsPlugin = require("optimize-css-assets-webpack-plugin");
		const TerserPlugin = require("terser-webpack-plugin");
		const precss = require("precss");
		const autoprefixer = require("autoprefixer");
		const outputPath = path.resolve("..", "..", "storage", "public", "frontend", "dist");
		let compiler: webpackTypes.Compiler;
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
					minimizer: [
						new TerserPlugin({
							terserOptions: {
								output: {
									comments: false,
								},
							},
							extractComments: false,
						}),
						new OptimizeCSSAssetsPlugin({}),
					],
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
					plugins: [
						new Main.JalnoResolver("module", "resolve"),
						new LessLoaderHelper("resolve", "resolve"),
					],
					extensions: [".ts", ".tsx", ".js", ".less", ".css", ".sass", ".scss"],
				},
				module: {
					rules: [
						{
							test: /\.css$/,
							use: [
								MiniCssExtractPlugin.loader,
								"css-loader",
							],
						},
						{
							test: /\.less$/,
							use: [
								MiniCssExtractPlugin.loader,
								"css-loader",
								"less-loader",
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
								configFile: require.resolve(Main.tsconfig),
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
						"Translator": ["@jalno/translator", "default"],
						"t": ["@jalno/translator", "t"],
					}),
				],
			});
		} catch (err) {
			if (err.name === "WebpackOptionsValidationError") {
				console.error(`\u001b[1m\u001b[31m${err.message}\u001b[39m\u001b[22m`);
				process.exit(1);
			}
			throw err;
		}

		if (process.stderr.isTTY) {
			(process.stderr as any).clearLine(0);
		}
		new webpack.ProgressPlugin({
			profile: false,
		}).apply(compiler);
		const exists = promisify(fs.exists);
		const read = promisify(fs.readFile);
		const resultpath = path.resolve("..", "result.json");
		const basePath = path.resolve("..", "..", "..", "..");
		const offset = (basePath + "/").length;
		const resultEntries: IEntries = {};
		for (const name in entries) {
			if (entries[name] !== undefined) {
				for (const entry of entries[name]) {
					if (resultEntries[name] === undefined) {
						resultEntries[name] = [];
					}
					resultEntries[name].push(entry.substr(offset));
				}
			}
		}
		const compilerCallback = async (err, stats) => {
			if (err) {
				throw err;
			}
			let result: any = {};
			if (await exists(resultpath)) {
				result = JSON.parse(await read(resultpath, "UTF8"));
			} else {
				result = {
					outputedFiles: {},
				};
			}
			result.handledFiles = resultEntries;
			const promises = [];
			for (const chunk of stats.compilation.chunks) {
				for (const file of chunk.files) {
					const filePath = path.resolve(outputPath, file);
					if (! await exists(filePath)) {
						console.error(`\u001b[1m\u001b[31mOutput file '${file}' does not exists on '${filePath}'\u001b[39m\u001b[22m`);
						process.exit(1);
					}
					const relativePath = filePath.substr(offset);
					if (result.outputedFiles[chunk.name] === undefined) {
						result.outputedFiles[chunk.name] = [];
					}
					if (Main.mode === "production") {
						const promise = new Promise((resolve, reject) => {
							const hash = crypto.createHash("sha256");
							const stream = fs.createReadStream(filePath, {
								encoding: "UTF8",
							});
							stream.on("data", (buffer) => {
								hash.update(buffer);
							});
							stream.on("end", () => {
								let found = false;
								for (const item of result.outputedFiles[chunk.name]) {
									if (item.name === relativePath) {
										item.hash = hash.digest("hex");
										found = true;
										break;
									}
								}
								if (! found) {
									result.outputedFiles[chunk.name].push({
										name: relativePath,
										hash: hash.digest("hex"),
									});
								}
								resolve();
							});
							stream.on("error", reject);
						});
						promises.push(promise);
					} else {
						let found = false;
						for (const item of result.outputedFiles[chunk.name]) {
							if (item.name === relativePath) {
								found = true;
								break;
							}
						}
						if (! found) {
							result.outputedFiles[chunk.name].push({
								name: relativePath,
							});
						}
					}
				}
			}
			if (promises.length) {
				await Promise.all(promises);
			}
			await promisify(fs.writeFile)(path.resolve("..", "result.json"), JSON.stringify(result, null, 2), "UTF8");
			if (Main.writeWebpackConfig) {
				await Main.updateJalnoMoudles(Main.JalnoResolver.getModules());
			}
		};
		(compiler as any).devtool = false;
		if (Main.watch) {
			compiler.watch(true as any, compilerCallback);
		} else {
			compiler.run((err, stats) => {
				if ((compiler as any).close) {
					(compiler as any).close((err2) => {
						compilerCallback(err || err2, stats);
					});
				} else {
					compilerCallback(err, stats);
				}
			});
		}
	}
	private static async getEntries(fronts: Front[]): Promise<IEntries> {
		const entries: IEntries = {};
		for (const front of fronts) {
			const frontEntries = await front.getEntries();
			if (frontEntries !== undefined) {
				if (entries[frontEntries.name] === undefined) {
					entries[frontEntries.name] = [];
				}
				for (const entry of frontEntries.entries) {
					if (entries[frontEntries.name].indexOf(entry) === -1) {
						entries[frontEntries.name].push(entry);
					}
				}
			}
		}
		return entries;
	}
	private static async exportWebpackConfig(fronts: Front[], modules: IModules, entries: IEntries) {
		await promisify(fs.writeFile)(path.resolve("..", "jalno.json"), JSON.stringify({
			mode: Main.mode,
			fronts: fronts,
			entries: entries,
			modules: modules,
			tsconfig: Main.tsconfig,
		}, null, 2), "UTF8");
		const config = `const webpack = require("webpack");
const path = require("path");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const OptimizeCSSAssetsPlugin = require("optimize-css-assets-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const precss = require("precss");
const autoprefixer = require("autoprefixer");
const JalnoResolver = require("./dist/JalnoResolver").default;
const LessLoaderHelper = require("./dist/LessLoaderHelper").default;
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
		minimizer: [
			new TerserPlugin({
				terserOptions: {
					output: {
						comments: false,
					},
				},
				extractComments: false,
			}),
			new OptimizeCSSAssetsPlugin({}),
		],
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
		plugins: [
			new JalnoResolver("module", "resolve"),
			new LessLoaderHelper("resolve", "resolve"),
		],
		extensions: [".ts", ".tsx", ".js", ".less", ".css", ".sass", ".scss"],
	},
	module: {
		rules: [
			{
				test: /\\.css$/,
				use: [
					MiniCssExtractPlugin.loader,
					"css-loader",
				],
			},
			{
				test: /\\.less$/,
				use: [
					MiniCssExtractPlugin.loader,
					"css-loader",
					"less-loader"
				],
			},
			{
				test: /\\.(scss)$/,
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
			{ test: /\\.png$/, loader: "file-loader" },
			{ test: /\\.jpg$/, loader: "file-loader" },
			{ test: /\\.gif$/, loader: "file-loader" },
			{ test: /\\.woff2?$/, loader: "file-loader" },
			{ test: /\\.eot$/, loader: "file-loader" },
			{ test: /\\.ttf$/, loader: "file-loader" },
			{ test: /\\.svg$/, loader: "file-loader" },
			{
				test: /\\.tsx?$/,
				loader: "ts-loader",
				options: {
					configFile: require.resolve(jalno.tsconfig),
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
			"Translator": ["@jalno/translator", "default"],
			"t": ["@jalno/translator", "t"],
		}),
	],
};`;
		await promisify(fs.writeFile)(path.resolve("..", "webpack.config.js"), config, "UTF8");
	}
}
