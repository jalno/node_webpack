import * as fs from "fs";
import { promisify } from "util";
import Asset from "./Asset";
import Package from "./Package";

export interface IAsset {
	name: string;
	version: string;
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
	public async getAssets(): Promise<Asset[]> {
		if (! this.assets.length) {
			const packagejson = this._path + "/package.json";
			if (! await promisify(fs.exists)(packagejson)) {
				return [];
			}
			const data = await promisify(fs.readFile)(packagejson, "UTF8");
			const packages = JSON.parse(data);
			if (! packages.hasOwnProperty("dependencies") && packages.hasOwnProperty("devDependencies")) {
				return [];
			}
			for (const name in packages.dependencies) {
				if (packages.dependencies[name] !== undefined) {
					this.assets.push(new Asset(name, packages.dependencies[name], this));
				}
			}
			for (const name in packages.devDependencies) {
				if (packages.devDependencies[name] !== undefined) {
					this.assets.push(new Asset(name, packages.dependencies[name], this));
				}
			}
		}
		return this.assets;
	}
	public get path() {
		return this._path;
	}
}
