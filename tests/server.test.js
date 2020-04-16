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

let uid, token;
describe("Testing web service", () => {
	test("GET /index.html", () => {
		return request(app)
			.get("/")
			.expect(200);
	});
	
	describe("Testing signin", () => {
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
					password: "1234"
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
				.expect(404);
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
				.expect("Content-Type", /json/)
				.expect(200, {
					email: "a@b.c",
					name: "name"
				});
		});
	});
});

 