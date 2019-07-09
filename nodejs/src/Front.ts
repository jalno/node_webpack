import * as fs from "fs";
import { promisify } from "util";
import Asset from "./Asset";
import Package from "./Package";

export interface IAsset {
	type: string;
	name: string;
	version?: string;
}

export interface IEntries {
	name: string;
	entries: string[];
}

export default class Front {
	private _path: string;
	private assets: Asset[] = [];
	private entiesTypes = ["css", "less", "scss", "sass", "js", "ts"];
	public constructor(private _package: Package, private _name: string) {
		this._path = _package.path + "/" + _name;
	}
	public async initAssets(): Promise<void> {
		console.log("Try to init packages");
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
	public async getTheme(): Promise<any> {
		const themeJson = this._path + "/theme.json";
		if (! await promisify(fs.exists)(themeJson)) {
			return;
		}
		return JSON.parse(await promisify(fs.readFile)(themeJson, "UTF8"));
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
