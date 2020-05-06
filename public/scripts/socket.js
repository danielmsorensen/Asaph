/* global io */
const { SimplePeer } = window;

let socket, local;
let users = {};

let videos;

function connect(user) {
	return new Promise(res => {
		local = user;
		
		socket = io.connect(window.location.origin);
		
		socket.on("connect", () => {
			console.log("Connected");
			socket.emit("join", {
				uid: user.uid,
				token: user.token
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
			console.error(err.message);
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
			users[data.socketID] = data.user;
			users[data.socketID].call = !!data.call;
			addUser(data.socketID);
		});
		socket.on("user-disconnected", data => {
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
	
	const video = document.createElement("video");
	video.id = id;
	video.autoplay = true;
	video.playsinline = true;
	
	const name = document.createElement("span");
	name.innerHTML = tag;
	name.className = "text-secondary bg-dark px-3 py-1 rounded-lg";
	name.style.opacity = 0.5;
	
	cont.appendChild(video);
	cont.appendChild(name);
	videos.appendChild(cont);
	
	arrangeVideos();
	
	return video;
}
function join() {
	users = {};
	videos = document.getElementById("videos");
	
	local.video = createVideo(socket.id, local.profile.name + "<small> (you)</small>");
	local.video.autoplay = true;
	local.video.muted = true;
	local.video.style.transform = "scale(-1, 1)";
	
	changeMediaDevices(local.media);
}
function disconnect() {	
	if(socket.connected) {
		socket.close();
	}

	for(const socketID in users) {
		removeUser(socketID);
	}
	
	videos.innerHTML = "";
	
	if(local.stream) {
		local.stream.getTracks().forEach(track => track.stop());
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
	
	if(local.stream) {
		users[socketID].peer.addStream(local.stream);
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

function changeMediaDevices() {
	if(!local) {
		return;
	}
	
	for(const socketID in users) {
		if(local.stream) {
			users[socketID].peer.removeStream(local.stream);
		}
	}
	
	if(local.stream) {
		local.stream.getTracks().forEach(track => track.stop());
	}
	
	const setStream = stream => {
		local.stream = stream;
		
		if("srcObject" in local.video) {
			local.video.srcObject = stream;
		}
		else {
			local.video.src = URL.createObjectURL(stream);
		}
		
		if(stream) {
			for(const socketID in users) {
				users[socketID].peer.addStream(stream);
			}
		}
	};
	
	if(local.media.muteVid && local.media.muteMic) {
		setStream(null);
	}
	else {
		navigator.mediaDevices.getUserMedia({
			video: local.media.muteVid ? false : { deviceId: local.media.vid },
			audio: local.media.muteMic ? false : { deviceId: local.media.mic }
		}).then(setStream);
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
		
		v.querySelector("span").style.fontSize = s / 20 + "px";
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

export { connect, disconnect, getConfig, arrangeVideos, changeMediaDevices };