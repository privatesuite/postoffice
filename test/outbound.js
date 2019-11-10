const nodemailer = require("nodemailer");

// (async () => {

// 	process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

// 	const transport = nodemailer.createTransport({
	
// 		host: "snitchbcc.com",
// 		port: 587,
// 		auth: {

// 			user: "admin",
// 			pass: "i444cdr7i1j"

// 		}

// 	});

// 	await transport.sendMail({

// 		from: "admin@snitchbcc.com",
// 		to: "aurame@privatesuitemag.com",
// 		subject: "Testing",
// 		text: "hello world!"

// 	});

// })();

(async () => {

	process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

	const transport = nodemailer.createTransport({
	
		host: "snitchbcc.com",
		port: 587,
		auth: {

			user: "admin",
			pass: "i444cdr7i1j"

		}

	});

	await transport.sendMail({

		from: "admin@snitchbcc.com",
		to: "aurame@privatesuitemag.com, coolcorpstudios@gmail.com",
		subject: "Testing",
		text: "hello world!"

	});

})();
