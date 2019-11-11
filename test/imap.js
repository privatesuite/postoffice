const ImapClient = require("emailjs-imap-client").default;

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

const client = new ImapClient("localhost", 143, {

	auth: {
	
		user: "admin",
		pass: "i444cdr7i1j"
	
	},

	requireTLS: true

});

client.connect().then(async () => {

	console.log(await client.listMailboxes())

});
