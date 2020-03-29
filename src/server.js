const express = require("express");
const io = require("socket.io");
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
		this.socket = io(this.server);
		
		this.app.use(express.static(path.join(__dirname, "../public")));
		
		this.app.get("/", (req, res) => {
			res.sendFile("index.html");
		});
		
		this.socket.on("connection", socket => {
			if(!(socket.id in this.activeSockets)) {
				console.log(socket.id + " connected");
				this.activeSockets[socket.id] = {
					"socketID": socket.id,
					"socket": socket,
					"session": null
				};
			}
			
			socket.on("create-session", data => {
				console.log(socket.id + " create-session " + JSON.stringify(data));
				if(data.sessionName && data.displayName) {
					if(data.sessionName in this.sessions) {
						socket.emit("create-session-res", {
							success: false,
							reason: "exists"
						});
					}
					else {
						this.sessions[data.sessionName] = new Session(data.sessionName, data.sessionPassword);
						this.activeSockets[socket.id].session = this.sessions[data.sessionName];
						this.sessions[data.sessionName].setUser(socket, data.displayName);
						this.sessions[data.sessionName].setUserAttr(socket, "admin", true);
						socket.emit("create-session-res", {
							success: true,
							reason: ""
						});
						console.log("'" + data.sessionName + "' created by " + socket.id + " (" + data.displayName + ")");
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
							this.activeSockets[socket.id].session = this.sessions[data.sessionName];
							
							this.sessions[data.sessionName].setUser(socket, data.displayName);
							socket.emit("join-session-res", {
								success: true,
								reason: ""
							});
							
							console.log(socket.id + " (" + data.displayName + ") joined '" + data.sessionName + "'");
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
			
			socket.on("call-user", data => {
				socket.to(data.to).emit("call-made", {
					offer: data.offer,
					socketID: socket.id
				});
			});
			socket.on("make-answer", data => {
				socket.to(data.to).emit("answer-made", {
					socketID: socket.id,
					answer: data.answer
				});
			});
			
			socket.on("msg", data => {
				if(this.activeSockets[socket.id].session) {
					this.activeSockets[socket.id].session.sendMsg(socket, data.msg);
					socket.emit("msg-res", {
						success: true,
						reason: data
					});
					
					console.log("'" + this.activeSockets[socket.id].session.name + "': " + socket.id + " (" + this.activeSockets[socket.id].session.users[socket.id].displayName + ") msg '" + data.msg + "'");
				}
			});
			
			socket.on("video", data => {
				if(this.activeSockets[socket.id].session) {
					if(this.activeSockets[socket.id].session.users[socket.id].admin) {
						switch(data.type) {
							case("normal"):
								socket.emit("video-res", {
									success: true,
									reason: data.type
								});
								this.activeSockets[socket.id].session.startVideo(socket);
								break;
							case("layer"):
								socket.emit("video-res", {
									success: true,
									reason: data.type
								});
								this.activeSockets[socket.id].session.startLayerVideo(socket, data.layers);
								break;
							case("stop"):
								socket.emit("video-res", {
									success: true,
									reason: data.type
								});
								this.activeSockets[socket.id].session.stopVideo(socket);
								break;
						}
					}
					else {
						socket.emit("video-res", {
							success: false,
							reason: "permission"
						});
					}
				}
			});
			
			socket.on("disconnect", () => {
				if(socket.id in this.activeSockets) {
					if(this.activeSockets[socket.id].session) {
						this.activeSockets[socket.id].session.removeUser(socket);
					}
					delete this.activeSockets[socket.id];
					
					console.log(socket.id + " disconnected");
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
		this.video = "";
	}
	
	broadcast(socket, msg, data) {
		if(socket) {
			socket.to(this.name).emit(msg, data);
		}
	}
	
	setUser(socket, displayName) {
		if(socket.id in this.users) {
			this.users[socket.id].displayName = displayName;
			this.broadcast(socket, "change-name", this.users[socket.id]);
		}
		else {
			this.users[socket.id] = new User(socket.id, displayName);
			socket.join(this.name);
			this.broadcast(socket, "add-user", this.users[socket.id]);
			for(let socketID in this.users) {
				if(socketID !== socket.id) {
					socket.emit("add-user", this.users[socketID]);
				}
			}
		}
	}
	
	removeUser(socket) {
		socket.leave(this.name);
		this.broadcast(socket, "remove-user", this.users[socket.id]);
		delete this.users[socket.id];
	}
	
	setUserAttr(socket, attr, value) {
		this.users[socket.id][attr] = value;
		this.broadcast(socket, "set-user-attr", {
			"socketID": socket.id,
			"attr": attr,
			"value": value
		});
	}
	
	sendMsg(socket, msg) {
		this.broadcast(socket, "msg-rec", {
			"from": this.users[socket.id].displayName,
			"msg": msg
		});
	}
	
	startVideo(socket) {
		this.video = "normal";
		this.broadcast(socket, "start-video", {
			"type": "normal"
		});
	}
	
	startLayerVideo(socket, layers) {
		this.video = "layer";
		this.broadcast(socket, "start-video", {
			"type": "layer"
		});
	}
	
	stopVideo(socket) {
		this.video = "";
		this.broadcast(socket, "stop-video", {});
	}
}

class User {
	constructor(socketID, displayName) {
		this.socketID = socketID;
		this.displayName = displayName;
	}
}

module.exports = { Server, Session, User };