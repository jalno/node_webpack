import * as child_process from "child_process";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import Front from "./Front";
import Package from "./Package";

export default class Main {
	public static async run() {
		await Main.installDependecies();
		const packages = await Main.initPackages();
		// const assets = await Main.installAssets(packages);
		const entries: {
			[key: string]: string[],
		} = {};
		for (const p of packages) {
			const fronts = await p.getFrontends();
			for (const front of fronts) {
				console.log("Package: ", front.package.name + " and front is: " + front.name);
				await front.initAssets();
				await Main.installAssets(front.path);
			}
		}
	}
	private static npm;
	private static webpack;
	private static async initPackages(): Promise<Package[]> {
		const packagesPath = path.resolve("../..");
		const files = await promisify(fs.readdir)(packagesPath, {
			withFileTypes: true,
		});
		const packages = [];
		for (const file of files) {
			const packagepath = packagesPath + "/" + file.name;
			if (file.isDirectory() && await promisify(fs.exists)(packagepath + "/package.json")) {
				packages.push(new Package(packagesPath, file.name));
			}
		}
		return packages;
	}
	private static async installDependecies() {
		if (!await promisify(fs.exists)("node_modules/npm")) {
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
		await Main.installAssets();
		Main.webpack = require("webpack");
	}
	private static async installAssets(where = "") {
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
	private static async runWebpack(packages: Package[]) {
		const entries: {
			[key: string]: string[],
		} = {};
		for (const p of packages) {
			const fronts = [];
		}
		Main.webpack({

		});
	}
}
Main.run();
