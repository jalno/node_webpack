import Front from "./Front";

export default class Module {
	public satisfieses = 0;
	public constructor(
		private _name: string,
		private _version: string,
		private _main: string,
		private _regex: string,
		private _front: Front,
	) {}
	public getPath() {
		return `${this._front.path}/node_modules/${this._name}`;
	}
	public get name() {
		return this._name;
	}
	public get version() {
		return this._version;
	}
	public get regex() {
		return this._regex;
	}
	public get main() {
		return this._main;
	}
	public get front() {
		return this._front;
	}
}
