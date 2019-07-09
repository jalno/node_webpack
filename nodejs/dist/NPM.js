"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const npm_programmatic_1 = require("npm-programmatic");
class NPM {
    static install(packages, options = {}) {
        if (typeof packages === "string") {
            return NPM.install([packages], options);
        }
        return npm_programmatic_1.default.install(packages, options);
    }
    static uninstall(packages, options = {}) {
        if (typeof packages === "string") {
            return NPM.install([packages], options);
        }
        return npm_programmatic_1.default.uninstall(packages, options);
    }
    static list(path) {
        return npm_programmatic_1.default.list(path);
    }
}
exports.default = NPM;
