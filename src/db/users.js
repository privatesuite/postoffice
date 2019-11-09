const sha512 = require("js-sha512");
const Streamlet = require("streamlet");

module.exports =

/**
 * 
 * @param {Streamlet} db 
 */
function (db) {

	const emails = require("./emails")(db);
	
	return {

		hashPassword (password) {

			return sha512.sha512(password);

		},

		/**
		 * Create a user
		 * 
		 * @param {string} username User's username
		 * @param {string} password User's **hashed** password
		 * @param {object} details User's details; contains `name` and `type` which is equal to `user` or `admin`
		 */
		async createUser (username, password, details = {

			name: username,
			type: "user"

		}) {
			
			const userId = await db.insert({

				type: "user",
				username,
				password,
				
				details

			});

			emails.createMailbox("Inbox", [userId], ["important"], ["immutable", "virtual"]);
			emails.createMailbox("Outbox", [userId], ["important"], ["immutable", "virtual"]);
			emails.createMailbox("Sent", [userId], ["important"], ["immutable", "virtual"]);
			
			emails.createMailbox("Archive", [userId], [], ["immutable", "virtual"]);
			emails.createMailbox("Spam", [userId], [], ["immutable", "virtual"]);
			emails.createMailbox("Trash", [userId], [], ["immutable", "virtual"]);

			return userId;

		},

		/**
		 * Get all users.
		 */
		allUsers () {

			return db.find(_ => _.type === "user");

		},

		/**
		 * Get a user.
		 * 
		 * @param {string} id The user's id
		 */
		getUser (id) {

			return db.findById(id);

		},

		/**
		 * Get a user by username.
		 * 
		 * @param {string} username The user's username
		 */
		getUserByUsername (username) {

			return this.allUsers().find(_ => _.username === username);

		},

		/**
		 * Login a user with a username and unhashed password.
		 * 
		 * @param {string} username The user's username
		 * @param {string} password The user's unhashed password
		 */
		login (username, password) {

			return this.allUsers().find(_ => _.username === username && _.password === this.hashPassword(password));

		}

	}

}
