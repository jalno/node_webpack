"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const util_1 = require("util");
const Language_1 = require("./Language");
const Module_1 = require("./Module");
const Package_1 = require("./Package");
class Front {
    constructor(_package, _name) {
        this._package = _package;
        this._name = _name;
        this.entriesTypes = ["css", "less", "scss", "sass", "js", "ts"];
        this._path = _package.path + "/" + _name;
    }
    static unserialize(data) {
        return new Front(Package_1.default.unserialize(data._package), data._name);
    }
    async initDependencies() {
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
                const firstAt = asset.name.indexOf("@");
                if (firstAt !== -1) {
                    const packageDesc = ((firstAt === 0) ? asset.name.substr(1) : asset.name).split("@", 2);
                    asset.name = (firstAt === 0 ? "@" : "") + packageDesc[0];
                    if (packageDesc.length === 1) {
                        asset.version = packageDesc[1];
                    }
                }
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
    async getModules() {
        const node_modules = this._path + "/node_modules";
        const json = this._path + "/package.json";
        const exists = util_1.promisify(fs.exists);
        const readFile = util_1.promisify(fs.readFile);
        if (!await exists(node_modules) ||
            !await exists(json)) {
            return [];
        }
        const packages = JSON.parse(await readFile(json, "UTF8"));
        const assets = [];
        for (const name in packages.dependencies) {
            if (packages.dependencies[name] !== undefined) {
                const path = node_modules + "/" + name + "/package.json";
                if (await exists(path)) {
                    const node = JSON.parse(await readFile(path, "UTF8"));
                    if (packages.dependencies[name] === "latest") {
                        packages.dependencies[name] = "^" + node.version;
                    }
                    assets.push(new Module_1.default(name, node.version, node.hasOwnProperty("main") ? node.main : "index.js", packages.dependencies[name], this));
                }
            }
        }
        return assets;
    }
    async getEntries() {
        const theme = await this.getTheme();
        if (!theme) {
            return;
        }
        const entries = [];
        if (theme.hasOwnProperty("assets")) {
            for (const asset of theme.assets) {
                if (this.entriesTypes.indexOf(asset.type) > -1 && asset.file !== undefined) {
                    entries.push(this._path + "/" + asset.file);
                }
            }
        }
        return {
            name: theme.name,
            entries: entries,
        };
    }
    async getTheme() {
        const themeJson = this._path + "/theme.json";
        if (!await util_1.promisify(fs.exists)(themeJson)) {
            return;
        }
        return JSON.parse(await util_1.promisify(fs.readFile)(themeJson, "UTF8"));
    }
    async clean(filePath = "") {
        if (!filePath) {
            filePath = path.resolve(this._path, "node_modules");
        }
        if (!await util_1.promisify(fs.exists)(filePath)) {
            return;
        }
        const unlink = util_1.promisify(fs.unlink);
        if (!(await util_1.promisify(fs.lstat)(filePath)).isDirectory()) {
            return await unlink(filePath);
        }
        const files = await util_1.promisify(fs.readdir)(filePath, {
            withFileTypes: true,
        });
        if (files.length > 0) {
            const promises = [];
            for (const file of files) {
                const fpath = path.resolve(filePath, file.name);
                if (file.isDirectory()) {
                    promises.push(this.clean(fpath));
                }
                else {
                    promises.push(unlink(fpath));
                }
            }
            await Promise.all(promises);
        }
        return util_1.promisify(fs.rmdir)(filePath);
    }
    async getLangs() {
        const file = await this.getTheme();
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
