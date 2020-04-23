const fs = require("fs");
const request = require("supertest");
const Server = require("../src/server");

const dataFile = "tests/data.json";
try {
	fs.unlinkSync(dataFile);
}
catch(err) {
	if(err.code !== "ENOENT") {
		console.error(err);
	}
}

const server = new Server({
	dataFile,
	httpsOpts: {
		key: fs.readFileSync("key.pem"),
		cert: fs.readFileSync("cert.pem")
	}
});
const app = server.app;

let uid, token, sid, name, password;
describe("Web Service", () => {
	test("GET /index.html", () => {
		return request(app)
			.get("/")
			.expect(200);
	});
	
	describe("account API", () => {
		test("POST create (valid account)", () => {
			return request(app)
				.post("/api/account/create")
				.send({
					email: "a@b.c",
					password: "123",
					name: "name"
				})
				.expect(200);
		});
		test("POST create (existing email)", () => {
			return request(app)
				.post("/api/account/create")
				.send({
					email: "a@b.c",
					password: "123",
					name: "name"
				})
				.expect(409);
		});
		
		test("POST login (wrong email)", () => {
			return request(app)
				.post("/api/account/login")
				.send({
					email: "d@e.f",
					password: "123"
				})
				.expect(404);
		});
		test("POST login (wrong pw)", () => {
			return request(app)
				.post("/api/account/login")
				.send({
					email: "a@b.c",
					password: "456"
				})
				.expect(401);
		});
		test("POST login (valid account)", () => {
			return request(app)
				.post("/api/account/login")
				.send({
					email: "a@b.c",
					password: "123"
				})
				.expect(200)
				.expect("Content-Type", /json/)
				.then(res => {
					uid = res.body.uid;
					token = res.body.token;
				});
		});
		
		test("GET profile (invalid uid)", () => {
			return request(app)
				.get("/api/account/profile")
				.query({
					uid: "123",
					token
				})
				.expect(401);
		});
		test("GET profile (invalid token)", () => {
			return request(app)
				.get("/api/account/profile")
				.query({
					uid,
					token: "123"
				})
				.expect(401);
		});
		test("GET profile (valid access token)", () => {
			return request(app)
				.get("/api/account/profile")
				.query({
					uid,
					token
				})
				.expect(200)
				.expect("Content-Type", /json/)
				.expect({
					email: "a@b.c",
					name: "name",
					sid: ""
				});
		});
	});
	describe("session API", () => {
		test("POST create (invalid uid)", () => {
			return request(app)
				.post("/api/session/create")
				.send({
					name: "name",
					password: "123",
					uid: "123",
					token
				})
				.expect(401);
		});
		test("POST create (invalid token)", () => {
			return request(app)
				.post("/api/session/create")
				.send({
					name: "name",
					password: "123",
					uid,
					token: "123"
				})
				.expect(401);
		});
		test("POST create (valid access token)", () => {
			return request(app)
				.post("/api/session/create")
				.send({
					name: "name",
					password: "123",
					uid,
					token
				})
				.expect(200)
				.expect("Content-Type", /json/)
				.then(res => {
					sid = res.body.sid;
					name = res.body.name;
					password = res.body.password;
				});
		});
		
		test("POST join (invalid uid)", () => {
			return request(app)
				.post("/api/session/join")
				.send({
					sid,
					password,
					uid: "123",
					token
				})
				.expect(401);
		});
		test("POST join (invalid token)", () => {
			return request(app)
				.post("/api/session/join")
				.send({
					sid,
					password,
					uid,
					token: "123"
				})
				.expect(401);
		});
		test("POST join (wrong sid)", () => {
			return request(app)
				.post("/api/session/join")
				.send({
					sid: "123",
					password,
					uid,
					token
				})
				.expect(404);
		});
		test("POST join (wrong spw)", () => {
			return request(app)
				.post("/api/session/join")
				.send({
					sid,
					password: "456",
					uid,
					token
				})
				.expect(403);
		});
		test("POST join (valid details)", () => {
			return request(app)
				.post("/api/session/join")
				.send({
					sid,
					password,
					uid,
					token
				})
				.expect(200)
				.expect("Content-Type", /json/)
				.expect({
					sid,
					name,
					password,
					owner: uid
				});
		});
		test("GET profile (valid access token - joined session)", () => {
			return request(app)
				.get("/api/account/profile")
				.query({
					uid,
					token
				})
				.expect(200)
				.expect("Content-Type", /json/)
				.expect({
					email: "a@b.c",
					name: "name",
					sid
				});
		});
		
		test("POST leave (invalid uid)", () => {
			return request(app)
				.post("/api/session/leave")
				.send({
					uid: "123",
					token
				})
				.expect(401);
		});
		test("POST leave (invalid token)", () => {
			return request(app)
				.post("/api/session/leave")
				.send({
					uid,
					token: "123"
				})
				.expect(401);
		});
		test("POST leave (valid access token)", () => {
			return request(app)
				.post("/api/session/leave")
				.send({
					uid,
					token
				})
				.expect(200);
		});
		test("GET profile (valid access token - left session)", () => {
			return request(app)
				.get("/api/account/profile")
				.query({
					uid,
					token
				})
				.expect(200)
				.expect("Content-Type", /json/)
				.expect({
					email: "a@b.c",
					name: "name",
					sid: ""
				});
		});
		
		test("GET get (invalid uid)", () => {
			return request(app)
				.get("/api/session/get")
				.query({
					uid: "123",
					token
				})
				.expect(401);
		});
		test("GET get (invalid token)", () => {
			return request(app)
				.get("/api/session/get")
				.query({
					uid,
					token: "123"
				})
				.expect(401);
		});
		test("GET get (valid access token)", () => {
			return request(app)
				.get("/api/session/get")
				.query({
					uid,
					token
				})
				.expect(200)
				.expect("Content-Type", /json/)
				.expect([{
					sid,
					name,
					password,
					owner: uid
				}]);
		});
		
		test("POST remove (invalid uid)", () => {
			return request(app)
				.post("/api/session/remove")
				.send({
					sid,
					uid: "123",
					token
				})
				.expect(401);
		});
		test("POST remove (invalid token)", () => {
			return request(app)
				.post("/api/session/remove")
				.send({
					sid,
					uid,
					token: "123"
				})
				.expect(401);
		});
		test("POST remove (wrong sid)", () => {
			return request(app)
				.post("/api/session/remove")
				.send({
					sid: "123",
					uid,
					token
				})
				.expect(404);
		});
		test("POST remove (valid details)", () => {
			return request(app)
				.post("/api/session/remove")
				.send({
					sid,
					uid,
					token
				})
				.expect(200);
		});
		test("GET get (valid details - removed session)", () => {
			return request(app)
				.get("/api/session/get")
				.query({
					uid,
					token
				})
				.expect(200)
				.expect("Content-Type", /json/)
				.expect([]);
		});
		test("POST join (valid details - removed session)", () => {
			return request(app)
				.post("/api/session/join")
				.send({
					sid,
					password,
					uid,
					token
				})
				.expect(404);
		});
	});
	describe("signout", () => {
		test("POST signout (invalid uid)", () => {
			return request(app)
				.post("/api/account/signout")
				.send({
					uid: "123",
					token
				})
				.expect(401);
		});
		test("POST signout (invalid token)", () => {
			return request(app)
				.post("/api/account/signout")
				.send({
					uid,
					token: "123"
				})
				.expect(401);
		});
		test("POST signout", () => {
			return request(app)
				.post("/api/account/signout")
				.send({
					uid,
					token
				})
				.expect(200);
		});
		test("GET profile (old token)", () => {
			return request(app)
				.get("/api/account/profile")
				.query({
					uid,
					token
				})
				.expect(401);
		});
	});
});

 