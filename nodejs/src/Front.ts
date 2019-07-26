import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import Module from "./Module";
import Package from "./Package";

export interface IAsset {
	type: string;
	name: string;
	version?: string;
	file?: string;
}

export interface IEntries {
	name: string;
	entries: string[];
}

export default class Front {
	public static unserialize(data) {
		return new Front(Package.unserialize(data._package), data._name);
	}
	private _path: string;
	private entriesTypes = ["css", "less", "scss", "sass", "js", "ts"];
	public constructor(private _package: Package, private _name: string) {
		this._path = _package.path + "/" + _name;
	}
	public async initDependencies(): Promise<void> {
		const theme = await this.getTheme();
		if (! theme || ! theme.hasOwnProperty("assets")) {
			return;
		}
		const packagejson = this._path + "/package.json";
		let packages = {} as any;
		if (await promisify(fs.exists)(packagejson)) {
			packages = JSON.parse(await promisify(fs.readFile)(packagejson, "UTF8"));
		}
		if (! packages.hasOwnProperty("dependencies")) {
			packages.dependencies = {};
		}
		let hasChange = false;
		for (const asset of theme.assets as IAsset[]) {
			if (asset.type === "package") {
				if (asset.name.indexOf("@") !== -1) {
					const packageDesc = asset.name.split("@", 2);
					asset.name = packageDesc[0];
					asset.version = packageDesc[1];
				}
				if (packages.dependencies[asset.name] === undefined) {
					packages.dependencies[asset.name] = asset.version ? asset.version : "latest";
					hasChange = true;
				} else if (asset.version && packages.dependencies[asset.name] !== asset.version) {
					packages.dependencies[asset.name] = asset.version;
					hasChange = true;
				}
			}
		}
		if (hasChange) {
			await promisify(fs.writeFile)(packagejson, JSON.stringify(packages, null, 2), "utf8");
		}
	}
	public async getModules(): Promise<Module[]> {
		const node_modules = this._path + "/node_modules";
		const json = this._path + "/package.json";
		const exists = promisify(fs.exists);
		const readFile = promisify(fs.readFile);
		if (
			! await exists(node_modules) ||
			! await exists(json)
		) {
			return [];
		}
		const packages = JSON.parse(await readFile(json, "UTF8"));
		const assets: Module[] = [];
		for (const name in packages.dependencies) {
			if (packages.dependencies[name] !== undefined) {
				const path = node_modules + "/" + name + "/package.json";
				if (await exists(path)) {
					const node = JSON.parse(await readFile(path, "UTF8"));
					if (packages.dependencies[name] === "latest") {
						packages.dependencies[name] = "^" + node.version;
					}
					assets.push(new Module(
						name,
						node.version,
						node.hasOwnProperty("main") ? node.main : "index.js",
						packages.dependencies[name],
						this,
					));
				}
			}
		}
		return assets;
	}
	public async getEntries(): Promise<IEntries> {
		const theme = await this.getTheme();
		if (! theme) {
			return;
		}
		const entries = [];
		if (theme.hasOwnProperty("assets")) {
			for (const asset of theme.assets as IAsset[]) {
				if (this.entriesTypes.indexOf(asset.type) > -1 && asset.file !== undefined) {
					entries.push(this._path + "/" + asset.file);
				}
			}
		}
		return {
			name: theme.name,
			entries: entries,
		};
	}
	public async getTheme(): Promise<any> {
		const themeJson = this._path + "/theme.json";
		if (! await promisify(fs.exists)(themeJson)) {
			return;
		}
		return JSON.parse(await promisify(fs.readFile)(themeJson, "UTF8"));
	}
	public async clean(filePath = ""): Promise<void> {
		if (! filePath) {
			filePath = path.resolve(this._path, "node_modules");
		}
		if (! await promisify(fs.exists)(filePath)) {
			return;
		}
		const unlink = promisify(fs.unlink);
		if (! (await promisify(fs.lstat)(filePath)).isDirectory()) {
			return await unlink(filePath);
		}
		const files = await promisify(fs.readdir)(filePath, {
			withFileTypes: true,
		});
		if (files.length > 0) {
			const promises: Array<Promise<void>> = [];
			for (const file of files) {
				const fpath = path.resolve(filePath, file.name);
				if (file.isDirectory()) {
					promises.push(this.clean(fpath));
				} else {
					promises.push(unlink(fpath));
				}
			}
			await Promise.all(promises);
		}
		return promisify(fs.rmdir)(filePath);
	}
	public get name() {
		return this._name;
	}
	public get path() {
		return this._path;
	}
	public get package() {
		return this._package;
	}
}
