import * as fs from "fs";
import { dirname, resolve } from "path";
import * as semver from "semver";
import { promisify } from "util";
import Front from "./Front";
import Main from "./Main";
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

export interface IModules {
	[key: string]: {
		[regex: string]: Module;
	};
}

export default class JalnoResolver {
	public static commonFiles = {};
	public static async initSources(fronts: Front[]) {
		JalnoResolver.fronts = fronts;
		const installedModules: {
			[key: string]: Module[];
		} = {};
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
				const regexes: {
					[key: string]: Module[],
				} = {};
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
						let selectedNode: Module;
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
	public static setModules(modules: IModules) {
		JalnoResolver.modules = modules;
	}
	public static setFronts(fronts: Front[]) {
		JalnoResolver.fronts = fronts;
	}
	public static isCommonModule(module: any) {
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
	private static fronts: Front[] = [];
	private static modules: IModules = {};
	private static async lookingForPackage(name: string, basepath: string, packagePath: string): Promise<Module> {
		const realpath = packagePath;
		const realPackageManager = await JalnoResolver.getPackage(packagePath);
		let front: Front;
		for (const item of JalnoResolver.fronts) {
			if (basepath.substr(0, item.path.length) === item.path) {
				front = item;
			}
		}
		let packageManager = realPackageManager;
		if (JalnoResolver.modules[name] !== undefined) {
			let modulePackageRegex;
			if (packageManager && packageManager.hasOwnProperty("dependencies")) {
				if (packageManager.dependencies[name] !== undefined) {
					modulePackageRegex = packageManager.dependencies[name];
				}
			}
			if (! modulePackageRegex) {
				packageManager = await JalnoResolver.getPackage(resolve(front.path, "package.json"));
				if (packageManager && packageManager.hasOwnProperty("dependencies")) {
					if (packageManager.dependencies[name] !== undefined) {
						modulePackageRegex = packageManager.dependencies[name];
					}
				}
			}
			let selectedPackage: Module;
			if (modulePackageRegex) {
				if (JalnoResolver.modules[name][modulePackageRegex] !== undefined) {
					return JalnoResolver.modules[name][modulePackageRegex];
				} else {
					for (const regex in JalnoResolver.modules[name]) {
						if (JalnoResolver.modules[name][regex] !== undefined) {
							const satisfies = semver.satisfies(JalnoResolver.modules[name][regex].version, modulePackageRegex);
							if (satisfies) {
								return JalnoResolver.modules[name][regex];
							}
						}
					}
				}
			} else {
				packageManager = await JalnoResolver.getPackage(resolve(front.path, "node_modules", name, "package.json"));
				for (const regex in JalnoResolver.modules[name]) {
					if (JalnoResolver.modules[name] !== undefined) {
						const module = JalnoResolver.modules[name][regex];
						if (packageManager && packageManager.version) {
							const satisfies = semver.satisfies(packageManager.version, regex);
							if (satisfies) {
								return module;
							}
						} else if (selectedPackage === undefined || semver.gt(module.version, selectedPackage.version)) {
							selectedPackage = module;
						}
					}
				}
				return selectedPackage;
			}
		}
		if (realPackageManager && realPackageManager.dependencies[name] !== undefined) {
			let newPackageManager;
			let dir = realpath;
			while (dir !== "/") {
				newPackageManager = await JalnoResolver.getPackage(resolve(dir, name, "package.json"));
				if (newPackageManager) {
					break;
				} else {
					dir = resolve(dir, "..");
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
				} else {
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
				if (! moudle) {
					JalnoResolver.modules[name][regex] = moudle = new Module(name, newPackageManager.version, main, regex, front);
				}
				await Main.updateJalnoMoudles(JalnoResolver.modules);
				return moudle;
			}
		}
	}
	private static async getPackage(path: string): Promise<any> {
		if (
			await promisify(fs.exists)(path) &&
			(await promisify(fs.lstat)(path)).isFile()
		) {
			return JSON.parse(await promisify(fs.readFile)(path, "UTF8"));
		}
	}

	public constructor(private source, private target) {}
	public async apply(resolver: any /*EnhancedResolve.IResolver*/) {
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
				const newModule: EnhancedResolve.IModule = Object.assign({}, request, {
					directory: false,
					file: true,
					path: request.path,
					query: request.query,
					request: request.request,
				});
				if (splash < 0) {
					newModule.request = resolve(asset.getPath(), asset.main);
				} else {
					newModule.request = resolve(asset.getPath(), request.request.substr(splash + 1));
				}
				const exists = promisify(fs.exists);
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
						if (! JalnoResolver.commonFiles.hasOwnProperty(newModule.request)) {
							JalnoResolver.commonFiles[newModule.request] = [];
						}
						if (JalnoResolver.commonFiles[newModule.request].indexOf(matches[1]) < 0) {
							JalnoResolver.commonFiles[newModule.request].push(matches[1]);
						}
					}
					newModule.path = dirname(newModule.request);
					/*resolver.hooks.result.callAsync(newModule, resolveContext, (err) => {
						if (err) {
							return callback(err);
						}
						callback(null, newModule);
					}); */
					resolver.doResolve(target, newModule, null, resolveContext, callback)
				} else {
					callback();
				}
			} else {
				callback();
			}
		});
	}
}
