import Front from "./Front";

interface IVersion {
	sign: "^" | "~" | "=";
	majorNumber: number;
	minorNumber: number;
	revisionNumber: number;
}

export default class Asset {
	public constructor(private _name: string, private _version: string, private _front: Front) {}
	public get name() {
		return this._name;
	}
	public get version() {
		return this._version;
	}
	public get front() {
		return this._front;
	}
}
