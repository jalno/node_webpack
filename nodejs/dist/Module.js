"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Front_1 = require("./Front");
class Module {
    constructor(_name, _version, _main, _regex, _front) {
        this._name = _name;
        this._version = _version;
        this._main = _main;
        this._regex = _regex;
        this._front = _front;
        this.satisfieses = 0;
    }
    static unserialize(data) {
        return new Module(data._name, data._version, data._main, data._regex, Front_1.default.unserialize(data._front));
    }
    getPath() {
        return `${this._front.path}/node_modules/${this._name}`;
    }
    get name() {
        return this._name;
    }
    get version() {
        return this._version;
    }
    get regex() {
        return this._regex;
    }
    get main() {
        return this._main;
    }
    get front() {
        return this._front;
    }
}
exports.default = Module;
