const express = require("express");
const bodyParser = require("body-parser");
const io = require("socket.io");
const http = require("http");
const https = require("https");
const path = require("path");
const asaph = require("./asaph");

/** Server object containing an HTTPS, Express and Socket.io server */
class Server {
	/** 
	 * Creates the object and initialises it
	 * @param {Object} opts - Additional parameters to use when setting up the server
	 * @see [init]{@link Server#init}
	 */
	constructor(opts) {
		this.init(opts);
	}
	
	/** 
	 * Initialise the server 
	 * @param {Object} opts - Additional parameters to use when setting up the server
	 * @param {Object} [opts.httpsOpts] - Options to be used when creating the HTTPS server, [see https.createServer]{@link https://nodejs.org/api/https.html#https_https_createserver_options_requestlistener}
	 * @param {string} [opts.dataFile="data/data.json"] - Location of the file r/w the saved data to
	 * @param {string} [opts.staticDir="public"] - Directory to load static content from
	 * @see [Asaph.init]{@link Asaph#init}
	 * @see [setupExpress]{@link Server#setupExpress}
	 * @see [setupSocket]{@link Server#setupSocket}
	 **/
	init(opts) {
		this.asaph = new asaph.Asaph(opts);
		
		this.app = express();
		this.server = https.createServer(opts.httpsOpts, this.app);
		this.socket = io(this.server);
	
		this.setupExpress(opts);
		this.setupSocket();
	}
	
