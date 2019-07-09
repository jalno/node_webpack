"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const util_1 = require("util");
class Front {
    constructor(_package, _name) {
        this._package = _package;
        this._name = _name;
        this.assets = [];
        this.entiesTypes = ["css", "less", "scss", "sass", "js", "ts"];
        this._path = _package.path + "/" + _name;
    }
    async initAssets() {
        console.log("Try to init packages");
        const theme = await this.getTheme();
        if (!theme || !theme.hasOwnProperty("assets")) {
            return;
        }
        const packagejson = this._path + "/package.json";
        let packages = {};
        if (await util_1.promisify(fs.exists)(packagejson)) {
            packages = JSON.parse(await util_1.promisify(fs.readFile)(packagejson, "UTF8"));
        }
        if (!packages.hasOwnProperty("dependencies")) {
            packages.dependencies = {};
        }
        let hasChange = false;
        for (const asset of theme.assets) {
            if (asset.type === "package") {
                if (packages.dependencies[asset.name] === undefined) {
                    packages.dependencies[asset.name] = asset.version ? asset.version : "latest";
                    hasChange = true;
                }
                else if (asset.version && packages.dependencies[asset.name] !== asset.version) {
                    packages.dependencies[asset.name] = asset.version;
                    hasChange = true;
                }
            }
        }
        if (hasChange) {
            await util_1.promisify(fs.writeFile)(packagejson, JSON.stringify(packages, null, 2), "utf8");
        }
    }
    async getTheme() {
        const themeJson = this._path + "/theme.json";
        if (!await util_1.promisify(fs.exists)(themeJson)) {
            return;
        }
        return JSON.parse(await util_1.promisify(fs.readFile)(themeJson, "UTF8"));
    }
    get name() {
        return this._name;
    }
    get path() {
        return this._path;
    }
    get package() {
        return this._package;
    }
}
exports.default = Front;
