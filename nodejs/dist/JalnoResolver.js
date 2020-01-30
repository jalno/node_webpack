"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path_1 = require("path");
const semver = require("semver");
const util_1 = require("util");
const Module_1 = require("./Module");
class JalnoResolver {
    constructor(source, target) {
        this.source = source;
        this.target = target;
    }
    static async initSources(fronts) {
        JalnoResolver.fronts = fronts;
        const installedModules = {};
        for (const front of fronts) {
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
                for (const regex in regexes) {
                    if (regexes[regex] !== undefined) {
                        let selectedNode;
                        for (const module of regexes[regex]) {
                            if (selectedNode === undefined || module.satisfieses > selectedNode.satisfieses) {
                                selectedNode = module;
                            }
                        }
                        if (JalnoResolver.modules[name] === undefined) {
                            JalnoResolver.modules[name] = {};
                        }
                        JalnoResolver.modules[name][regex] = selectedNode;
                    }
                }
            }
        }
    }
    static setModules(modules) {
        JalnoResolver.modules = modules;
    }
    static setFronts(fronts) {
        JalnoResolver.fronts = fronts;
    }
    static isCommonModule(module) {
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
    static getModules() {
        return JalnoResolver.modules;
    }
    static async lookingForPackage(name, basepath, packagePath) {
        const realpath = packagePath;
        const realPackageManager = await JalnoResolver.getPackage(packagePath);
        let front;
        for (const item of JalnoResolver.fronts) {
            if (basepath.substr(0, item.path.length) === item.path) {
                front = item;
            }
        }
		if (!front) {
			return;
		}
        let packageManager = realPackageManager;
        if (JalnoResolver.modules[name] !== undefined) {
            let modulePackageRegex;
            if (packageManager) {
                if (packageManager.hasOwnProperty("dependencies") && packageManager.dependencies[name] !== undefined) {
                    modulePackageRegex = packageManager.dependencies[name];
                }
            }
            else {
                packageManager = await JalnoResolver.getPackage(path_1.resolve(front.path, "package.json"));
                if (packageManager && packageManager.hasOwnProperty("dependencies")) {
                    if (packageManager.dependencies[name] !== undefined) {
                        modulePackageRegex = packageManager.dependencies[name];
                    }
                }
            }
            let selectedPackage;
            if (modulePackageRegex) {
                if (JalnoResolver.modules[name][modulePackageRegex] !== undefined) {
                    return JalnoResolver.modules[name][modulePackageRegex];
                }
                else {
                    for (const regex in JalnoResolver.modules[name]) {
                        if (JalnoResolver.modules[name][regex] !== undefined) {
                            const satisfies = semver.satisfies(JalnoResolver.modules[name][regex].version, modulePackageRegex);
                            if (satisfies) {
                                return JalnoResolver.modules[name][regex];
                            }
                        }
                    }
                }
            }
            else {
                for (const regex in JalnoResolver.modules[name]) {
                    if (JalnoResolver.modules[name] !== undefined) {
                        const module = JalnoResolver.modules[name][regex];
                        if (selectedPackage === undefined || module.satisfieses > selectedPackage.satisfieses) {
                            selectedPackage = module;
                        }
                    }
                }
                return selectedPackage;
            }
        }
        if (realPackageManager && realPackageManager.hasOwnProperty("dependencies") && realPackageManager.dependencies[name] !== undefined) {
            let newPackageManager;
            let dir = realpath;
            while (dir !== "/") {
                newPackageManager = await JalnoResolver.getPackage(path_1.resolve(dir, name, "package.json"));
                if (newPackageManager) {
                    break;
                }
                else {
                    dir = path_1.resolve(dir, "..");
                }
            }
            if (newPackageManager) {
                if (JalnoResolver.modules[name] === undefined) {
                    JalnoResolver.modules[name] = {};
                }
                const regex = realPackageManager.dependencies[name];
                let main;
                if (newPackageManager.hasOwnProperty("main")) {
                    main = newPackageManager.main;
                }
                else {
                    main = "index.js";
                }
                let moudle;
                for (const key in JalnoResolver.modules[name]) {
                    if (JalnoResolver.modules[name][key] !== undefined) {
                        const satisfies = semver.satisfies(JalnoResolver.modules[name][key].version, regex);
                        if (satisfies) {
                            moudle = JalnoResolver.modules[name][key];
                            break;
                        }
                    }
                }
                if (!moudle) {
                    JalnoResolver.modules[name][regex] = moudle = new Module_1.default(name, newPackageManager.version, main, regex, front);
                }
                return moudle;
            }
        }
    }
    static async getPackage(path) {
        if (await util_1.promisify(fs.exists)(path) &&
            (await util_1.promisify(fs.lstat)(path)).isFile()) {
            return JSON.parse(await util_1.promisify(fs.readFile)(path, "UTF8"));
        }
    }
    async apply(resolver) {
        const target = resolver.ensureHook(this.target);
        resolver
            .getHook(this.source)
            .tapAsync("JalnoResolver", async (request, resolveContext, callback) => {
            let packageName = request.request;
            const splash = packageName.indexOf("/");
            if (splash > -1) {
                packageName = packageName.substr(0, splash);
            }
            const asset = await JalnoResolver.lookingForPackage(packageName, request.path, request.descriptionFilePath);
            if (asset) {
                const newModule = Object.assign({}, request, {
                    directory: false,
                    file: true,
                    path: request.path,
                    query: request.query,
                    request: request.request,
                });
                if (splash < 0) {
                    newModule.request = path_1.resolve(asset.getPath(), asset.main);
                }
                else {
                    newModule.request = path_1.resolve(asset.getPath(), request.request.substr(splash + 1));
                }
                const exists = util_1.promisify(fs.exists);
                const lastSplash = newModule.request.lastIndexOf("/");
                if (lastSplash >= 0) {
                    const filename = newModule.request.substr(lastSplash + 1);
                    const formats = ["ts", "js", "less", "css", "scss", "sass"];
                    const dot = filename.lastIndexOf(".");
                    const ext = dot !== -1 ? filename.substr(dot + 1) : "";
                    if (formats.indexOf(ext) === -1) {
                        for (const format of formats) {
                            if (await exists(newModule.request + "." + format)) {
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
                    newModule.path = path_1.dirname(newModule.request);
                    resolver.doResolve(target, newModule, null, resolveContext, callback);
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
JalnoResolver.fronts = [];
JalnoResolver.modules = {};
exports.default = JalnoResolver;
