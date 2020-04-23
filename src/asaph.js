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
				try {
					this.d = JSON.parse(data);
					for(const uid in this.d.users) {
						this.d.users[uid] = User.parse(this.d.users[uid]);
					}
					for(const sid in this.d.sessions) {
						this.d.sessions[sid] = Session.parse(this.d.sessions[sid]);
					}
				}
				catch(err2) {
					if(err2.name !== "SyntaxError") {
						throw err2;
					}
				}
			}
			this.assertData();
		});
	}
	
	assertData() {
		this.d = this.d || {};
		this.d.users = this.d.users || {};
		this.d.sessions = this.d.sessions || {};
		
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
	
	static createResult(result) {
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
	static createReason(reason) {
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
	
	static generateID() {
		return Math.random().toString(36).slice(2);
	}
	static generateUniqueID(ids) {
		let id;
		do {
			id = Asaph.generateID();
		}
		while(ids.includes(id));
		return id;
	}
	
	static hash(value) {
		return passwordHash.generate(value);
	}
	static isHash(value, hash) {
		return passwordHash.verify(value, hash);
	}
	
	login(email, pw) {
		for(const uid in this.d.users) {
			if(this.d.users[uid].email === email) {
				if(Asaph.isHash(pw, this.d.users[uid].pwHash)) {
					this.d.users[uid].generateToken();
					this.writeData();
					
					return Asaph.createResult(this.d.users[uid].getAccessToken());
				}
				else {
					return Asaph.createReason(401);
				}
			}
		}
		return Asaph.createReason(404);
	}
	createAccount(email, pw, name) {
		for(const uid in this.d.users) {
			if(this.d.users[uid].email === email) {
				return Asaph.createReason(409);
			}
		}
		
		const uid = Asaph.generateUniqueID(Object.keys(this.d.users));
		this.d.users[uid] = new User(uid, email, Asaph.hash(pw), name);
		this.writeData();
		
		return Asaph.createResult(this.d.users[uid].getAccessToken());
	}
	
	verifyUser(uid, token, callback) {
		if(uid in this.d.users) {
			if(this.d.users[uid].token === token) {
				if(callback) {
					return callback(this.d.users[uid]);
				}
				else {
					return Asaph.createResult();
				}
			}
			else {
				return Asaph.createReason(401);
			}
		}
		else {
			return Asaph.createReason(401);
		}
	}
	signout(uid, token) {
		return this.verifyUser(uid, token, user => { 
			user.token = "";
			this.writeData();
			
			return Asaph.createResult();
		});
	}
	
	getProfile(uid, token) {
		return this.verifyUser(uid, token, user => Asaph.createResult(user.getProfile()));
	}
	setProfile(profile, uid, token) {
		return this.verifyUser(uid, token, user => {
			if(user.setProfile(profile)) {
				this.writeData();
				
				return Asaph.createResult();
			}
			else {
				return Asaph.createReason(409);
			}				
		});
	}
	
	verifySession(sid, pw, callback) {
		if(sid in this.d.sessions) {
			if(this.d.sessions[sid].pw === pw) {
				if(callback) {
					return callback(this.d.sessions[sid]);
				}
				else {
					return Asaph.createResult();
				}
			}
			else {
				return Asaph.createReason(403);
			}
		}
		else {
			return Asaph.createReason(404);
		}
	}
	createSession(name, pw, uid, token) {
		return this.verifyUser(uid, token, user => {		
			const sid = Asaph.generateUniqueID(Object.keys(this.d.sessions));
			this.d.sessions[sid] = new Session(sid, name, pw, uid);
			
			this.d.sessions[sid].registerUser(uid, {
				owner: true,
				admin: true
			});
			user.addSession(sid, pw);
			
			this.writeData();
			
			return Asaph.createResult(this.d.sessions[sid].getPublic());
		});
	}
	joinSession(sid, pw, uid, token, save) {
		return this.verifyUser(uid, token, user => {
			return this.verifySession(sid, pw, session => {
				session.registerUser(uid);
				user.sid = sid;
				
				if(save) {
					user.addSession(sid, pw);
				}
				
				this.writeData();
				
				return Asaph.createResult(this.d.sessions[sid].getPublic());
			});
		});
	}
	leaveSession(uid, token) {
		return this.verifyUser(uid, token, user => {
			user.sid = "";
			this.writeData();
			return Asaph.createResult();
		});
	}
	
	verifyUserSession(uid, token, callback) {
		return this.verifyUser(uid, token, user => {
			if(user.sid && user.sid in this.d.sessions) {
				if(uid in this.d.sessions[user.sid].users) {
					if(callback) {
						return callback(user, this.d.sessions[user.sid]);
					}
					else {
						return Asaph.createResult();
					}
				}
				else {
					return Asaph.createReason(403);
				}
			}
			else {
				return Asaph.createReason(403);
			}
		});
	}
	
	getSessions(uid, token) {
		return this.verifyUser(uid, token, user => Asaph.createResult(Object.keys(user.sessions).map(sid => this.d.sessions[sid].getPublic())));
	}
	removeSession(sid, uid, token) {
		return this.verifyUser(uid, token, user => {
			if(sid in user.sessions) {			
				this.verifySession(sid, user.sessions[sid], session => {
					if(session.owner === uid) {
						delete this.d.sessions[sid];
					}
				});
				
				delete user.sessions[sid];
				this.writeData();
				
				return Asaph.createResult();
			}
			else {
				return Asaph.createReason(404);
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
		
		this.sessions = {};
		this.sid = "";
	}
	static parse(json) {
		const user = new User();
		for(const key in json) {
			user[key] = json[key];
		}
		return user;
	}
	
	generateToken() {
		this.token = Asaph.generateID();
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
			name: this.name,
			sid: this.sid
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
	
	addSession(sid, pw) {
		this.sessions = this.sessions || {};
		this.sessions[sid] = pw;
	}
	removeSession(sid) {
		if(this.sessions && sid in this.sessions) {
			delete this.sessions[sid];
		}
	}
}

class Session {
	constructor(sid, name, pw, owner) {
		this.sid = sid;
		this.name = name;
		this.pw = pw;
		
		this.owner = owner;
		
		this.users = {};
	}
	static parse(json) {
		const session = new Session();
		for(const key in json) {
			session[key] = json[key];
		}
		return session;
	}
	
	getPublic() {
		return {
			sid: this.sid,
			name: this.name,
			password: this.pw,
			owner: this.owner
		};
	}
	
	registerUser(uid, config) {
		this.users[uid] = this.users[uid] || {};
		if(config) {
			Object.assign(this.users[uid], config);
		}
	}
}

module.exports = { Asaph, User, Session };