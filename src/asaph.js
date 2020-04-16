const fs = require("fs");
const path = require("path");
const passwordHash = require("password-hash");

class Asaph {
	constructor(opts) {
		this.init(opts);
	}
	
	init(opts) {
		this.dataFile = opts.dataFile || "data/data.json";
		fs.readFile(this.dataFile, (err, data) => {
			if(!err) {
				this.d = JSON.parse(data);
				for(const uid in this.d.users) {
					this.d.users[uid] = User.parse(this.d.users[uid]);
				}
			}
			this.assertData();
		});
	}
	
	assertData() {
		this.d = this.d || {};
		this.d.users = this.d.users || {};
		
		this.writeData();
	}
	writeData() {
		fs.mkdir(path.dirname(this.dataFile), { recursive: true }, err => {
			if(err) {
				throw err;
			}
			else {
				fs.writeFile(this.dataFile, JSON.stringify(this.d), err2 => {
					if(err2) {
						throw err2;
					}
				});
			}
		});
	}
	
	createResult(result) {
		if(result) {
			return {
				success: true,
				result
			};
		}
		else {
			return {
				success: true
			};
		}
	}
	createReason(reason) {
		if(reason) {
			return {
				succes: false,
				reason
			};
		}
		else {
			return {
				success: false
			};
		}
	}
	
	createUID() {
		let uid;
		do {
			uid = Math.random().toString(36).slice(2);
		}
		while(uid in this.d.users);
		return uid;
	}
	
	hash(value) {
		return passwordHash.generate(value);
	}
	isHash(value, hash) {
		return passwordHash.verify(value, hash);
	}
	
	login(email, pw) {
		for(const uid in this.d.users) {
			if(this.d.users[uid].email === email) {
				if(this.isHash(pw, this.d.users[uid].pwHash)) {
					this.d.users[uid].generateToken();
					this.writeData();
					
					return this.createResult(this.d.users[uid].getAccessToken());
				}
				else {
					return this.createReason(401);
				}
			}
		}
		return this.createReason(404);
	}
	createAccount(email, pw, name) {
		for(const uid in this.d.users) {
			if(this.d.users[uid].email === email) {
				return this.createReason(409);
			}
		}
		
		const uid = this.createUID();
		this.d.users[uid] = new User(uid, email, this.hash(pw), name);
		this.writeData();
		
		return this.createResult(this.d.users[uid].getAccessToken());
	}
	
	verify(uid, token, callback) {
		if(uid in this.d.users) {
			if(this.d.users[uid].token === token) {
				if(callback) {
					return callback(this.d.users[uid]);
				}
				else {
					return this.createResult();
				}
			}
			else {
				return this.createReason(401);
			}
		}
		else {
			return this.createReason(404);
		}
	}
	signout(uid, token) {
		return this.verify(uid, token, user => { 
			user.token = "";
			this.writeData();
			
			return this.createResult();
		});
	}
	
	getProfile(uid, token) {
		return this.verify(uid, token, user => this.createResult(user.getProfile()));
	}
	setProfile(uid, token, profile) {
		return this.verify(uid, token, user => {
			if(user.setProfile(profile)) {
				this.writeData();
				
				return this.createResult();
			}
			else {
				return this.createReason(403);
			}				
		});
	}
}

class User {
	constructor(uid, email, pwHash, name) {
		this.uid = uid;
		this.email = email;
		this.pwHash = pwHash;
		
		this.name = name;
	}
	static parse(json) {
		const user = new User();
		for(const key in json) {
			user[key] = json[key];
		}
		return user;
	}
	
	generateToken() {
		this.token = Math.random().toString(36).slice(2);
		return this.token;
	}
	getAccessToken() {
		if(!this.token) {
			this.generateToken();
		}
		return {
			uid: this.uid,
			token: this.token
		};

	}
	
	getProfile() {
		return {
			email: this.email,
			name: this.name
		};
	}
	setProfile(profile) {
		for(const key in profile) {
			if(key !== "uid" && key !== "pwHash" && key !== "token") {
				this[key] = profile[key];
			}
			else {
				return false;
			}
		}
		return true;
	}
}

module.exports = { Asaph, User };