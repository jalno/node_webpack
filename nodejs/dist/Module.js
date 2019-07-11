"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Module {
    constructor(_name, _version, _main, _regex, _front) {
        this._name = _name;
        this._version = _version;
        this._main = _main;
        this._regex = _regex;
        this._front = _front;
        this.satisfieses = 0;
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
