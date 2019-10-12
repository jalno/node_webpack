import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import Front from "./Front";
import Language from "./Language";

export default class Package {
	public static unserialize(data) {
		return new Package(data._dir, data._name);
	}
	private _path: string;
	public constructor(private _dir: string, private _name: string) {
		this._path = this._dir + "/" + this._name;
	}
	public async getFrontends(): Promise<Front[]> {
		const packagejson = this._path + "/" + "package.json";
		const data = await promisify(fs.readFile)(packagejson, "utf8");
		const file = JSON.parse(data);
		if (! file.hasOwnProperty("frontend")) {
			return [];
		}
		if (typeof file.frontend === "string") {
			file.frontend = [file.frontend];
		}
		const fronts = [];
		for (const front of file.frontend) {
			fronts.push(new Front(this, front));
		}
		return fronts;
	}
	public async getLangs(): Promise<Language[]> {
		const packagejson = this._path + "/" + "package.json";
		const data = await promisify(fs.readFile)(packagejson, "utf8");
		const file = JSON.parse(data);
		if (! file.hasOwnProperty("languages")) {
			return [];
		}
		const langs: Language[]  = [];
		for (const code in file.languages) {
			if (file.languages[code]) {
				langs.push(new Language(code, path.join(this._path, file.languages[code])));
			}
		}
		return langs;
	}
	public get path() {
		return this._path;
	}
	public get name() {
		return this._name;
	}
}
