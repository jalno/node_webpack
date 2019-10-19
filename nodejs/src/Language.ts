
interface ILanguage {
	_code: string;
	_path: string;
}

export default class Language {
	public static unserialize(data: ILanguage) {
		return new Language(data._code, data._path);
	}
	public constructor(private _code: string, private _path: string) {}
	public get code() {
		return this._code;
	}
	public get path() {
		return this._path;
	}
}
