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

		console.log(`Client: ${tag} ${command}`, args);

		if (command === "starttls") {

			this.startTLS(tag);

		} else if (command === "capability") {

			this.send("*", "capability", capabilities.join());
			this.send(tag, "ok", "Capabilities listed.");

		} else if (command === "login") {

			args[0] = args[0].replace(`@${this.server.options.server.host}`, "");
			console.log(args[0]);
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

		}
		
		if (!this.user.username) return;

		if (command === "list") {

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

				const emails = await db.emails.getEmailsInMailbox(mailbox._id);
				const unseen = (await db.emails.filterUnseen(this.user._id, emails)).reverse();

				this.send("*", emails.length + "", "EXISTS");
				this.send("*", emails.filter(_ => imapUtils.isRecent(_.metadata.date)).length + "", "RECENT");
				if (unseen.length) this.send("*", "ok", `[UNSEEN ${unseen[0].sequenceNumber}] Message ${unseen[0].sequenceNumber} is first unseen.`);
				this.send("*", "ok", `[UIDVALIDITY ${imapUtils.generateUID(mailbox._id)}] UIDs valid.`);
				this.send("*", "ok", `[UIDNEXT ${db.emails.nextUid()}] UIDs valid.`);
				this.send("*", "flags", "(\\Answered \\Flagged \\Deleted \\Seen)");
				this.send(tag, "ok", `[${mailbox.attributes.readOnly ? "READ-ONLY" : "READ-WRITE"}] SELECT completed.`);

			} else this.send(tag, "no", "Error: Mailbox does not exist.");

		} else if (command === "examine") {

			const mailbox = db.emails.getUsersMailboxByName(this.user._id, args[0]);
			this.selectedMailbox = mailbox;

			if (mailbox) {

				const emails = await db.emails.getEmailsInMailbox(mailbox._id);
				const unseen = (await db.emails.filterUnseen(this.user._id, emails)).reverse();

				this.send("*", emails.length + "", "EXISTS");
				this.send("*", emails.filter(_ => imapUtils.isRecent(_.metadata.date)).length + "", "RECENT");
				if (unseen.length) this.send("*", "ok", `[UNSEEN ${unseen[0].sequenceNumber}] Message ${unseen[0].sequenceNumber} is first unseen.`);
				this.send("*", "ok", `[UIDVALIDITY ${imapUtils.generateUID(mailbox._id)}] UIDs valid.`);
				this.send("*", "ok", `[UIDNEXT ${db.emails.nextUid()}] Next UID is ${db.emails.nextUid()}.`);
				this.send("*", "flags", "(\\Answered \\Flagged \\Deleted \\Seen)");
				this.send(tag, "ok", `[READ-ONLY] SELECT completed.`);

			} else this.send(tag, "no", "Error: Mailbox does not exist.");

		} else if (command === "uid") {

			if (args[0] === "fetch") {

				const emails = imapUtils.sliceFromUID(await db.emails.getEmailsInMailbox(this.selectedMailbox._id), args[1]);

				for (const email of emails) {

					const _ = type => {

						type = type.toLowerCase();

						if (type === "uid") {

							return `UID ${email.uid}`;

						} else if (type === "flags") {

							return `FLAGS (${(db.emails.isSeen(this.user._id, email._id)) ? "\\Seen" : ""})`;

						} else if (type === "rfc822.size") {

							return `RFC822.SIZE ${fs.statSync(email.emailPath).size}`;

						} else if (type === "rfc822.header" || type === "body.peek[header]") {

							return `RFC822.HEADER ()`;

						}

					}
					
					console.log(args[2].map(__ => _(__)))
					this.send("*", email.sequenceNumber + "", `FETCH (${(args[2].map(__ => _(__))).join(" ")} UID ${email.uid})`);

				}

				this.send(tag, "ok", "UID FETCH completed.");

			}

		}

	}

	send (tag, command, args) {

		console.log(`Server: ${tag} ${command}`, args);
		const message = `${tag ? tag : "*"} ${command.toUpperCase()} ${args}`
		this.socket.write(`${message}\r\n`);

	}

}
