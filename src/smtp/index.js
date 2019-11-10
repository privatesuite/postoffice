const db = require("../db");
const fs = require("fs");
const path = require("path");
const config = require("../utils/config");
const smtpUtils = require("../utils/smtp");
const SMTPServer = require("smtp-server").SMTPServer;
const nodemailer = require("nodemailer");
const mailparser = require("mailparser");
const isPortReachable = require("is-port-reachable");

const smtpPorts = [587, 465, 25];

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
					
				} else if (!session.user) callback(new Error("Invalid recipient"));
				else callback(null);

			},
			
			onMailFrom (address, session, callback) {
				
				if (address.address.endsWith(`@${options.server.host}`)) {
					
					if (!session.user) callback(new Error("Authentication required"));
					if (`${session.user}@${options.server.host}` !== address.address) return callback(new Error("Invalid sender"));

					callback(null);

				} else callback(null);
				
			},
			
			onData (stream, session, callback) {
				
				if (session.envelope.mailFrom.address.endsWith(`@${options.server.host}`) && !session.user) return callback(new Error("Authentication required"));
				if (session.user && `${session.user}@${options.server.host}` !== session.envelope.mailFrom.address) return callback(new Error("Invalid sender"));

				const emailPath = path.join(__dirname, "..", "..", "mail", `${Math.random().toString(36).replace("0.", "")}.eml`);

				console.log(`(smtp/info) Received email from "${session.envelope.mailFrom.address}" - storing...`);

				stream.pipe(fs.createWriteStream(emailPath)).on("close", async () => {

					console.log(`(smtp/info) Successfully stored email from "${session.envelope.mailFrom.address}"!`);

					db.emails.createEmail(session.envelope, (await mailparser.simpleParser(fs.createReadStream(emailPath))).messageId, emailPath, db.emails.getMailboxesFromEnvelope(session.envelope), {

						remoteAddress: session.remoteAddress,
						clientHostname: session.clientHostname
	
					});
					await _this.sendEmail({
	
						to: session.envelope.rcptTo.map(_ => _.address),
						from: session.envelope.mailFrom.address
	
					}, emailPath);

					callback(null);

				});

				// const emailChunks = [];
				// stream.on("data", chunk => {
			
				// 	emailChunks.push(chunk);
			
				// });
				
				// stream.on("end", async () => {
				
				// 	const email = Buffer.concat(emailChunks);
					// db.emails.createEmail(session.envelope, email.toString("utf8"), db.emails.getMailboxesFromEnvelope(session.envelope), {

					// 	remoteAddress: session.remoteAddress,
					// 	clientHostname: session.clientHostname

					// });
					// await _this.sendEmail({

					// 	to: session.envelope.rcptTo.map(_ => _.address),
					// 	from: session.envelope.mailFrom.address

					// }, email.toString("utf8"));

				// 	callback(null);
				
				// });
				
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

	/**
	 * Send an email
	 * 
	 * @param {{from: string, to: string[]}} envelope The message's envelope
	 * @param {string} emailPath The message's raw data file path
	 */
	async sendEmail (envelope, emailPath) {

		const mx = new Map();
		const mxPort = new Map();
		const to = [...envelope.to];
		const mail = [];

		for (const recipient of to) {

			const domain = recipient.split("@")[1];

			if (domain === this.options.server.host) continue;

			if (!mx.has(domain)) {

				let mxd = await smtpUtils.mx(domain);
				if (!mxd || domain === this.options.host) continue;
				mx.set(domain, mxd);

				const p = [];
				for (const port of smtpPorts) {
					
					p.push(await isPortReachable(port, {

						host: mxd[0].exchange
	
					}));

				}
				await Promise.all(p);
				mxPort.set(domain, (p.map((_, __) => [_, smtpPorts[__]]).find(_ => _[0]) || [])[1]);

			}

			console.log(`(smtp/info) Sending email to ${mx.get(domain)[0].exchange}:${mxPort.get(domain)}...`)

			const transport = nodemailer.createTransport({
				
				host: mx.get(domain)[0].exchange,
				port: mxPort.get(domain),
	
				name: this.options.server.host,
				secure: mxPort.get(domain) !== 25
				
			});

			try {
			mail.push(transport.sendMail({
				
				envelope: {

					to: envelope.to.filter(_ => _.endsWith(`@${domain}`)),
					from: envelope.from

				},
				raw: {

					path: emailPath

				}
				
			}));
			} catch (e) {console.error(e);} 

		}

		return Promise.all(mail.map(_ => _.catch(__ => __)));

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
