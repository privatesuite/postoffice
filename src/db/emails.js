const Streamlet = require("streamlet");

module.exports =

/**
 * 
 * @param {Streamlet} db 
 */
function (db) {

	return {

		/**
		 * Creates a mailbox.
		 * 
		 * @param {string} name The mailbox's name
		 * @param {string[]} users The ids of the users that are included in the mailbox
		 * @param {string[]} tags The mailbox's tags
		 * @param {string[]} attributes The mailbox's attributes. Such attributes include `immutable`, which prevents the mailbox from being modified by external sources and `virtual`, which denotes mailboxes that are created by PostOffice.
		 */
		createMailbox (name, users, tags = [], attributes = []) {

			return db.insert({

				type: "mailbox",
				name,
				users,
				tags,
				attributes

			});

		},

		/**
		 * Gets a mailbox.
		 * 
		 * @param {string} id The mailbox's id
		 */
		getMailbox (id) {



		},

		/**
		 * Deletes a mailbox.
		 * 
		 * @param {string} id The mailbox's id
		 */
		deleteMailbox (id) {

			return db.delete(id);
		
		},

		/**
		 * Get mailboxes that contain a specific user.
		 * 
		 * @param {string} id The user's id
		 */
		getMailboxesWithUser (id) {

			return db.find(_ => _.users.indexOf(id) !== -1);

		},

		/**
		 * Add an email to the database.
		 * 
		 * @param {{from: string, to: string[]}} envelope The email's envelope
		 * @param {*} raw The email's raw MIME-formatted data
		 * @param {*} mailboxes The mailboxes the email is in
		 * @param {*} tags The email's tags
		 */
		createEmail (envelope, raw, mailboxes, tags) {

			

		},

		addEmailToMailbox () {
			
			

		},

		removeEmailFromMailbox () {



		}

	}

}
