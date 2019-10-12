"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Translator {
    static addLang(code, file) {
        if (Translator.langs[code] === undefined) {
            Translator.langs[code] = [];
        }
        const phrases = require(file).phrases;
        Translator.langs[code].concat(phrases);
    }
}
Translator.langs = [];
exports.default = Translator;
