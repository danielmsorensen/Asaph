let pages = [];
let activePage = 0;

let session_form = null;
let chat_form = null;

let session_name = null;
let chats = null;
let chatInput = null;
let videos = null;

let session = {};

let users = {};

let videoStream = null;
let mediaRecorder = null;

let iceServers = null;

document.addEventListener("DOMContentLoaded", () => {
	pages = document.querySelectorAll(".page");
	
	session_form = document.forms["session_form"];
	chat_form = document.forms["chat_form"];
	
	session_name = document.getElementById("session_name");
	
	chats = document.getElementById("chats");
	chatInput = chat_form["chatInput"];
	
	videos = document.getElementById("video");
	
	window.onresize = window.onorientationchange = () => {
		if(session.video) {
			arrangeVideos();
		}
	};
	
	session_form.onkeyup = session_form.onkeypress = chat_form.onkeyup = chat_form.onkeypress = event => {
		const key = event.keyCode || event.which;
		if(key === 13) {
			event.preventDefault();
			return false;
		}
	};
	document.onkeydown = event => {
		if(event.keyCode === 13) {
			if(activePage === 0) {
				joinSession();
			}
			else if(activePage === 1) {
				sendMsg();
			}
		}
	};
});

function showPage(pageIndex) {
	activePage = pageIndex;
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
	session.video = true;
	addChat("primary", "Starting video");
	videos.style.display = "block";
	window.scrollTo(0, document.body.scrollHeight);
	try {
		if(!videoStream) {
			videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
			mediaRecorder = new MediaRecorder(videoStream, {
				"mimeType": "video/webm; codecs=\"opus,vp8\""
			});
			mediaRecorder.ondataavailable = (event) => {
				if(event.data.size > 0) {
					socket.emit("stream-video", {
						"timecode": event.timecode,
						"chunk": event.data
					});
				}
			};
			mediaRecorder.start(10);
		}
		
		let cont = document.createElement("div");
		cont.className = "video";
		
		let node = document.createElement("video");
		node.id = "local-video";
		node.autoplay = true;
		node.muted = true;
		node.style.transform = "scale(-1, 1)";
		node.srcObject = videoStream;
		
		cont.appendChild(node);
		videos.appendChild(cont);
		
		for(let socketID in users) {
			addVideo(socketID);
		}
		
		arrangeVideos();
	}
	catch(error) {
		addChat("error", error.message);
		console.warn(error.message);
	}
}

function addVideo(socketID) {
	let cont = document.createElement("div");
	cont.className = "video";
	
	let node = document.createElement("video");
	node.id = socketID;
	node.autoplay = true;
	
	users[socketID].src = new MediaSource();
	node.src = URL.createObjectURL(users[socketID].src);
	users[socketID].src.addEventListener("sourceopen", event => {
		users[socketID].buffer = users[socketID].src.addSourceBuffer("video/webm; codecs=\"opus,vp8\"");
	});
	
	cont.appendChild(node);
	videos.appendChild(cont);
	
	users[socketID].video = node;
}

function removeVideo(socketID) {
	users[socketID].connection.ontrack = null;
	users[socketID].connection.close();
	users[socketID].connection = null;
	
	users[socketID].answer = null;
	users[socketID].called = false;
	
	videos.removeChild(users[socketID].video.parentNode);
	users[socketID].video = null;
}

function removeVideo(socketID) {		
	if(users[socketID].video) {
		videos.removeChild(users[socketID].video.parentNode);
		users[socketID].video = null;
		users[socketID].src = null;
		users[socketID].buffer = null;
	}
}

function stopVideo() {
	session.video = false;
	addChat("primary", "Video stopped");
	
	for(let socketID in users) {
		removeVideo(socketID);
	}	
	
	if(videoStream) {
		mediaRecorder.stop();
		mediaRecorder.ondataavailable = null;
		mediaRecorder = null;
		
		for(let track of videoStream.getTracks()) {
			track.stop();
		}
		videoStream = null;
	}
	
	videos.innerHTML = "";
	videos.style.display = "none";
}

