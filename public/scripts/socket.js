/* global io */
const { SimplePeer } = window;

let socket;
let users = {};

let videos, localStream;

function connect(uid, token) {
	return new Promise(res => {
		socket = io.connect(window.location.origin);
		
		socket.on("connect", () => {
			console.log("Connected");
			socket.emit("join", {
				uid,
				token
			});
		});
		socket.on("disconnect", reason => {
			console.log("Disconnected (" + reason + ")");
			if(reason === "io server disconnect") {
				socket.connect();
			}
			disconnect();
		});
		socket.on("error", err => {
			disconnect();
			throw err;
		});
		
		socket.on("res", data => {
			switch(data.eventName) {
				case "join":
					if(data.success) {
						res(data.result);
						join();
					}
					else {
						res();
						alert("Error: " + data.reason);
					}
					break;
			}
		});
		
		socket.on("user-connected", data => {
			console.log("User Connected " + JSON.stringify(data));
			users[data.socketID] = data.user;
			users[data.socketID].call = Boolean(data.call);
			addUser(data.socketID);
		});
		socket.on("user-disconnected", data => {
			console.log("User Disconnected " + JSON.stringify(data));
			
			removeUser(data.socketID);
		});
		
		socket.on("signal", data => {
			if(data.from in users) {
				users[data.from].peer.signal(data.signal);
			}
		});
	});
}

function createVideo(id, tag) {
	const cont = document.createElement("div");
	cont.className = "video";
	
	const node = document.createElement("video");
	node.id = id;
	node.autoplay = true;
	
	const name = document.createElement("span");
	name.innerHTML = tag;
	name.className = "text-monospace text-secondary bg-dark px-3 py-1 rounded-lg";
	name.style.fontSize = "5vmin";
	name.style.opacity = 0.5;
	
	cont.appendChild(node);
	cont.appendChild(name);
	videos.appendChild(cont);
	
	arrangeVideos();
	
	return node;
}
function join() {
	users = {};
	videos = document.getElementById("videos");
	
	const node = createVideo(socket.id, "You");
	node.muted = true;
	node.style.transform = "scale(-1, 1)";
	
	navigator.mediaDevices.getUserMedia({
		video: true,
		audio: true
	}).then(stream => {
		localStream = stream;
		
		if("srcObject" in node) {
			node.srcObject = stream;
		}
		else {
			node.src = URL.createObjectURL(stream);
		}
		
		for(const socketID in users) {
			users[socketID].peer.addStream(stream);
		}
	});
}
function disconnect() {	
	if(socket.connected) {
		socket.close();
	}

	for(const socketID in users) {
		removeUser(socketID);
	}
	
	videos.innerHTML = "";
	
	if(localStream) {
		localStream.getTracks().forEach(track => track.stop());
		localStream = null;
	}
}

function addUser(socketID) {
	users[socketID].peer = new SimplePeer({
		initiator: users[socketID].call,
		config: window.config
	});
	
	users[socketID].peer.on("signal", signal => {
		socket.emit("signal", {
			to: socketID,
			signal
		});
	});
	
	users[socketID].video = createVideo(socketID, users[socketID].name);
	
	users[socketID].peer.on("stream", stream => {
		if("srcObject" in users[socketID].video) {
			users[socketID].video.srcObject = stream;
		}
		else {
			users[socketID].video.src = URL.createObjectURL(stream);
		}
	});
	
	if(localStream) {
		users[socketID].peer.addStream(localStream);
	}
}
function removeUser(socketID) {
	if(socketID in users) {
		if(users[socketID].peer) {
			users[socketID].peer.destroy();
		}
		
		if(users[socketID].video) {
			videos.removeChild(users[socketID].video.parentNode);
			arrangeVideos();
		}
		
		delete users[socketID];
	}
}
function arrangeVideos() {
	if(!videos) {
		return;
	}
	
	const l = videos.childElementCount;
	
	const w = videos.clientWidth;
	const h = videos.clientHeight;
	const a = Math.max(w / h, h / w);
	
	let c = l, r = 1;
	
	const getFactors = (x) => {
		const f = [];
		for(let i = 2; i <= Math.sqrt(x); i++) {
			if(x % i === 0) {
				f.push([x / i, i]);
			}
		}
		return f;
	};
	
	for(const f of getFactors(l).concat(getFactors(l + 1))) {
		if(Math.abs(f[0] / f[1] - a) < Math.abs(c / r - a)) {
			c = f[0];
			r = f[1];
		}
	}
	
	if(r === 1) {
		c = l;
	}
	
	if(h > w) {
		[c, r] = [r, c];
	}
	
	let s = 0, hp = 0, vp = 0;
	if(w / h > c / r) {
		s = h / r;
		hp = (w - c * s) / 2;
	}
	else {
		s = w / c;
		vp = (h - r * s) / 2;
	}
	
	
	for(let i = 0; i < l; i++) {
		const v = videos.childNodes[i];
		v.style.width = v.style.height = s + "px";
		v.style.top = Math.floor(i / c) * s + vp + "px";
		v.style.left = i % c * s + hp + "px";
	}
}

function getConfig() {
	const xhr = new XMLHttpRequest();
	xhr.onreadystatechange = () => {
		if(xhr.readyState == 4 && xhr.status == 200){
			const res = JSON.parse(xhr.responseText);
			if(res.s === "ok") {
				window.config = { 
					iceServers: [ res.v.iceServers ]
				};
			}
		}
	};
	xhr.open("PUT", "https://global.xirsys.net/_turn/Asaph", true);
	xhr.setRequestHeader ("Authorization", "Basic " + btoa("danielmsorensen:bef556e0-7463-11ea-8996-0242ac110004") );
	xhr.setRequestHeader ("Content-Type", "application/json");
	xhr.send(JSON.stringify({"format": "urls"}) );
}

export { connect, disconnect, getConfig, arrangeVideos };