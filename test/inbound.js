const nodemailer = require("nodemailer");

(async () => {

	process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

	const transport = nodemailer.createTransport({
	
		host: "localhost",
		port: 587,
		auth: {

			user: "admin",
			pass: "i444cdr7i1j"

		}

	});

	await transport.sendMail({

		from: "admin@localhost",
		to: "admin@localhost",
		subject: "Testing",
		text: "hello world!"

	});

})();
