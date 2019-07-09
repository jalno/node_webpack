import * as fs from "fs";
import { promisify } from "util";
import Front from "./Front";

export default class Package {
	public constructor(private _name: string) {}
	public async getFrontends(): Promise<Front[]> {
		const packagejson = this._name + "/" + "package.json";
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
	public get path() {
		return this._name;
	}
}