	/** 
	 * Respond to an HTTP request using a [result]{@link Asaph.createResult}/[reason]{@link Asaph.createReason} object
     * @param {Express.Response} res - The response object created with the request
	 * @param {Object} data - A result/reason object
	 */
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
	/**
	 * Setup the Express server and handle routing for the API
	 * @param {Object} opts - Additional parameters to user when seting up express
	 * @param {string} [opts.staticDir="public"] - Directory to load static content from
	 */
	setupExpress(opts) {		
		this.app.use(bodyParser.json());
		this.app.use(bodyParser.urlencoded({ extended: false }));
		this.app.use(express.static(opts.staticDir || "public"));
		
		this.app.get("/api/server/close/:password", (req, res) => {
			if(req.params.password) {
				if(req.params.password === "psalm50") {
					this.close();
					this.respond(res, asaph.Asaph.createResult("Server Closed"));
				}
				else {
					this.respond(res, asaph.Asaph.createReason(403));
				}
			}
			else {
				this.respond(res, asaph.Asaph.createReason(400));
			}
		});
		
		this.app.get("/link/:context/:code", (req, res) => {
			if(req.query.uid && req.query.token) {
				if(req.params.context && req.params.code) {
					this.respond(res, this.asaph.openLink(req.params.code, req.params.context, req.query.uid, req.query.token));
				}
				else {
					res.sendStatus(400);
				}
			}
			else {
				res.sendFile(path.resolve(__dirname + "/../public/index.html"));
			}
		});
		
		/**
		 * Login into an account using and email address and password generating a new access token
		 * @event Server#api/account/login
		 * @type {POST}
		 * @property {string} email - Email address
		 * @property {string} password - Password
		 * @returns {Object} Access Token { uid, token }
		 */
		this.app.post("/api/account/login", (req, res) => {
			if(req.body.email && req.body.password) {
				this.respond(res, this.asaph.login(req.body.email, req.body.password));
			}
			else {
				res.sendStatus(400);
			}
		});
		/**
		 * Create a new account with an email address, name and password returning an access token
		 * @event Server#api/account/create
		 * @type {POST}
		 * @property {string} email - Email address
		 * @property {string} password - Password
		 * @property {string} [name] - Name
		 * @returns {Object} Access Token ({ uid, token })
		 */
		this.app.post("/api/account/create", (req, res) => {
			if(req.body.email && req.body.password) {
				this.respond(res, this.asaph.createAccount(req.body.email, req.body.password, req.body.name));
				
			}
			else {
				res.sendStatus(400);
			}
		});
		/**
		 * Removes the current access token
		 * @event Server#api/account/signout
		 * @type {POST}
		 * @property {string} uid - User ID
		 * @property {string} token - Token
		 */
		this.app.post("/api/account/signout", (req, res) => {
			if(req.body.uid && req.body.token) {
				this.respond(res, this.asaph.signout(req.body.uid, req.body.token));
			}
			else {
				res.sendStatus(400);
			}
		});
		
		/**
		 * Gets the user profile of the specified account
		 * @event Server#api/account/profile
		 * @type {GET}
		 * @property {string} uid - User ID
		 * @property {string} token - Token
		 * @returns {Object} User Profile ({ email, name, sid })
		 */
		this.app.get("/api/account/profile", (req, res) => {
			if(req.query.uid && req.query.token) {
				this.respond(res, this.asaph.getProfile(req.query.uid, req.query.token));
				
			}
			else {
				res.sendStatus(400);
			}
		});
		/**
		 * Sets the user profile of the specified account
		 * @event Server#api/account/profile
		 * @type {POST}
		 * @property {string} uid - User ID
		 * @property {string} token - Token
		 * @param {Object} profile - The set of attributes to set
		 * @param {string} [profile.email] - Email address
		 * @param {string} [profile.name] - The user's name
		 * @param {string} [profile.password] - Password to be hashed
		 */
		this.app.post("/api/account/profile", (req, res) => {
			if(req.body.uid && req.body.token && req.body.profile) {
				this.respond(res, this.asaph.setProfile(req.body.uid, req.body.token, req.body.profile));
			}
			else {
				res.sendStatus(400);
			}
		});
		
		/**
		 * Create a new Session
		 * @event Server#api/session/create
		 * @type {POST}
		 * @property {string} name - Session Name
		 * @property {string} password - Session Password
		 * @property {string} uid - User ID
		 * @property {string} token - Token
		 * @returns {Object} Session Public Details ({ sid, name, password, owner, link })
		 */
		this.app.post("/api/session/create", (req, res) => {
			if(req.body.name && req.body.password && req.body.uid && req.body.token) {
				this.respond(res, this.asaph.createSession(req.body.name, req.body.password, req.body.uid, req.body.token));
			}
			else {
				res.sendStatus(400);
			}
		});
		/**
		 * Join a Session
		 * @event Server#api/session/join
		 * @type {POST}
		 * @property {string} sid - Session ID
		 * @property {string} password - Session Password
		 * @property {string} uid - User ID
		 * @property {string} token - Token
		 * @property {boolean} save - Should the session details be saved to My Sessions
		 * @returns {Object} Session Public Details ({ sid, name, password, owner, link })
		 */
		this.app.post("/api/session/join", (req, res) => {
			if(req.body.sid && req.body.password && req.body.uid && req.body.token) {
				this.respond(res, this.asaph.joinSession(req.body.sid, req.body.password, req.body.uid, req.body.token, req.body.save));
			}
			else {
				res.sendStatus(400);
			}
		});
		/**
		 * Leave the current session
		 * @event Server#api/session/leave
		 * @type {POST}
		 * @property {string} uid - User ID
		 * @property {string} token - Token
		 */
		this.app.post("/api/session/leave", (req, res) => {
			if(req.body.uid && req.body.token) {
				this.respond(res, this.asaph.leaveSession(req.body.uid, req.body.token));
			}
			else {
				res.sendStatus(400);
			}
		});
		/**
		 * Get all saved sessions under the specified account
		 * @event Server#api/session/sessions
		 * @type {GET}
		 * @property {string} uid - User ID
		 * @property {string} token - Token
		 * @returns {Object[]} Array of saved sessions ([{ sid, name, password, owner }])
		 */
		this.app.get("/api/session/sessions", (req, res) => {
			if(req.query.uid && req.query.token) {
				this.respond(res, this.asaph.getSessions(req.query.uid, req.query.token));
			}
			else {
				res.sendStatus(400);
			}
		});
		/**
		 * Remove a saved session
		 * @event Server#api/session/leave
		 * @type {POST}
		 * @property {string} sid - Session ID
		 * @property {string} uid - User ID
		 * @property {string} token - Token
		 */
		this.app.post("/api/session/remove", (req, res) => {
			if(req.body.uid && req.body.token && req.body.sid) {
				this.respond(res, this.asaph.removeSession(req.body.sid, req.body.uid, req.body.token));
			}
			else {
				res.sendStatus(400);
			}
		});
	}
	
	/** Setup the Socket.io server and handle socket events  */
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
			const getSID = id => {
				if(id && id in connections && connections[id].session) {
					return connections[id].session.sid;
				}
				else {
					return "";
				}
			}
			
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
				if(getSID(socket.id) && data && getSID(socket.id) === getSID(data.to)) {
					socket.to(data.to).emit("signal", {
						from: socket.id,
						signal: data.signal
					});
				}
			});
			
			socket.on("chat", data => {
				if(getSID(socket.id)) {
					socket.to(getSID(socket.id)).broadcast.emit("chat", {
						from: socket.id,
						chat: data.chat
					});
					respond("chat", true, data.chat);
				}
				else {
					respond("chat", false, 403);
				}
			});
		});
	}
	
	/** 
	 * Opens the HTTPS Server on the specified port
	 * @param {number} port - Port number to open the server onto
	 */
	listen(port) {
		this.server.listen(port);
		
		if(!this.redirectServer) {
			this.redirectServer = http.createServer((req, res) => res.writeHead(301, {
				"Location": "https://" + req.headers.host + ":" + port + req.url,
				"Cache-Control": "no-cache"
			}).end());
			this.redirectServer.listen(80);
		}
	}
	
	/**
	 * Closes the server
	 */
	close() {
		this.server.close();
		if(this.redirectServer) {
			this.redirectServer.close();
		}
		this.socket.close();
	}
}

module.exports = Server;