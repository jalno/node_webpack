
export default class Translator {
	public static addLang(code: string, file: string) {
		if (Translator.langs[code] === undefined) {
			Translator.langs[code] = [];
		}
		const lang = require(file);
		Translator.langs[code].concat(lang);
	}
	private static langs: Array<{
		[code: string]: Array<{
			[key: string]: string;
		}>;
	}> = [];
}
