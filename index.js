const fs = require("fs");

const Server = require("./src/server");

const server = new Server({
	httpsOpts: {
		key: fs.readFileSync("key.pem"),
		cert: fs.readFileSync("cert.pem")
	}
});

const port = 5000;
server.listen(port);
console.log("Server running (port: " + port + ")");
console.log("Goto: 'localhost' or 'https://localhost:" + port + "'");
console.log("Note: You'll need to ignore the security warning (normally under advanced or more)");