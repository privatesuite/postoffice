const db = require("../db");
const config = require("../utils/config");
const SMTPServer = require("smtp-server");
const mailparser = require("mailparser");
const isPortReachable = require("is-port-reachable");

class PostOfficeSMTP {

	constructor (options, port = 25) {

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
				
				// console.log(`Authentication for user ${auth.username} requested`);
				
				// if (!(session.secure || !this.options.tlsRequired)) {
					
				// 	t.error(`Non-fatal: Client attempted to connect in violation of "tlsRequired".`);
					
				// }
				
				const loggedIn = db.users.login(auth.username, auth.password);
				
				if (loggedIn) {
					
					callback(null, {
						
						user: loggedIn.username
						
					});
					
				} else {
					
					callback(new Error("Invalid username or password."));
					
				}
				
			},
			
			onConnect (session, callback) {
				
				callback(null);
				
			},
			
			onRcptTo (address, session, callback) {
				
				if (address.address.endsWith(`@${options.server.host}`)) {
					
					if (!t.userExists(address.address.replace(`@${options.server.host}`, ""))) {
						
						callback(new Error("Recipient does not exist"));
						return;
						
					} else {
						
						callback(null);
						return;
						
					}
					
				}
				
			},
			
			onMailFrom (address, session, callback) {
				
				callback();
				
			},
			
			onData (stream, session, callback) {
				
				
				
			}
			
		});

	}

	listen () {

		return new Promise(resolve => {
			
			this.server.listen(this.port, "0.0.0.0", () => {
				
				console.log(`Listening on port ${this.port}`);
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
