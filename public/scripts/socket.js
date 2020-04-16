/* global io */

function connect() {
	const socket = io.connect(window.location.origin);
	socket.on("connect", () => {
		console.log("Connected");
	});
	socket.on("disconnect", reason => {
		console.log("Disconnected (" + reason + ")");
		if(reason === "io server disconnect") {
			socket.connect();
		}
	});
	socket.on("error", err => {
		console.error(err);
	});
}

export { connect };