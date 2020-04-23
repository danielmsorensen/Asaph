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
		this.app.post("/api/account/profile", (req, res) => {
			res.sendStatus(501);
		});
		
		this.app.post("/api/session/create", (req, res) => {
			if(req.body.name && req.body.password && req.body.uid && req.body.token) {
				this.respond(res, this.asaph.createSession(req.body.name, req.body.password, req.body.uid, req.body.token));
			}
			else {
				res.sendStatus(400);
			}
		});
		this.app.post("/api/session/join", (req, res) => {
			if(req.body.sid && req.body.password && req.body.uid && req.body.token) {
				this.respond(res, this.asaph.joinSession(req.body.sid, req.body.password, req.body.uid, req.body.token, req.body.save));
			}
			else {
				res.sendStatus(400);
			}
		});
		this.app.post("/api/session/leave", (req, res) => {
			if(req.body.uid && req.body.token) {
				this.respond(res, this.asaph.leaveSession(req.body.uid, req.body.token));
			}
			else {
				res.sendStatus(400);
			}
		});
		this.app.get("/api/session/get", (req, res) => {
			if(req.query.uid && req.query.token) {
				this.respond(res, this.asaph.getSessions(req.query.uid, req.query.token));
			}
			else {
				res.sendStatus(400);
			}
		});
		this.app.post("/api/session/remove", (req, res) => {
			if(req.body.uid && req.body.token && req.body.sid) {
				this.respond(res, this.asaph.removeSession(req.body.sid, req.body.uid, req.body.token));
			}
			else {
				res.sendStatus(400);
			}
		});
	}
	
	setupSocket() {
		const connections = {};
		this.socket.on("connection", socket => {
			const respond = (eventName, success, r) => {
				if(r) {
					if(success) {
						socket.emit("res", {
							eventName,
							success,
							result: r
						});
					}
					else {
						socket.emit("res", {
							eventName,
							success,
							reason: r
						});
					}
				}
				else {
					socket.emit("res", {
						eventName,
						success
					});
				}
			};
			
			connections[socket.id] = {};
			
			socket.on("join", data => {				
				if(data && data.uid && data.token) {
					const res = this.asaph.verifyUserSession(data.uid, data.token, (user, session) => {
						connections[socket.id] = {
							user,
							session
						};
						
						socket.join(session.sid);
						socket.to(session.sid).emit("user-connected", {
							socketID: socket.id,
							user: user.getProfile()
						});
						
						return asaph.Asaph.createResult();
					});
					
					if(res.success) {
						respond("join", true, connections[socket.id].session.getPublic());
						
						this.socket.to(connections[socket.id].session.sid).clients((err, clients) => {
							if(err) {
								throw err;
							}
							else {
								for(const socketID of clients) {
									if(socketID !== socket.id) {
										socket.emit("user-connected", {
											socketID,
											user: connections[socketID].user.getProfile(),
											call: true
										});
									}
								}
							}
						});
					}
					else {
						respond("join", false, res.reason);
					}
				}
				else {
					respond("join", false, 400);
				}
			});
			socket.on("disconnect", () => {				
				if(socket.id in connections) {
					if(connections[socket.id].session) {						
						socket.to(connections[socket.id].session.sid).emit("user-disconnected", {
							socketID: socket.id
						});
					}
					
					delete connections[socket.id];
				}
			});
			
			socket.on("signal", data => {
				if(connections[socket.id].session && data && data.to in connections && connections[data.to].session && connections[socket.id].session.sid === connections[data.to].session.sid) {
					socket.to(data.to).emit("signal", {
						from: socket.id,
						signal: data.signal
					});
				}
			});
		});
	}
	
	listen(port) {
		this.server.listen(port);
	}
}

module.exports = Server;