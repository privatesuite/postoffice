const path = require("path");
const Streamlet = require("streamletdb");

const db = new Streamlet(path.join(__dirname, "..", "..", "database"));

module.exports = {

	db,
	users: require("./users")(db),
	emails: require("./emails")(db)	

}
