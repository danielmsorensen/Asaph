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

let config = null;

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
window.onload = () => {
	let xhr = new XMLHttpRequest();
	xhr.onreadystatechange = function($evt){
		if(xhr.readyState == 4 && xhr.status == 200){
			let res = JSON.parse(xhr.responseText);
			if(res.s === "ok") {
				config = { 
					iceServers: [ res.v.iceServers ]/*,
					sdpSemantics: "unified-plan"*/
				};
			}
		}
	}
	xhr.open("PUT", "https://global.xirsys.net/_turn/Asaph", true);
	xhr.setRequestHeader ("Authorization", "Basic " + btoa("danielmsorensen:bef556e0-7463-11ea-8996-0242ac110004") );
	xhr.setRequestHeader ("Content-Type", "application/json");
	xhr.send(JSON.stringify({"format": "urls"}) );
}

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

async function startVideo(mode) {
	if(session.video) {
		stopVideo(true);
	}
	
	session.video = mode;
	addChat("primary", "Starting " + mode + " video");
	videos.style.display = "block";
	window.scrollTo(0, document.body.scrollHeight);
	
	try {
		if(!videoStream) {
			videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
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
	users[socketID].peer = new SimplePeer({
		"initiator": users[socketID].call,
		"config": config
	});
	users[socketID].peer.on("signal", data => {
		socket.emit("signal", {
			"to": socketID,
			"signal": data
		});
	});
	
	let cont = document.createElement("div");
	cont.className = "video";
	
	let node = document.createElement("video");
	node.id = socketID;
	node.autoplay = true;
	
	cont.appendChild(node);
	videos.appendChild(cont);
	
	users[socketID].video = node;
	
	if(session.video === "normal") {
		users[socketID].peer.addStream(videoStream);
		users[socketID].peer.on("stream", stream => {
			if("srcObject" in users[socketID].video) {
				users[socketID].video.srcObject = stream;
			}
			else {
				users[socketID].video.src = URL.createObjectURL(stream);
			}
		});
	}
	else if(session.video === "sequence") {
		addSequenceVideo(socketID);
	}
	
	if(users[socketID].signal) {
		users[socketID].peer.signal(users[socketID].signal);
		delete users[socketID].signal;
	}
}

function removeVideo(socketID) {
	if(users[socketID].peer) {
		users[socketID].peer.destroy();
		users[socketID].peer = null;
	}
		
	if(users[socketID].video) {
		videos.removeChild(users[socketID].video.parentNode);
		users[socketID].video = null;
	}
}

function stopVideo(restart) {
	session.video = "";
	if(!restart) {
		addChat("primary", "Video stopped");
		videos.style.display = "none";
	}
	
	for(let socketID in users) {
		removeVideo(socketID);
	}	
	
	if(videoStream && !restart) {
		for(let track of videoStream.getTracks()) {
			track.stop();
		}
		videoStream = null;
	}
	
	videos.innerHTML = "";
}

function arrangeVideos() {
	const l = videos.childElementCount;
	
	const w = Math.max(document.documentElement.clientWidth, window.innerWidth || 0) - 20;
	const h = Math.max(document.documentElement.clientHeight, window.innerHeight || 0) - 20;
	const a = Math.max(w / h, h / w);
	
	let c = l, r = 1;
	
	const getFactors = (x) => {
		let f = [];
		for(let i = 2; i <= Math.sqrt(x); i++) {
			if(x % i === 0) {
				f.push([x / i, i]);
			}
		}
		return f
	}
	
	for(let s of getFactors(l).concat(getFactors(l + 1))) {
		if(Math.abs(s[0] / s[1] - a) < Math.abs(c / r - a)) {
			c = s[0];
			r = s[1];
		}
	}
	
	if(r === 1) {
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

function setLayers(layers) {
	if(layers && layers !== []) {
		session.layers = layers;
		
		// add delay
	}
	else {
		for(let socketID in users) {
			users[socketID].video.muted = false;
			
			// set delay to 0
		}
	}
}

async function setSequence(sequence) {
	if(sequence && sequence !== []) {		
		session.sequence = sequence;
		await startVideo("sequence");
	}
	else {		
		await startVideo("normal");
	}
}

function addSequenceVideo(socketID) {
	const index = s => {
		let sequence = [];
		for(let socketID of session.sequence) {
			if(socketID === socket.id || socketID in users) {
				sequence.push(socketID);
			}
		}
		let i = sequence.indexOf(s);
		if(i === -1) {
			i = sequence.length;
		}
		return i;
	}
	const i = index(socket.id);
	const j = index(socketID);
	
	if(i === j + 1) {
		users[socketID].streamIndex = 0;
		users[socketID].peer.on("stream", stream => {
			const v = users[session.sequence[users[socketID].streamIndex]].video;
			if("srcObject" in v) {
				v.srcObject = stream;
			}
			else {
				v.src = URL.createObjectURL(stream);
			}
			users[socketID].streamIndex += 1;
			
			for(let u in users) {
				if(i === index(u) - 1) {
					users[u].peer.addStream(stream);
					if(users[socketID].streamIndex >= i) {
						users[u].peer.addStream(videoStream);
					}
				}
			}
			
			/*const tracks = stream.getTracks();
			const a = [];
			const v = [];
			console.log("Receiving");
			for(let i = 0; i < tracks.length; i++) {
				console.log(tracks[i]);
				if(tracks[i].kind === "audio") {
					a.push(tracks[i]);
				}
				else if(tracks[i].kind === "video") {
					v.push(tracks[i]);
				}
			}
			for(let i = 0; i < a.length; i++) {
				const mediaStream = new MediaStream();
				mediaStream.addTrack(a[i]);
				mediaStream.addTrack(v[i]);
				users[session.sequence[i]].video.srcObject = mediaStream;
			}
			console.log("Sending")
			if(i < session.sequence.length) {
				const mediaStream = new MediaStream();
				for(let track of tracks.concat(videoStream.getTracks())) {
					console.log(track);
					mediaStream.addTrack(track);
				}
				
				for(let s in users) {
					if(i === index(s) - 1) {
						users[s].peer.addStream(mediaStream);
					}
				}
			}*/
		});
		users[socketID].peer.addStream(videoStream);
	}
	else {
		if((i === 0 && j === 1) || i >= j) {
			users[socketID].peer.addStream(videoStream);
		}
		if(i <= j) {
			users[socketID].video.muted = true;
			users[socketID].peer.on("stream", stream => {
				if("srcObject" in users[socketID].video) {
					users[socketID].video.srcObject = stream;
				}
				else {
					users[socketID].video.src = URL.createObjectURL(stream);
				}
			});
		}
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
				case("sequence"):
					if(parts.length > 1) {
						const sequence = [];
						for(let part of parts.slice(1)) {
							if(part === session.displayName) {
								sequence.push(socket.id);
							}
							else {
								for(let socketID in users) {
									if(part === users[socketID].displayName) {
										sequence.push(socketID);
									}
								}
							}
						}
						socket.emit("sequence", {
							"sequence": sequence,
							"useSequence": true
						});
					}
					else {
						socket.emit("sequence", {
							"useSequence": false
						});
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
	let bottom = window.innerHeight + window.scrollY >= document.body.scrollHeight;
	
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
	
	if(bottom) {
		window.scrollTo(0, document.body.scrollHeight);
	}
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
			case("taken"):
				alert("That display name is already taken");
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
		users[data.socketID].call = true;
	}
	else {
		addChat("info", data.displayName + " has joined the session");
		if(session.video) {
			if(session.video === "normal") {
				addVideo(data.socketID);
				arrangeVideos();
			}
			else if(session.video === "sequence") {
				setSequence(session.sequence);
			}
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
			if(session.video === "normal") {
				removeVideo(data.socketID);
				arrangeVideos();
			}
			else if(session.video === "sequence") {
				setSequence(session.sequence);
			}
		}
		delete users[data.socketID];
	}
	addChat("info", data.displayName + " has left the session");
});

socket.on("signal", data => {
	if(data.from in users) {
		if(users[data.from].peer) {
			users[data.from].peer.signal(data.signal);
		}
		else {
			users[data.from].signal = data.signal;
		}
	}
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
				await startVideo("normal");
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
	await startVideo("normal");
});
socket.on("stop-video", () => {
	stopVideo();
});

socket.on("layers-res", data => {
	if(data.success) {
		setLayers(data.reason);
	}
	else {
		switch(data.reason) {
			case("permission"):
				addChat("You do not have permission to set layers");
				break;
			case("params"):
				addChat("warn", "Invalid params for setting layers");
				break;
		}
	}
});
socket.on("layers", data => {
	setLayers(data.layers);
});

socket.on("sequence-res", async data => {
	if(data.success) {
		await setSequence(data.reason);
	}
	else {
		switch(data.reason) {
			case("permission"):
				addChat("You do not have permission to set sequence");
				break;
			case("params"):
				addChat("warn", "Invalid params for setting sequence");
				break;
		}
	}
});
socket.on("sequence", async data => {
	await setSequence(data.sequence);
});