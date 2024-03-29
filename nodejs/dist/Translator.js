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
    static async exportFile(activeLanguages) {
        const langs = {};
        for (const lang of Translator._langs) {
            if (activeLanguages !== undefined && activeLanguages.indexOf(lang.code) === -1) {
                continue;
            }
            if (langs[lang.code] === undefined) {
                langs[lang.code] = [];
            }
            langs[lang.code].push(lang.path);
        }
        let TranslatorDotTs = `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Translator = (function () {
	function Translator() {
	}
	Translator.init = function () {
		window.jalno = {
			translator: {},
		};`;
        for (const code in langs) {
            if (langs[code] !== undefined) {
                TranslatorDotTs += `\n\t\twindow.jalno.translator["${code}"] = [];`;
                for (const langPath of langs[code]) {
                    TranslatorDotTs += `\n\t\twindow.jalno.translator.${code}.push(require("${langPath}"));`;
                }
            }
        }
        TranslatorDotTs += `\n\t};
	Translator.init();
}());
exports.default = Translator`;
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
        return path.resolve("..", "..", "assets", "js", "Translator.js");
    }
}
exports.default = Translator;
Translator._langs = [];
