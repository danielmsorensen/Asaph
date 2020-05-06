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

let profile, uid, token;
let session, sid, password;
describe("Web Service", () => {
	test("GET /index.html", () => {
		return request(app)
			.get("/")
			.expect(200)
			.expect("Content-Type", /html/);
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
				.then(res => {
					profile = res.body;
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
					session = res.body;
					sid = session.sid;
					password = session.password;
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
				.expect(session);
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
				.expect(Object.fromEntries(Object.entries(profile).concat([["sid", sid]])));
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
				.expect(profile);
		});
		
		test("GET sessions (invalid uid)", () => {
			return request(app)
				.get("/api/session/sessions")
				.query({
					uid: "123",
					token
				})
				.expect(401);
		});
		test("GET sessions (invalid token)", () => {
			return request(app)
				.get("/api/session/sessions")
				.query({
					uid,
					token: "123"
				})
				.expect(401);
		});
		test("GET sessions (valid access token)", () => {
			return request(app)
				.get("/api/session/sessions")
				.query({
					uid,
					token
				})
				.expect(200)
				.expect("Content-Type", /json/)
				.expect([session]);
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
		test("GET sessions (valid details - removed session)", () => {
			return request(app)
				.get("/api/session/sessions")
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
	
	describe("link", () => {
		test("POST create (create session + link)", () => {
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
					session = res.body;
					sid = session.sid;
					password = session.password;
				});
		});
		test("GET link (no access token)", () => {
			return request(app)
				.get("/link/session/" + session.link)
				.expect(200)
				.expect("Content-Type", /html/);
		});
		test("GET link (no context)", () => {
			return request(app)
				.get("/link")
				.query({
					uid,
					token
				})
				.expect(404);
		});
		test("GET link (no code)", () => {
			return request(app)
				.get("/link/session")
				.query({
					uid,
					token
				})
				.expect(404);
		});
		test("GET link (invalid code)", () => {
			return request(app)
				.get("/link/session/123")
				.query({
					uid,
					token
				})
				.expect(404);
		});
		test("GET link (invalid uid)", () => {
			return request(app)
				.get("/link/session/" + session.link)
				.query({
					uid: "123",
					token
				})
				.expect(401);
		});
		test("GET link (invalid token)", () => {
			return request(app)
				.get("/link/session/" + session.link)
				.query({
					uid,
					token: "123"
				})
				.expect(401);
		});
		test("GET link (valid details)", () => {
			return request(app)
				.get("/link/session/" + session.link)
				.query({
					uid,
					token
				})
				.expect(200)
				.expect("Content-Type", /json/)
				.expect(session);
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

 