const db = require("../db");
const fs = require("fs");
const net = require("net");
const tls = require("tls");
const path = require("path");
const imapUtils = require("../utils/imap");
const imapParser = require("imap-parser");

const capabilities = ["IMAP4rev1", "SASL-IR", "STARTTLS"];

module.exports = class IMAPConnection {

	/**
	 * Create an IMAPConnection
	 * 
	 * @param {PostOfficeIMAP} server The PostOfficeIMAP associated with this connection
	 * @param {net.Socket} socket The connection's socket
	 */
	constructor (server, socket) {

		this.server = server;
		this.socket = socket;
		this.socket.on("error", err => console.log(err));

		this.parser = new imapParser();
		this.parser.on("data", _ => this.onLine(_));
		this.send(null, "ok", "PostOffice IMAP greets you!");

		this.socket.pipe(this.parser);

		this.user = {};
		this.selectedMailbox = {};

	}

	startTLS (tag) {

		const certs = {

			ca: this.server.options.imap.caPath ? fs.readFileSync(path.join(__dirname, "..", "..", this.server.options.imap.caPath)) : undefined,
			key: this.server.options.imap.keyPath ? fs.readFileSync(path.join(__dirname, "..", "..", this.server.options.imap.keyPath)) : undefined,
			cert: this.server.options.imap.certPath ? fs.readFileSync(path.join(__dirname, "..", "..", this.server.options.imap.certPath)) : undefined,

		}

		this.send(tag, "ok", "Begin TLS negotiation now.");

		this.socket.removeAllListeners("data");
		this.socket.removeAllListeners("error");

		this.socket.unpipe(this.parser);

		this.socket = new tls.TLSSocket(this.socket, {
			
			secureContext: tls.createSecureContext({

				...certs,

			}),

			rejectUnauthorized: false,
			isServer: true
			
		}, true, true, false);

		this.socket.on("secure", () => {

			console.log("STARTTLS Complete!");

			this.socket.pipe(this.parser);

		});

	}

	async onLine (line) {

		console.log(line);

		const tag = line[0];
		const command = (line[1] || "").toLowerCase();
		const args = line.slice(2);

		console.log(tag, command, args);

		if (command === "starttls") {

			this.startTLS(tag);

		} else if (command === "capability") {

			this.send(null, "capability", capabilities.join());
			this.send(tag, "ok", "Capabilities listed.");

		} else if (command === "login") {

			const login = db.users.login(args[0], args[1]);
			if (login) {

				this.send(tag, "ok", "Logged in.");
				this.user = await db.users.getUserByUsername(args[0]);

			} else {

				this.send(tag, "no", "[AUTHENTICATIONFAILED] Invalid username or password.");

			}

		} else if (command === "logout") {

			this.send("*", "bye", "Logging out.");
			this.send(tag, "ok", "Logout completed.");

		} else if (command === "list") {

			const mailboxes = db.emails.getMailboxesWithUser(this.user._id);

			this.send("*", "list", `(\\HasNoChildren) "." "INBOX"`);

			for (const mailbox of mailboxes) {

				if (mailbox.name.toLowerCase() !== "inbox") {

					this.send("*", "list", `(\\HasNoChildren) "." "${mailbox.name}"`);

				}

			}

			this.send(tag, "ok", "LIST completed.");

		} else if (command === "lsub") {

			const mailboxes = db.emails.getMailboxesWithUser(this.user._id);

			this.send("*", "list", `(\\HasNoChildren) "." "INBOX"`);

			for (const mailbox of mailboxes) {

				if (mailbox.name.toLowerCase() !== "inbox") {

					this.send("*", "lsub", `(\\HasNoChildren) "." "${mailbox.name}"`);

				}

			}

			this.send(tag, "ok", "LSUB completed.");

		} else if (command === "select") {

			const mailbox = db.emails.getUsersMailboxByName(this.user._id, args[0]);
			this.selectedMailbox = mailbox;

			if (mailbox) {

				const emails = await db.emails.getEmailsInMailbox(db.emails.getUsersMailboxByName(this.user._id, args[0]));
				const unseen = (await db.emails.filterUnseen(this.user._id, emails)).reverse();

				console.log(emails);
				console.log(unseen);

				this.send("*", emails.length + "", "EXISTS");
				this.send("*", emails.filter(_ => Date.now() - _.metadata.date < 8.64e+7 * 2).length + "", "RECENT");
				if (unseen.length) this.send("*", "ok", `[UNSEEN ${unseen[0].sequenceNumber}] Message ${unseen[0].sequenceNumber} is first unseen.`);
				this.send("*", "ok", `[UIDVALIDITY ${imapUtils.generateUID(mailbox._id)}] UIDs valid.`);
				this.send("*", "flags", "(\\Answered \\Flagged \\Deleted \\Seen)");
				this.send(tag, "ok", `[${mailbox.attributes.readOnly ? "READ-ONLY" : "READ-WRITE"}] SELECT completed.`);
				console.log(`SELECT for ${mailbox.name} complete!`);

			} else this.send(tag, "no", "Error: Mailbox does not exist.");

		} else if (command === "examine") {

			const mailbox = db.emails.getUsersMailboxByName(this.user._id, args[0]);
			this.selectedMailbox = mailbox;

			if (mailbox) {

				const emails = await db.emails.getEmailsInMailbox(db.emails.getUsersMailboxByName(this.user._id, args[0]));
				const unseen = (await db.emails.filterUnseen(this.user._id, emails)).reverse();

				this.send("*", emails.length + "", "EXISTS");
				this.send("*", emails.find(_ => Date.now() - _.metadata.date < 8.64e+7 * 2).length + "", "RECENT");
				this.send("*", "ok", `[UNSEEN ${unseen[0].sequenceNumber}] Message ${unseen[0].sequenceNumber} is first unseen.`);
				this.send("*", "ok", `[UIDVALIDITY ${imapUtils.generateUID(mailbox._id)}] UIDs valid.`);
				this.send("*", "flags", "(\\Answered \\Flagged \\Deleted \\Seen)");
				this.send(tag, "ok", `[${mailbox.attributes.readOnly ? "READ-ONLY" : "READ-WRITE"}] SELECT completed.`);

			} else this.send(tag, "no", "Error: Mailbox does not exist.")

		}

	}

	send (tag, command, args) {

		const message = `${tag ? tag : "*"} ${command.toUpperCase()} ${args}`
		this.socket.write(`${message}\r\n`);

	}

}
