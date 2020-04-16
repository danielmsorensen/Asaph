const express = require("express");
const bodyParser = require("body-parser");
const io = require("socket.io");
const https = require("https");
const asaph = require("./asaph");

class Server {
	constructor(opts) {
		this.init(opts);
	}
	
	init(opts) {
		this.asaph = new asaph.Asaph(opts);
		
		this.app = express();
		this.server = https.createServer(opts.httpsOpts, this.app);
		this.socket = io(this.server);
	
		this.setupExpress(opts);
		this.setupSocket();
	}
	
	respond(res, data) {
		if(data.success) {
			if(data.result) {
				res.status(200).json(data.result);
			}
			else {
				res.sendStatus(200);
			}
		}
		else {
			res.sendStatus(data.reason);
		}
	}
	setupExpress(opts) {
		this.app.use(bodyParser.json());
		this.app.use(bodyParser.urlencoded({ extended: false }));
		this.app.use(express.static(opts.staticDir || "public"));
		
		this.app.post("/api/account/login", (req, res) => {
			if(req.body.email && req.body.password) {
				this.respond(res, this.asaph.login(req.body.email, req.body.password));
			}
			else {
				res.sendStatus(400);
			}
		});
		this.app.post("/api/account/create", (req, res) => {
			if(req.body.email && req.body.password) {
				this.respond(res, this.asaph.createAccount(req.body.email, req.body.password, req.body.name));
				
			}
			else {
				res.sendStatus(400);
			}
		});
		
		this.app.post("/api/account/signout", (req, res) => {
			if(req.body.uid && req.body.token) {
				this.respond(res, this.asaph.signout(req.body.uid, req.body.token));
			}
			else {
				res.sendStatus(400);
			}
		});
		
		this.app.get("/api/account/profile", (req, res) => {
			if(req.query.uid && req.query.token) {
				this.respond(res, this.asaph.getProfile(req.query.uid, req.query.token));
				
			}
			else {
				res.sendStatus(400);
			}
		});
	}
	
	setupSocket() {
		
	}
	
	listen(port) {
		this.server.listen(port);
	}
}

module.exports = Server;