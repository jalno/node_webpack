"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const util_1 = require("util");
const Language_1 = require("./Language");
class Translator {
    static addLang(code, file) {
        Translator._langs.push(new Language_1.default(code, file));
    }
    static async exportFile() {
        const codes = [];
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
        if (!await util_1.promisify(fs.exists)(directory)) {
            await util_1.promisify(fs.mkdir)(directory, { recursive: true });
        }
        return util_1.promisify(fs.writeFile)(Translator.filePath, TranslatorDotTs, "utf8");
    }
    static get langs() {
        return Translator._langs;
    }
    static get filePath() {
        return path.resolve("..", "..", "assets", "ts", "Classes", "Translator.ts");
    }
}
Translator._langs = [];
exports.default = Translator;
