import * as fs from "fs";
import * as path from "path";
import * as semver from "semver";
import { promisify } from "util";
import Front from "./Front";
import Module from "./Module";

// tslint:disable-next-line:no-namespace
export namespace EnhancedResolve {
	export interface IModule {
		request: string;
		path: string;
		query: string;
		directory: boolean;
	}
	export interface IResolver {
		plugin(name: "module", handler: (obj: IModule, callback: () => void) => void): void;
	}
}

interface INodeCache {
	regex: string;
	module: Module;
}
export interface IModules {
	[key: string]: INodeCache[];
}

export default class JalnoResolver {
	public static commonFiles = {};
	public static async initSources(sources: Front[]) {
		const installedModules: {
			[key: string]: Module[];
		} = {};
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
				let selectedNode: Module;
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
	}
	public static setModules(modules: IModules) {
		JalnoResolver.modules = modules;
	}
	public static IsCommonModule(module: any) {
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
		if (
			found &&
			JalnoResolver.commonFiles.hasOwnProperty(userRequest) &&
			JalnoResolver.commonFiles[userRequest].length > 1
		) {
			return true;
		}
		return false;
	}
	public static getModules(): IModules {
		return JalnoResolver.modules;
	}
	private static source;
	private static target;
	private static modules: IModules = {};
	private static async lookingForPackage(name: string, basepath: string): Promise<Module> {
		const p = `${basepath}/node_modules/${name}/package.json`;
		if (
			await promisify(fs.exists)(p) &&
			(await promisify(fs.lstat)(p)).isFile()
		) {
			const nodePackage = JSON.parse(await promisify(fs.readFile)(p, "UTF8"));
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

	public constructor(private source, private target) {}
	public async apply(resolver: any /*EnhancedResolve.IResolver*/) {
		resolver.plugin(this.source, async (module, callback) => {
			let packageName = module.request;
			const splash = packageName.indexOf("/");
			if (splash > -1) {
				packageName = packageName.substr(0, splash);
			}
			const asset = await JalnoResolver.lookingForPackage(packageName, module.path);
			if (asset) {
				const newModule: EnhancedResolve.IModule = {
					directory: false,
					path: module.path,
					query: module.query,
					request: module.request,
				};
				if (splash < 0) {
					newModule.request = path.resolve(asset.getPath(), asset.main);
				} else {
					newModule.request = path.resolve(asset.getPath(), module.request.substr(splash + 1));
				}
				const exists = promisify(fs.exists);
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
				} else {
					callback();
				}
			} else {
				callback();
			}
		});
	}
}