function arrangeVideos() {
	const l = videos.childElementCount;
	
	const w = Math.max(document.documentElement.clientWidth, window.innerWidth || 0) - 20;
	const h = Math.max(document.documentElement.clientHeight, window.innerHeight || 0) - 20;
	const a = Math.max(w / h, h / w);
	
	let c = l, r = 1;
	
	for(let s of primeFactors(l).concat(primeFactors(l + 1))) {
		if(Math.abs(s[0] / s[1] - a) < Math.abs(c / r - a)) {
			c = s[0];
			r = s[1];
		}
	}
	
	if(r = 1) {
		c = l;
	}
	
	if(h > w) {
		let k = c;
		c = r;
		r = k;
	}
	
	let s = hp = vp = 0;
	if(w / h > c / r) {
		s = h / r;
		hp = (w - c * s) / 2 - 10;
	}
	else {
		s = w / c;
		vp = (h - r * s) / 2 - 10;
	}
	
	
	for(let i = 0; i < l; i++) {
		const v = videos.childNodes[i];
		v.style.width = v.style.height = s + "px";
		v.style.top = Math.floor(i / c) * s + vp + "px";
		v.style.left = i % c * s + hp + "px";
	}
}

function sendMsg() {
	if(chatInput.value) {
		if(chatInput.value.startsWith("/")) {
			let parts = chatInput.value.slice(1).split(" ");
			switch(parts[0]) {
				case("leave"):
					leaveSession();
					break;
				case("video"):
					if(parts.length >= 2) {
						switch(parts[1]) {
							case("start"):
								socket.emit("video", {
									"option": "start"
								});
								break;
							case("stop"):
								socket.emit("video", {
									"option": "stop"
								});
								break;
							default:
								addChat("warn", "Unknown option '" + parts[1] + "' for video command");
								break;
						}
					}
					else {
						addChat("warn", "Video command syntax incorrect");
					}
					break;
				default:
					addChat("warn", "Unknown command");
					break;
			}
		}
		else {
			socket.emit("msg", {
				"msg": chatInput.value
			});
		}
		chatInput.value = "";
	}
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
			node.className = "panel panel-warning";
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
function leaveSession() {
	if(session.video) {
		stopVideo();
	}
	
	session = {};
	users = {};
	
	chats.innerHTML = "";
	
	socket.emit("leave-session");
	
	session_form["sessionName"].value = session_form["sessionPassword"].value = session_form["displayName"].value = "";
	showPage(0);
}

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
	if(session.status === "joining") {
		addChat("info", data.displayName + " is in the session");
	}
	else {
		addChat("info", data.displayName + " has joined the session");
		if(session.video) {
			addVideo(data.socketID);
			arrangeVideos();
		}
	}
});
socket.on("change-name", data => {
	addChat("info", users[data.socketID].displayName + " changed their name to " + data.displayName);
	users[data.socketID].displayName = data.displayName;
});
socket.on("remove-user", data => {
	if(data.socketID in users) {
		if(session.video) {
			removeVideo(data.socketID);
			arrangeVideos();
		}
		delete users[data.socketID];
	}
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

socket.on("video-res", async data => {
	if(data.success) {
		switch(data.reason) {
			case("start"):
				await startVideo();
				break;
			case("stop"):
				stopVideo();
				break;
		}
	}
	else {
		switch(data.reason) {
			case("permission"):
				addChat("error", "You do not have permission to start video");
				break;
		}
	}
});
socket.on("start-video", async () => {
	await startVideo();
});
socket.on("stop-video", () => {
	stopVideo();
});
socket.on("video-stream", data => {
	if(data.from in users) {
		if(users[data.from].buffer && !users[data.from].buffer.updating) {
			users[data.from].buffer.appendBuffer(data.chunk);
		}
	}
});