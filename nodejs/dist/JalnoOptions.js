"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process = require("child_process");
const path = require("path");
class JalnoOptions {
    constructor() {
    }
    static load(options) {
        if (options === undefined) {
            options = {};
        }
        if (options.php === undefined) {
            options.php = "php";
        }
        return new Promise((resolve, reject) => {
            const jalnoOptions = new JalnoOptions();
            const jalno = child_process.exec(`${options.php} index.php --process=packages/node_webpack/processes/GetJalnoOptions@getAvailableLangs`, {
                cwd: path.resolve(__dirname, "..", "..", "..", "..", ".."),
            });
            jalno.stdout.on("data", (data) => {
                try {
                    jalnoOptions.availableLangs = JSON.parse(data);
                }
                catch (e) { }
                resolve(jalnoOptions);
            });
        });
    }
}
exports.default = JalnoOptions;
