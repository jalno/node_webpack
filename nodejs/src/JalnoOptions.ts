import * as child_process from "child_process";
import * as path from "path";

interface IJalnoLoaderOptions {
	php?: string;
	defaultOptions?: {
		[key: string]: any;
	};
}
export default class JalnoOptions {
	public static load(options?: IJalnoLoaderOptions): Promise<JalnoOptions> {
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
				} catch (e) {}
				resolve(jalnoOptions);
			});
		});
	}
	public availableLangs: string[];
	private constructor() {
	}
}
