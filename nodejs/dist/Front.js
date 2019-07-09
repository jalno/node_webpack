"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const util_1 = require("util");
const Asset_1 = require("./Asset");
class Front {
    constructor(_package, _name) {
        this._package = _package;
        this._name = _name;
        this.assets = [];
        this._path = _package.path + "/" + _name;
    }
    async getAssets() {
        if (!this.assets.length) {
            const packagejson = this._path + "/package.json";
            if (!await util_1.promisify(fs.exists)(packagejson)) {
                return [];
            }
            const data = await util_1.promisify(fs.readFile)(packagejson, "UTF8");
            const packages = JSON.parse(data);
            if (!packages.hasOwnProperty("dependencies") && packages.hasOwnProperty("devDependencies")) {
                return [];
            }
            for (const name in packages.dependencies) {
                if (packages.dependencies[name] !== undefined) {
                    this.assets.push(new Asset_1.default(name, packages.dependencies[name], this));
                }
            }
            for (const name in packages.devDependencies) {
                if (packages.devDependencies[name] !== undefined) {
                    this.assets.push(new Asset_1.default(name, packages.dependencies[name], this));
                }
            }
        }
        return this.assets;
    }
    get path() {
        return this._path;
    }
}
exports.default = Front;
