let pages = [];

let session_form = null;

let session_name = null;
let chats = null;
let chatInput = null;
let videos = null;

let session = {};

let users = {};

let videoStream = null;
let localStream = null;

document.addEventListener("DOMContentLoaded", () => {
	pages = document.querySelectorAll(".page");
	
	session_form = document.forms["session_form"];
	
	session_name = document.getElementById("session_name");
	chats = document.getElementById("chats");
	chatInput = document.forms["chat_form"]["chatInput"];
	videos = document.getElementById("video");
});

function showPage(pageIndex) {
	for(let i = 0; i < pages.length; i++) {
		if(i === pageIndex) {
			pages[i].className = "page active";
		}
		else {
			pages[i].className = "page";
		}
	}
}

function joinSession() {	
	let sessionName = session_form["sessionName"].value;
	let sessionPassword = session_form["sessionPassword"].value;
	let displayName = session_form["displayName"].value;
	
	if(!sessionName) {
		alert("The session name cannot be empty");
		return;
	}
	if(!displayName) {
		alert("Your display name cannot be blank");
		return;
	}
	
	session = {
		"status": "joining",
		"sessionName": sessionName,
		"sessionPassword": sessionPassword,
		"displayName": displayName
	}
	socket.emit("join-session", session);
}

async function startVideo() {
	addChat("primary", "Starting video");
	try {
		videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
		
		let node = document.createElement("video");
		node.id = "local-video";
		node.autoplay = true;
		node.muted = true;
		node.srcObject = videoStream;
		videos.appendChild(node);
		
		for(let socketID in users) {
			for(let track of videoStream.getTracks()) {
				users[socketID].connection.addTrack(track, videoStream);
			}
			
			let node = document.createElement("video");
			node.id = socketID;
			node.autoplay = true;
			videos.appendChild(node);
			
			users[socketID].video = node;
			users[socketID].connection.ontrack = ({ streams: [stream] }) => {
				node.srcObject = stream;
			};
		}
	}
	catch(error) {
		addChat("error", error.message);
		console.warn(error.message);
	}
}

function addVideo(socketID) {
	let node = document.createElement("video");
	node.id = socketID;
	node.autoplay = true;
	videos.appendChild(node);
}

function sendMsg() {
	if(chatInput.value.startsWith("/")) {
		let parts = chatInput.value.slice(1).split(" ");
		if(parts.length > 0) {
			switch(parts[0]) {
				case("video"):
					if(parts.length >= 2) {
						switch(parts[1]) {
							case("normal"):
								socket.emit("video", {
									"type": "normal"
								});
								break;
							case("layer"):
								socket.emit("video", {
									"type": "layer",
									"layers": {}
								});
								break;
							case("stop"):
								socket.emit("video", {
									"type": "stop"
								});
								break;
						}
					}
					else {
						addChat("error", "Video command syntax incorrect");
					}
					break;
				default:
					addChat("error", "Unknown command");
					break;
			}
		}
		else {
			socket.emit("msg", {
				"msg": "/"
			});
		}
	}
	else {
		socket.emit("msg", {
			"msg": chatInput.value
		});
	}
	chatInput.value = "";
}

function addChat(type, msg, header) {
	let node = document.createElement("div");
	switch(type) {
		case("chat"):
			node.className = "panel panel-default";
			node.innerHTML = "" +
				'<div class="panel-heading">' + header + '</div>' +
				'<div class="panel-body">' + msg + '</div>';
			break;
		case("primary"):
			node.className = "panel panel-primary";
			node.innerHTML = '<div class="panel-heading">' + msg + '</div>'
			break;
		case("info"):
			node.className = "panel panel-info";
			node.innerHTML = '<div class="panel-heading">' + msg + '</div>'
			break;
		case("warn"):
			node.className = "panel panel-warn";
			node.innerHTML = '<div class="panel-heading">' + msg + '</div>'
			break;
		case("error"):
			node.className = "panel panel-danger";
			node.innerHTML = '<div class="panel-heading">' + msg + '</div>'
			break;
	}
	chats.appendChild(node);
}

function joinedSession() {
	session.status = "joined";
	session_name.innerHTML = session.sessionName;
	showPage(1);
	addChat("info", "You joined the session");
}

async function callUser(socketID) {
	const offer = await users[socketID].connection.createOffer();
	await users[socketID].connection.setLocalDescription(new RTCSessionDescription(offer));
	
	socket.emit("call-user", {
		"offer": offer,
		"to": socketID
	});
}

const { RTCPeerConnection, RTCSessionDescription } = window;
const socket = io.connect(window.location.origin);

socket.on("join-session-res", data => {
	if(data.success) {
		joinedSession();
	}
	else {
		switch(data.reason) {
			case("exists"):
				if(confirm("The session '" + session.sessionName + "' does not exist\nDo you want to create this session?")) {
					session.status = "creating";
					socket.emit("create-session", session);
				}
				break;
			case("password"):
				alert("The session password is incorrect");
				break;
		}
	}
});
socket.on("create-session-res", data => {
	if(data.success) {
		joinedSession();
	}
	else {
		switch(data.reason) {
			case("exists"):
				alert("A session with that name already exists");
				break;
		}
	}
});

socket.on("add-user", data => {
	users[data.socketID] = data;
	users[data.socketID].connection = new RTCPeerConnection();
	if(session.status === "joining") {
		addChat("info", data.displayName + " is in the session");
		callUser(data.socketID);
	}
	else {
		addChat("info", data.displayName + " has joined the session");
	}
});
socket.on("change-name", data => {
	addChat("info", users[data.socketID].displayName + " changed their name to " + data.displayName);
	users[data.socketID].displayName = data.displayName;
});
socket.on("remove-user", data => {
	if(data.socketID in users) {
		if(users[data.socketID].video) {
			videos.removeChild(users[data.socketID].video);
		}
		delete users[data.socketID];
	}
	addChat("info", data.displayName + " has left the session");
});

socket.on("call-made", async data => {
	await users[data.socketID].connection.setRemoteDescription(new RTCSessionDescription(data.offer));
	const answer = await users[data.socketID].connection.createAnswer();
	await users[data.socketID].connection.setLocalDescription(new RTCSessionDescription(answer));
	
	socket.emit("make-answer", {
		"answer": answer,
		"to": data.socketID
	});
});
socket.on("answer-made", async data => {
	await users[data.socketID].connection.setRemoteDescription(new RTCSessionDescription(data.answer));
	callUser(data.socketID);
});

socket.on("msg-res", data => {
	if(data.success) {
		addChat("chat", data.reason.msg, "You");
	}
});
socket.on("msg-rec", data => {
	addChat("chat", data.msg, data.from);
});

socket.on("video-res", async data => {
	if(data.success) {
		await startVideo();
	}
	else {
		switch(data.reason) {
			case("permission"):
				addChat("error", "You do not have permission to start video");
				break;
		}
	}
});
socket.on("start-video", async data => {	
	await startVideo();
});