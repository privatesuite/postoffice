const sha512 = require("js-sha512");

module.exports = {

	generateUID (string) {

		return sha512.sha512.array(string).join("").slice(0, 32);

	},

	slice (arr, pattern) {

		const a = pattern.split(":")[0];
		const b = pattern.split(":")[1];

		return arr.slice(parseInt(a) - 1, b === "*" ? undefined : parseInt(b));

	},

	sliceFromUID (arr, pattern) {

		const a = pattern.split(":")[0];
		const b = pattern.split(":")[1];

		return arr.filter(_ => parseInt(_.uid) >= a && parseInt(_.uid) <= (b === "*" ? (parseInt(_.uid) + 10000000000000000) : b));

	},

	isRecent (then, now = Date.now()) {

		console.log(then);
		return (now - then) < (8.64e+7 * 2);

	}

}
