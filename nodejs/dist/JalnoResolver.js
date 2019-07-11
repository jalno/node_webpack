"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const semver = require("semver");
const util_1 = require("util");
class JalnoResolver {
    constructor(source, target) {
        this.source = source;
        this.target = target;
    }
    static async initSources(sources) {
        const installedModules = {};
        for (const front of sources) {
            const modules = await front.getModules();
            for (const module of modules) {
                if (installedModules[module.name] === undefined) {
                    installedModules[module.name] = [];
                }
                installedModules[module.name].push(module);
            }
        }
        for (const name in installedModules) {
            if (installedModules[name] !== undefined) {
                const regexes = {};
                for (const module of installedModules[name]) {
                    if (regexes[module.regex] === undefined) {
                        regexes[module.regex] = [];
                    }
                }
                for (const regex in regexes) {
                    if (regexes[regex] !== undefined) {
                        for (const module of installedModules[name]) {
                            const satisfies = semver.satisfies(module.version, regex);
                            if (satisfies) {
                                module.satisfieses++;
                                regexes[regex].push(module);
                            }
                        }
                    }
                }
                let selectedNode;
                for (const regex in regexes) {
                    if (regexes[regex] !== undefined) {
                        for (const module of regexes[regex]) {
                            if (selectedNode === undefined || module.satisfieses > selectedNode.satisfieses) {
                                selectedNode = module;
                            }
                        }
                        if (JalnoResolver.modules[name] === undefined) {
                            JalnoResolver.modules[name] = [];
                        }
                        JalnoResolver.modules[name].push({
                            regex: regex,
                            module: selectedNode,
                        });
                    }
                }
            }
        }
        for (const name in JalnoResolver.modules) {
            if (JalnoResolver.modules[name] !== undefined) {
                for (const item of JalnoResolver.modules[name]) {
                }
            }
        }
    }
    static IsCommonModule(module) {
        const userRequest = module.userRequest;
        if (typeof userRequest !== "string") {
            return false;
        }
        let found = false;
        let exts = [".ts", ".js"];
        exts = exts.sort();
        for (let i = 0; i < exts.length && !found; i++) {
            if (userRequest.substr(-exts[i].length) === exts[i]) {
                found = true;
            }
        }
        if (found &&
            JalnoResolver.commonFiles.hasOwnProperty(userRequest) &&
            JalnoResolver.commonFiles[userRequest].length > 1) {
            return true;
        }
        return false;
    }
    static async lookingForPackage(name, basepath) {
        const p = `${basepath}/node_modules/${name}/package.json`;
        if (await util_1.promisify(fs.exists)(p) &&
            (await util_1.promisify(fs.lstat)(p)).isFile()) {
            const nodePackage = JSON.parse(await util_1.promisify(fs.readFile)(p, "UTF8"));
            if (JalnoResolver.modules[name] !== undefined) {
                for (const item of JalnoResolver.modules[name]) {
                    const satisfies = semver.satisfies(nodePackage.version, item.regex);
                    if (satisfies) {
                        return item.module;
                    }
                }
            }
        }
    }
    async apply(resolver) {
        resolver.plugin(this.source, async (module, callback) => {
            let packageName = module.request;
            const splash = packageName.indexOf("/");
            if (splash > -1) {
                packageName = packageName.substr(0, splash);
            }
            const asset = await JalnoResolver.lookingForPackage(packageName, module.path);
            if (asset) {
                const newModule = {
                    directory: false,
                    path: module.path,
                    query: module.query,
                    request: module.request,
                };
                if (splash < 0) {
                    newModule.request = path.resolve(asset.getPath(), asset.main);
                }
                else {
                    newModule.request = path.resolve(asset.getPath(), module.request.substr(splash + 1));
                }
                const exists = util_1.promisify(fs.exists);
                const lastSplash = newModule.request.lastIndexOf("/");
                if (lastSplash >= 0) {
                    const filename = newModule.request.substr(lastSplash + 1);
                    const formats = ["ts", "js", "less", "css", "scss", "sass"];
                    const dot = filename.lastIndexOf(".");
                    const ext = dot !== -1 ? filename.substr(dot) : "";
                    if (formats.indexOf(ext) === -1) {
                        for (const format of formats) {
                            if (exists(newModule.request + "." + format)) {
                                newModule.request += "." + format;
                                break;
                            }
                        }
                    }
                }
                if (await exists(newModule.request)) {
                    const regex = /\/packages\/([^\/]+)\//;
                    const matches = regex.exec(newModule.path);
                    if (matches) {
                        if (!JalnoResolver.commonFiles.hasOwnProperty(newModule.request)) {
                            JalnoResolver.commonFiles[newModule.request] = [];
                        }
                        if (JalnoResolver.commonFiles[newModule.request].indexOf(matches[1]) < 0) {
                            JalnoResolver.commonFiles[newModule.request].push(matches[1]);
                        }
                    }
                    newModule.path = path.dirname(newModule.request);
                    resolver.doResolve(this.target, newModule, null, callback);
                }
                else {
                    callback();
                }
            }
            else {
                callback();
            }
        });
    }
}
JalnoResolver.commonFiles = {};
JalnoResolver.modules = {};
exports.default = JalnoResolver;
