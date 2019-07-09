"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process = require("child_process");
const fs = require("fs");
const path = require("path");
const util_1 = require("util");
const Package_1 = require("./Package");
class Main {
    static async run() {
        await Main.installDependecies();
        const packages = await Main.initPackages();
        const entries = {};
        for (const p of packages) {
            const fronts = await p.getFrontends();
            for (const front of fronts) {
                console.log("Package: ", front.package.name + " and front is: " + front.name);
                await front.initAssets();
                await Main.installAssets(front.path);
            }
        }
    }
    static async initPackages() {
        const packagesPath = path.resolve("../..");
        const files = await util_1.promisify(fs.readdir)(packagesPath, {
            withFileTypes: true,
        });
        const packages = [];
        for (const file of files) {
            const packagepath = packagesPath + "/" + file.name;
            if (file.isDirectory() && await util_1.promisify(fs.exists)(packagepath + "/package.json")) {
                packages.push(new Package_1.default(packagesPath, file.name));
            }
        }
        return packages;
    }
    static async installDependecies() {
        if (!await util_1.promisify(fs.exists)("node_modules/npm")) {
            let npmBin;
            try {
                const out = await util_1.promisify(child_process.exec)("which npm");
                npmBin = out.stdout.trimEnd();
            }
            catch (e) {
                throw new Error("Cannot find npm on this envirement");
            }
            const execFile = await util_1.promisify(child_process.execFile);
            try {
                await execFile(npmBin, ["link", "npm"]);
            }
            catch (e) {
                throw new Error("Cannot find npm in your global repository");
            }
        }
        Main.npm = require("npm");
        console.log("Package: node-webpack");
        await Main.installAssets();
        Main.webpack = require("webpack");
    }
    static async installAssets(where = "") {
        console.log("Try to install assets");
        await new Promise((resolve, reject) => {
            Main.npm.load((err, result) => {
                if (err) {
                    return reject(err);
                }
                resolve(result);
            });
        });
        await new Promise((resolve, reject) => {
            Main.npm.commands.install(where, [], (err, result, result2, result3, result4) => {
                if (err) {
                    return reject(err);
                }
                resolve({
                    result, result2, result3, result4,
                });
            });
        });
    }
}
exports.default = Main;
Main.run();
