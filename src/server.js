const express = require("express");
const io = require("socket.io");
const https = require("https");
const turn = require("node-turn");
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
		this.turn = new turn({
			authMech: "long-term",
			credentials: {
				"psalms": "50/73-83"
			}
		});
		
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
							let ok = true;
							for(let socketID in this.sessions[data.sessionName].users) {
								if(data.displayName === this.activeSockets[socketID].displayName) {
									ok = false;
									break;
								}
							}
							if(ok) {
								this.activeSockets[socket.id].session = this.sessions[data.sessionName];
								
								this.sessions[data.sessionName].setUser(socket, data.displayName);
								socket.emit("join-session-res", {
									success: true,
									reason: ""
								});
								
								if(this.activeSockets[socket.id].session.video) {
									socket.emit("start-video");
								}
								
								console.log(this.activeSockets[socket.id].session.log(socket.id) + " joined");
							}
							else {
								socket.emit("join-session-res", {
									success: false,
									reason: "taken"
								});
							}
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
			
			let leaveSession = () => {
				if(this.activeSockets[socket.id].session) {
					console.log(this.activeSockets[socket.id].session.log(socket.id) + " left");
					this.activeSockets[socket.id].session.removeUser(socket);
					if(Object.keys(this.activeSockets[socket.id].session.users).length === 0) {
						console.log("'" + this.activeSockets[socket.id].session.name + "' closed");
						delete this.sessions[this.activeSockets[socket.id].session.name];
					}
					this.activeSockets[socket.id].session = null;
				}
			}
			socket.on("leave-session", leaveSession);
			
			socket.on("request-call", data => {
				if(data.to in this.activeSockets && socket.id in this.activeSockets && this.activeSockets[socket.id].session && this.activeSockets[data.to].session && this.activeSockets[socket.id].session.name === this.activeSockets[data.to].session.name) {
					socket.to(data.to).emit("call-requested", {
						from: socket.id
					});
				}
			});
			socket.on("call-user", data => {
				if(data.to in this.activeSockets && socket.id in this.activeSockets && this.activeSockets[socket.id].session && this.activeSockets[data.to].session && this.activeSockets[socket.id].session.name === this.activeSockets[data.to].session.name) {
					socket.to(data.to).emit("call-made", {
						offer: data.offer,
						socketID: socket.id
					});
				}
			});
			socket.on("make-answer", data => {
				if(data.to in this.activeSockets && socket.id in this.activeSockets && this.activeSockets[socket.id].session && this.activeSockets[data.to].session && this.activeSockets[socket.id].session.name === this.activeSockets[data.to].session.name) {
					socket.to(data.to).emit("answer-made", {
						socketID: socket.id,
						answer: data.answer
					});
				}
			});
			
			socket.on("msg", data => {
				if(this.activeSockets[socket.id].session && data.msg) {
					this.activeSockets[socket.id].session.sendMsg(socket, data.msg);
					socket.emit("msg-res", {
						success: true,
						reason: data
					});
					
					console.log(this.activeSockets[socket.id].session.log(socket.id) + " msg '" + data.msg + "'");
				}
			});
			
			socket.on("video", data => {
				if(this.activeSockets[socket.id].session) {
					if(true) { //this.activeSockets[socket.id].session.users[socket.id].admin) {
						switch(data.option) {
							case("start"):
								socket.emit("video-res", {
									success: true,
									reason: "start"
								});
								this.activeSockets[socket.id].session.startVideo(socket);
								break;
							case("stop"):
								socket.emit("video-res", {
									success: true,
									reason: "stop"
								});
								this.activeSockets[socket.id].session.stopVideo(socket);
								break;
						}
						console.log(this.activeSockets[socket.id].session.log(socket.id) + " video " + data.option);
					}
					else {
						socket.emit("video-res", {
							success: false,
							reason: "permission"
						});
					}
				}
			});
			
			socket.on("layers", data => {
				if(this.activeSockets[socket.id].session) {
					if(true) { //insert permissions here
						let layers = this.activeSockets[socket.id].session.layers;
						let useLayers = this.activeSockets[socket.id].session.useLayers;
						
						if(data.layers) {
							layers = data.layers;
						}
						
						if(typeof data.useLayers !== "undefined") {
							useLayers = data.useLayers;	
						}

						if(this.activeSockets[socket.id].session.setLayers(socket, layers, useLayers)) {
							socket.emit("layers-res", {
								success: true,
								reason: data.layers
							});
						}
						else {
							socket.emit("layers-res", {
								success: false,
								reason: "params"
							});
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
			socket.on("sequence", data => {
				if(this.activeSockets[socket.id].session) {
					if(true) { //insert permissions here
						let sequence = this.activeSockets[socket.id].session.sequence;
						let useSequence = this.activeSockets[socket.id].session.useSequence;
						
						if(data.sequence) {
							sequence = data.sequence;
						}
						
						if(typeof data.useSequence !== "undefined") {
							useSequence = data.useSequence;	
						}

						if(this.activeSockets[socket.id].session.setSequence(socket, sequence, useSequence)) {
							socket.emit("sequence-res", {
								success: true,
								reason: data.sequence
							});
							console.log(this.activeSockets[socket.id].session.log(socket.id) + " sequence " + data.sequence);
						}
						else {
							socket.emit("sequence-res", {
								success: false,
								reason: "params"
							});
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
					leaveSession();
					delete this.activeSockets[socket.id];
					
					console.log(socket.id + " disconnected");
				}
			});
		});
	}
	
	listen(port) {
		//this.turn.start();
		this.server.listen(port, "0.0.0.0");
	}
}

class Session {
	constructor(name, password) {
		this.name = name;
		this.password = password;
		
		this.users = {};
		
		this.video = "";
		this.layers = [];
		this.sequence = [];
	}
	
	log(socketID) {
		return "'" + this.name + "': " + socketID + " (" + this.users[socketID].displayName + ")";
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
		this.broadcast(socket, "start-video");
	}
	
	stopVideo(socket) {
		this.video = "";
		this.broadcast(socket, "stop-video");
	}
	
	setLayers(socket, layers, useLayers) {
		try {
			const users = []
			for(let layer of layers) {
				if(typeof layer.delay !== "number") {
					return false;
				}
				for(let user of layer.users) {
					if(users.includes(user)) {
						return false;
					}
					users.push(user);
				}
			}
			
			if(typeof useLayers !== "boolean") {
				return false;
			}
			
			this.layers = layers;
			if(useLayers) {
				this.video = "layers";
				this.broadcast("layers", {
					"layers": layers
				});
			}
			
			return true;
		}
		catch(error) {
			console.warn(message);
			return false;
		}
	}
	
	setSequence(socket, sequence, useSequence) {
		try {
			if(!Array.isArray(sequence)) {
				return false;
			}
			
			if(typeof useSequence !== "boolean") {
				return false;
			}
			
			this.sequence = sequence;
			if(useSequence) {
				this.video = "sequence";
				this.broadcast(socket, "sequence", {
					"sequence": sequence
				});
			}
			else {
				this.video = "normal"
				this.broadcast(socket, "sequence", {});
			}
			return true;
		}
		catch(error) {
			console.warn(error.message);
			return false;
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