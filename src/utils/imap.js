const sha512 = require("js-sha512");

module.exports = {

	generateUID (string) {

		return sha512.sha512.array(string).join("").slice(0, 32);

	},

	slice (arr, pattern) {

		const a = pattern.split(":")[0];
		const b = pattern.split(":")[1];

		return arr.slice(parseInt(a) - 1, b === "*" ? undefined : parseInt(b));

	}

}
