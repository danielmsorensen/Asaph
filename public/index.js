let pages = [];

let session_form = null;

let session_name = null;
let chats = null;
let chatInput = null;

let session = {};

document.addEventListener("DOMContentLoaded", () => {
	pages = document.querySelectorAll(".page");
	
	session_form = document.forms["session_form"];
	
	session_name = document.getElementById("session_name");
	chats = document.getElementById("chats");
	chatInput = document.forms["chat_form"]["chatInput"];
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

function sendMsg() {
	socket.emit("msg", {
		"msg": chatInput.value
	});
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
		case("info"):
			node.className = "panel panel-info";
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

const socket = io.connect(window.location.origin);

socket.on("join-session-res", data => {
	if(data.success) {
		joinedSession();
	}
	else {
		switch(data.reason) {
			case "exists":
				if(confirm("The session '" + session.sessionName + "' does not exist\nDo you want to create this session?")) {
					session.status = "creating";
					socket.emit("create-session", session);
				}
				break;
			case "password":
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
			case exists:
				alert("A session with that name already exists");
				break;
		}
	}
});

socket.on("add-user", data => {
	addChat("info", data.displayName + " has joined the session");
});
socket.on("change-name", data => {
	addChat("info", data.displayName + " has changed their name");
});
socket.on("remove-user", data => {
	addChat("info", data.displayName + " has left the session");
});

socket.on("msg-res", data => {
	if(data.success) {
		addChat("chat", data.reason.msg, "You");
	}
});
socket.on("msg-rec", data => {
	addChat("chat", data.msg, data.from);
});

/*
const { RTCPeerConnection, RTCSessionDescription } = window;

async function createConnection(id) {
	const connection = new RTCPeerConnection();
	const offer = await connection.createOffer();
	await connection.setLocalDescription(new RTCSessionDescription(offer));
	
	socket.emit("create-connection", {
		offer,
		to: id
	});
}

peerConnection.ontrack = function({ steams: [stream] }) {
	const remoteVideo = document.getElementById("remote-video");
	if(remoteVideo) {
		remoteVideo.srcObject = stream;
	}
};

navigator.mediaDevices.getUserMedia({ video: true, audio: true })
	.then(function(stream) {
		const localVideo = document.getElementById("local-video");
		if(localVideo) {
			localVideo.srcObject = stream;
		}
		
		stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
	})
	.catch(function(error) {
		console.warn(error.message);
	});
*/