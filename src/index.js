const db = require("./db");
const args = require("minimist")(process.argv.slice(2));
const smtp = require("./smtp");

(async () => {

	if (args.dev) process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

	await db.db.init();

	if (!db.users.getUserByUsername("admin")) {

		const password = Math.random().toString(36);
	
		db.users.createUser("admin", db.users.hashPassword(password), {
	
			name: "admin",
			type: "admin"
	
		});
	
		console.log(`(+) Created "admin" user with password "${password}".`);
	
	}

})();
