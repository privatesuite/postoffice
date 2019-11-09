const db = require("./db");

(async () => {

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
