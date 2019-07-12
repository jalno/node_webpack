import * as child_process from "child_process";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import * as webpackTypes from "webpack";
import Front from "./Front";
import JalnoResolver from "./JalnoResolver";
import Package from "./Package";

export interface IEntries {
	[key: string]: string[];
}

export default class Main {
	public static async run() {
		process.chdir(__dirname);
		await Main.installDependecies();
		const packages = await Main.initPackages();
		const fronts: Front[] = [];
		for (const p of packages) {
			const packageFronts = await p.getFrontends();
			fronts.push(...packageFronts);
			for (const front of packageFronts) {
				console.log("Package: ", front.package.name + " and front is: " + front.name);
				await front.initDependencies();
				await Main.installDependencies(front.path);
			}
		}
		Main.JalnoResolver = require("./JalnoResolver").default as JalnoResolver;
		await Main.JalnoResolver.initSources(fronts);
		Main.runWebpack(fronts);
	}
	private static npm: any;
	private static JalnoResolver: any;
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
	private static async installDependecies() {
		if (!await promisify(fs.exists)(path.resolve("..", "node_modules", "npm"))) {
			let npmBin: string;
			try {
				const out = await promisify(child_process.exec)("which npm");
				npmBin = out.stdout.trimEnd();
			} catch (e) {
				throw new Error("Cannot find npm on this envirement");
			}
			const execFile = await promisify(child_process.execFile);
			try {
				await execFile(npmBin, ["link", "npm"]);
			} catch (e) {
				throw new Error("Cannot find npm in your global repository");
			}
		}
		Main.npm = require("npm");
		console.log("Package: node-webpack");
		await Main.installDependencies();
		await new Promise((resolve, reject) => {
			Main.npm.link("npm", (err: any) => {
				if (err) {
					return reject(err);
				}
				resolve();
			});
		});
	}
	private static async installDependencies(where = "") {
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
			Main.npm.config.set("unsafe-perm", true);
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
	private static async runWebpack(fronts: Front[]) {
		const webpack = require("webpack");
		const MiniCssExtractPlugin = require("mini-css-extract-plugin");
		const CleanCSSPlugin = require("less-plugin-clean-css");
		const precss = require("precss");
		const autoprefixer = require("autoprefixer");
		const entries: IEntries = {};
		for (const front of fronts) {
			const frontEntries = await front.getEntries();
			if (frontEntries !== undefined) {
				if (entries[frontEntries.name] === undefined) {
					entries[frontEntries.name] = frontEntries.entries;
				} else {
					for (const entry of frontEntries.entries) {
						if (entries[frontEntries.name].indexOf(entry) === -1) {
							entries[frontEntries.name].push(entry);
						}
					}
				}
			}
		}
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
		compiler.run(async (err, stats) => {
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
			const exists = promisify(fs.exists);
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
			await promisify(fs.writeFile)(path.resolve("..", "result.json"), JSON.stringify(result, null, 2), "UTF8");
		});
	}
}
Main.run();
