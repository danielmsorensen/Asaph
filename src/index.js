const Server = require("./server");

const server = new Server.Server();

const port = 5000
server.listen(port);
console.log("Server running on port " + port);