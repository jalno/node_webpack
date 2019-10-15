import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import Language from "./Language";

export default class Translator {
	public static addLang(code: string, file: string) {
		Translator._langs.push(new Language(code, file));
	}
	public static async exportFile() {
		const codes: string[] = [];
		for (const lang of Translator._langs) {
			if (codes.indexOf(lang.code) === -1) {
				codes.push(lang.code);
			}
		}
		let TranslatorDotTs = `declare const options: Array<{
	[key: string]: string;
}>;
export default class Translator {
	public static init() {
		const w = window as any;
		w.jalno = {
			translator: {
				lang: {},
			},
		};`;
		for (const code of codes) {
			TranslatorDotTs += `\n\t\tw.jalno.translator.lang.${code} = [];`;
		}
		for (const lang of Translator._langs) {
			TranslatorDotTs += `\n\t\tw.jalno.translator.lang.${lang.code}.push(require("${lang.path}"));`;
		}
		TranslatorDotTs += `\n\t}
	public static t(name: string) {
		const w = window as any;
		if (w.jalno.translator.lang[\`\$\{Translator.getDefault()\}\`] !== undefined) {
			for (const lang of w.jalno.translator.lang[\`\$\{Translator.getDefault()\}\`]) {
				for (const key in lang.phrases) {
					if (lang.phrases[key] !== undefined) {
						if (key === name) {
							return lang.phrases[key];
						}
					}
				}
			}
		}
		return name;
	}
	public static isRTL() {
		const w = window as any;
		if (w.jalno.translator.lang[\`\$\{Translator.getDefault()\}\`] !== undefined) {
			for (const lang of w.jalno.translator.lang[\`\$\{Translator.getDefault()\}\`]) {
				if (lang.hasOwnProperty("rtl")) {
					return lang.rtl;
				}
			}
		}
		return true;
	}
	public static getDefault() {
		return options["packages.base.translator.defaultlang"];
	}
}
$(() => {
	Translator.init();
});`;
		const directory = path.dirname(Translator.filePath);
		if (! await promisify(fs.exists)(directory)) {
			await promisify(fs.mkdir)(directory, { recursive: true });
		}
		return promisify(fs.writeFile)(Translator.filePath, TranslatorDotTs, "utf8");
	}
	public static get langs() {
		return Translator._langs;
	}
	public static get filePath() {
		return path.resolve("..", "..", "assets", "ts", "Classes", "Translator.ts");
	}
	private static _langs = [];
}
