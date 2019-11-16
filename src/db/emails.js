const config = require("../utils/config");
const Streamlet = require("streamletdb");

module.exports =

/**
 * 
 * @param {Streamlet} db 
 */
function (db) {

	const users = require("./users");

	return {

		getUidCounter () {

			return db.findOne(_ => _.type === "uid_counter");

		},

		newUid () {

			let a = 1;
			if (this.getUidCounter()) a = this.getUidCounter().value + 1;

			this.setUidCounter(a);
			return a;

		},

		/**
		 * Set the UID counter to a value
		 * 
		 * @param {string} value The current UID
		 */
		async setUidCounter (value) {

			if (this.getUidCounter()) await db.delete(this.getUidCounter()._id);

			db.insert({

				type: "uid_counter",
				value: value.padStart(32, "0")

			});

		},

		allMailboxes () {

			return db.find(_ => _.type === "mailbox");

		},

		allEmails () {

			return db.find(_ => _.type === "email");

		},

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
		 * @param {string} mailbox The mailbox's id
		 */
		getMailbox (mailbox) {

			return db.findById(mailbox);

		},

		/**
		 * Deletes a mailbox.
		 * 
		 * @param {string} mailbox The mailbox's id
		 */
		deleteMailbox (mailbox) {

			return db.delete(mailbox);
		
		},

		/**
		 * Get mailboxes that contain a specific user.
		 * 
		 * @param {string} user The user's id
		 */
		getMailboxesWithUser (user) {

			return this.allMailboxes(_ => _.users.indexOf(user) !== -1);

		},

		/**
		 * Get a mailbox owned by a specific user by name.
		 * 
		 * @param {string} user The user's id
		 * @param {string} name The mailbox's name
		 */
		getUsersMailboxByName (user, name) {

			return this.getMailboxesWithUser(user).find(_ => _.name.toLowerCase() === name.toLowerCase());

		},

		/**
		 * Get the appropriate mailboxes from an envelope.
		 * 
		 * @param {{mailFrom: object, rcptTo: object[]}} envelope 
		 */
		getMailboxesFromEnvelope (envelope) {

			const d = envelope.rcptTo.map(_ => _.address).filter(_ => _.endsWith(`@${config().server.host}`)).map(_ => this.getUsersMailboxByName(users(db).getUserByUsername(_.replace(`@${config().server.host}`, ""))._id, "Inbox")._id);

			if (envelope.mailFrom.address.endsWith(`@${config().server.host}`)) d.push(this.getUsersMailboxByName(users(db).getUserByUsername(envelope.mailFrom.address.replace(`@${config().server.host}`, ""))._id, "Sent")._id);

			return d;

		},

		/**
		 * Add an email to the database.
		 * 
		 * @param {{mailFrom: object, rcptTo: object[]}} envelope The email's envelope
		 * @param {string} messageId The email's messageId
		 * @param {string} emailPath The email's raw MIME-formatted data's file path
		 * @param {string[]} mailboxes The ids of the mailboxes the email is in
		 * @param {{remoteAddress: string, clientHostname: string, received: Date}} metadata The email's metadata (origin IP, and reverse resolved hostname, received date)
		 * @param {*} tags The email's tags
		 */
		createEmail (envelope, messageId, emailPath, mailboxes, metadata, tags = []) {

			return db.insert({

				type: "email",
				envelope,
				messageId,
				emailPath,
				mailboxes,
				metadata,
				tags,

				uid: this.newUid()

			});

		},

		getEmailsInMailbox (mailbox) {

			return this.allEmails().filter(_ => _.type === "email" && _.mailboxes.indexOf(mailbox) !== -1).map((_, i) => ({

				..._,
				sequenceNumber: i + 1

			}));

		},

		seeEmail (user, email) {

			return db.insert({

				type: "seen",
				user,
				email

			});

		},

		isSeen (user, email) {

			return db.findOne(_ => _.type === "seen" && _.user === user && _.email === email);

		},

		async unseeEmail (user, email) {

			return db.delete((await this.isSeen(user, email))._id);

		},

		filterUnseen (user, emails) {

			return emails.filter(_ => this.isSeen(user, _._id));

		}

	}

}
