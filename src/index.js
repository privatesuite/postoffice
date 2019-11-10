const db = require("./db");
const args = require("minimist")(process.argv.slice(2));
const path = require("path");
const smtp = require("./smtp");
const config = require("./utils/config");

(async () => {

	if (args.dev) process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

	await db.db.init();
	config.loadConfig(path.join(__dirname, "..", "config", args.config || "dev" + ".conf"))

	if (!db.users.getUserByUsername("admin")) {

		const password = Math.random().toString(36).replace("0.", "");
	
		await db.users.createUser("admin", db.users.hashPassword(password), {
	
			name: "admin",
			type: "admin"
	
		});
	
		console.log(`(db/info) Created "admin" user with password "${password}".`);
	
	}

	const s = [];
	const ports = !Array.isArray(config().smtp.port) ? [config().smtp.port] : config().smtp.port;

	for (const port of ports) {
		
		s.push(smtp.start(port));

	}

	await Promise.all(s.map(_ => _.listen()));

})();
