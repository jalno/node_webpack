"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const util_1 = require("util");
const Front_1 = require("./Front");
const Language_1 = require("./Language");
class Package {
    constructor(_dir, _name) {
        this._dir = _dir;
        this._name = _name;
        this._path = this._dir + "/" + this._name;
    }
    static unserialize(data) {
        return new Package(data._dir, data._name);
    }
    async getFrontends() {
        const packagejson = this._path + "/" + "package.json";
        const data = await util_1.promisify(fs.readFile)(packagejson, "utf8");
        const file = JSON.parse(data);
        if (!file.hasOwnProperty("frontend")) {
            return [];
        }
        if (typeof file.frontend === "string") {
            file.frontend = [file.frontend];
        }
        const fronts = [];
        for (const front of file.frontend) {
            fronts.push(new Front_1.default(this, front));
        }
        return fronts;
    }
    async getLangs() {
        const packagejson = this._path + "/" + "package.json";
        const data = await util_1.promisify(fs.readFile)(packagejson, "utf8");
        const file = JSON.parse(data);
        if (!file.hasOwnProperty("languages")) {
            return [];
        }
        const langs = [];
        for (const code in file.languages) {
            if (file.languages[code]) {
                langs.push(new Language_1.default(code, path.join(this._path, file.languages[code])));
            }
        }
        return langs;
    }
    get path() {
        return this._path;
    }
    get name() {
        return this._name;
    }
}
exports.default = Package;
