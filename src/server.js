const express = require("express");
const socketIO = require("socket.io");
const https = require("https");
const path = require("path");
const fs = require("fs");

const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};

class Server {
	constructor() {
		this.init();
	}
	
	init() {
		this.activeSockets = {};
		this.sessions = {};
		
		this.app = express();
		this.server = https.createServer(options, this.app);
		this.socket = socketIO(this.server);
		
		this.app.use(express.static(path.join(__dirname, "../public")));
		
		this.app.get("/", (req, res) => {
			res.sendFile("index.html");
		});
		
		this.socket.on("connection", socket => {
			if(!(socket.id in this.activeSockets)) {
				this.activeSockets[socket.id] = "";
			}
			
			socket.on("create-session", data => {
				if(data.sessionName && data.displayName) {
					if(data.sessionName in this.sessions) {
						socket.emit("create-session-res", {
							success: false,
							reason: "exists"
						});
					}
					else {
						this.activeSockets[socket.id] = data.sessionName;
						
						this.sessions[data.sessionName] = new Session(data.sessionName, data.sessionPassword);
						this.sessions[data.sessionName].setUser(socket, socket.id, data.displayName);
						this.sessions[data.sessionName].setUserAttr(socket, socket.id, "admin", true);
						socket.emit("create-session-res", {
							success: true,
							reason: ""
						});
					}
				}
				else {
					socket.emit("create-session-res", {
						success: false,
						reason: "empty"
					});
				}
			});
			
			socket.on("join-session", data => {
				if(data.sessionName && data.displayName) {
					if(data.sessionName in this.sessions) {
						if(data.sessionPassword === this.sessions[data.sessionName].password) {
							this.activeSockets[socket.id] = data.sessionName;
							
							this.sessions[data.sessionName].setUser(socket, socket.id, data.displayName);
							socket.emit("join-session-res", {
								success: true,
								reason: ""
							});
						}
						else {
							socket.emit("join-session-res", {
								success: false,
								reason: "password"
							});
						}
					}
					else {
						socket.emit("join-session-res", {
							success: false,
							reason: "exists"
						});
					}
				}
				else {
					socket.emit("join-session-res", {
						success: false,
						reason: "empty"
					});
				}
			});
			
			socket.on("msg", data => {
				if(this.activeSockets[socket.id] in this.sessions) {
					this.sessions[this.activeSockets[socket.id]].sendMsg(socket, socket.id, data.msg);
					socket.emit("msg-res", {
						success: true,
						reason: data
					});
				}
			});
			
			socket.on("disconnect", () => {
				if(socket.id in this.activeSockets) {
					if(this.activeSockets[socket.id] in this.sessions) {
						this.sessions[this.activeSockets[socket.id]].removeUser(socket, socket.id);
						delete this.activeSockets[socket.id];
					}
				}
			});
		});
	}
	
	listen(port) {
		this.server.listen(port, "0.0.0.0");
	}
}

class Session {
	constructor(name, password) {
		this.name = name;
		this.password = password;
		
		this.users = {};
	}
	
	broadcast(socket, msg, data) {
		if(socket) {
			socket.to(this.name).emit(msg, data);
		}
	}
	
	setUser(socket, socketID, displayName) {
		if(socketID in this.users) {
			this.users[socketID].displayName = displayName;
			this.broadcast(socket, "change-name", this.users[socketID]);
		}
		else {
			this.users[socketID] = new User(socketID, displayName);
			if(socket) {
				socket.join(this.name);
				this.broadcast(socket, "add-user", this.users[socketID]);
			}
		}
	}
	
	removeUser(socket, socketID) {
		if(socket) {
			socket.leave(this.name);
			this.broadcast(socket, "remove-user", this.users[socketID]);
		}
		delete this.users[socketID];
	}
	
	setUserAttr(socket, socketID, attr, value) {
		if(socketID in this.users) {
			this.users[socketID][attr] = value;
			this.broadcast(socket, "set-user-attr", {
				"attr": attr,
				"value": value
			});
		}
	}
	
	sendMsg(socket, socketID, msg) {
		if(socketID in this.users) {
			this.broadcast(socket, "msg-rec", {
				"from": this.users[socketID].displayName,
				"msg": msg
			});
		}
	}
}

class User {
	constructor(socketID, displayName) {
		this.socketID = socketID;
		this.displayName = displayName;
	}
}

module.exports = { Server, Session, User };