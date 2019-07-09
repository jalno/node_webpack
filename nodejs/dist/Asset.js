"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Asset {
    constructor(_name, _version, _front) {
        this._name = _name;
        this._version = _version;
        this._front = _front;
    }
    get name() {
        return this._name;
    }
    get version() {
        return this._version;
    }
    get front() {
        return this._front;
    }
}
exports.default = Asset;
