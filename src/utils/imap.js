const sha512 = require("js-sha512");

module.exports = {

	generateUID (string) {

		return sha512.sha512.array(string).join("").slice(0, 32);

	}

}
