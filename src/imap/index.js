const net = require("net");
const config = require("../utils/config");
const IMAPConnection = require("./connection");

class PostOfficeIMAP {

	constructor (options, port = 143) {

		this.port = port;
		this.options = options;
		
		this.server = net.createServer(_ => this.createConnection(_));
		this.server.on("error", err => console.log(err));

	}

	createConnection (socket) {

		return new IMAPConnection(this, socket);

	}

	listen () {

		return new Promise(resolve => {

			this.server.listen(this.port, "0.0.0.0", () => {
				
				console.log(`(imap/info) PostOffice IMAP started on port ${this.port}`);
				resolve();
				
			});
			
		});

	}

}

const ports = new Map();

module.exports = {

	/**
	 * Start PostOfficeIMAP on a specific port (143, 993)
	 * 
	 * @param {number} port Port
	 * @returns {PostOfficeIMAP}
	 */
	start (port) {
	
		const server = new PostOfficeIMAP(config(), port);
		ports.set(port, server);
		return server;
		
	},

	/**
	 * Get PostOfficeIMAP on a specific port (143, 993)
	 * 
	 * @param {number} port Port
	 * @returns {PostOfficeIMAP}
	 */
	get (port) {

		return ports.get(port);

	}

}
