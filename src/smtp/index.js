const db = require("../db");
const fs = require("fs");
const path = require("path");
const config = require("../utils/config");
const SMTPServer = require("smtp-server").SMTPServer;
const mailparser = require("mailparser");
const isPortReachable = require("is-port-reachable");

class PostOfficeSMTP {

	constructor (options, port = 25) {

		const _this = this;

		this.port = port;
		this.options = options;

		this.server = new SMTPServer({
			
			// secure: this.options.secure,
			name: _this.options.host,
			
			authOptional: true,
			
			ca: options.smtp.caPath ? fs.readFileSync(path.join(__dirname, "..", "..", options.smtp.caPath)) : undefined,
			key: options.smtp.keyPath ? fs.readFileSync(path.join(__dirname, "..", "..", options.smtp.keyPath)) : undefined,
			cert: options.smtp.certPath ? fs.readFileSync(path.join(__dirname, "..", "..", options.smtp.certPath)) : undefined,
			
			banner: "PostOffice SMTP Server",
			
			onAuth (auth, session, callback) {
				
				const loggedIn = db.users.login(auth.username, auth.password);
				
				if (loggedIn) {
					
					callback(null, {
						
						user: loggedIn.username
						
					});
					
				} else {
					
					callback(new Error("Invalid credentials"));
					
				}
				
			},
			
			onConnect (session, callback) {
				
				callback(null);
				
			},
			
			onRcptTo (address, session, callback) {
				
				if (address.address.endsWith(`@${options.server.host}`)) {
					
					if (!db.users.getUserByUsername(address.address.replace(`@${options.server.host}`, ""))) {
						
						callback(new Error("Recipient does not exist"));
						return;
						
					} else {
						
						callback(null);
						return;
						
					}
					
				}
				
			},
			
			onMailFrom (address, session, callback) {
				
				if (address.address.endsWith(`@${options.server.host}`)) {
					
					if (!session.user) callback(new Error("Authentication required"));
					else callback();

				}
				
			},
			
			onData (stream, session, callback) {
				
				if (session.envelope.mailFrom.address.endsWith(`@${options.server.host}`) && !session.user) {

					callback(new Error("Authentication required"));
					return;

				}

				const emailChunks = [];
				stream.on("data", chunk => {
			
					emailChunks.push(chunk);
			
				});
				
				stream.on("end", () => {
				
					const email = Buffer.concat(emailChunks);
					db.emails.createEmail(session.envelope, email.toString("utf8"), db.emails.getMailboxesFromEnvelope(session.envelope), {

						remoteAddress: session.remoteAddress,
						clientHostname: session.clientHostname

					});

					callback(null);
				
				});
				
			}
			
		});

		this.server.on("error", err => {

			console.error(err);

		});

	}

	listen () {

		return new Promise(resolve => {
			
			this.server.listen(this.port, "0.0.0.0", () => {
				
				console.log(`(smtp/info) PostOffice SMTP started on port ${this.port}`);
				resolve();
				
			});
			
		});

	}

}

const ports = new Map();

module.exports = {

	/**
	 * Start PostOfficeSMTP on a specific port (25, 465, 587)
	 * 
	 * @param {number} port Port
	 * @returns {PostOfficeSMTP}
	 */
	start (port) {
	
		const server = new PostOfficeSMTP(config(), port);
		ports.set(port, server);
		return server;
		
	},

	/**
	 * Get PostOfficeSMTP on a specific port (25, 465, 587)
	 * 
	 * @param {number} port Port
	 * @returns {PostOfficeSMTP}
	 */
	get (port) {

		return ports.get(port);

	}

}
