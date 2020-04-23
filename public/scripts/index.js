import { request } from "./fetch.js";
import { connect, disconnect, getConfig, arrangeVideos } from "./socket.js";

$(document).ready(() => {
	centerVertical();
	$("#signin").on("shown.bs.collapse", centerVertical);
	$("#signin").on("hidden.bs.collapse", centerVertical);
	
	$("#home_join").on("shown.bs.collapse", centerVertical);
	$("#home_join").on("hidden.bs.collapse", centerVertical);
	$("#home_create").on("shown.bs.collapse", centerVertical);
	$("#home_create").on("hidden.bs.collapse", centerVertical);
	
	if(Storage) {
		signin(localStorage.getItem("uid"), localStorage.getItem("token"));
	}
});
$(window).on("load", () => {
	getConfig();
});

const windowChange = () => {
	centerVertical();
	arrangeVideos();
};
$(window).resize(windowChange);
$(window).on("orientationchange", windowChange);

function showModal(title, body, buttons) {
	$("#modal .modal-title").html(title);
	$("#modal .modal-body").html(body);
	$("#modal .modal-footer").html("");
	for(const b of buttons) {
		$("#modal .modal-footer").append(
			$(`<button class="btn ${b.context ? "btn-" + b.context : ""}" ${b.close == false ? "" : "data-dismiss=\"modal\""}>${b.text}</button>`)
				.click(b.onclick)
		);
	}
	$("#modal").modal("show");
}
function alertModal(title, body, context) {
	return new Promise(res => {
		showModal(title, body, [
			{
				text: "Close",
				context: context || "secondary",
				close: true,
				onclick: res
			}
		]);
	});
}
function confirmModal(title, body, context1, context2) {
	return new Promise(res => {
		showModal(title, body, [
			{
				text: "Confirm",
				context: context1 || "primary",
				close: true,
				onclick: () => res(true)
			},
			{
				text: "Cancel",
				context: context2 || "secondary",
				close: true,
				onclick: () => res(false)
			}
		]);
	});
}

function centerVertical() {
	if($("#inner").height() > $("#outer").height()) {
		$("#inner").addClass("overflow");
	}
	else {
		$("#inner").removeClass("overflow");
	}
}

let signinPage = 0;
function showLogin() {
	if(signinPage === 1) {
		$("#signin").collapse("hide");
		signinPage = 0;
	}
	else {
		$("#signin_create-form").hide("fast");
		$("#signin_login-form").show("fast", centerVertical);
		if(signinPage === 0) {
			$("#signin").collapse("show");
		}
		signinPage = 1;
	}
	$("#signin_alert").css("visibility", "hidden");
}
function showCreate() {
	if(signinPage === 2) {
		$("#signin").collapse("hide");
		signinPage = 0;
	}
	else {
		$("#signin_login-form").hide("fast");
		$("#signin_create-form").show("fast", centerVertical);
		if(signinPage === 0) {
			$("#signin").collapse("show");
		}
		signinPage = 2;
	}
	$("#signin_alert").css("visibility", "hidden");
}

let user = {};
async function signin(uid, token) {
	if(uid && token) {
		const data = await request("GET", "api/account/profile", { uid, token });
		if(data.success) {
			if(Storage) {
				localStorage.setItem("uid", uid);
				localStorage.setItem("token", token);
			}
			
			user.uid = uid;
			user.token = token;
			user.profile = data.result;
			
			if(data.result.sid) {
				loadSession();
			}
			else {			
				$("#home_name").text("Logged in as " + data.result.name);
				
				$("#page_signin").hide("fast");
				$("#page_home").show("fast", centerVertical);
				
				getSessions();
			}
			
			return true;
		}
		else {
			signout();
			await alertModal("Error Signing In", data.reason === 401 ? "Session Signed Out" : "Bad Request");
		}
	}
	return false;
}
async function login() {
	const form = document.forms["signin_login-form"];
	const email = form.signin_login_email.value;
	const password = form.signin_login_pw.value;

	if(email && password) {
		const data = await request("POST", "api/account/login", { email, password });
		if(data.success) {
			form.reset();
			$("#signin_alert").css("visibility", "hidden");
			await signin(data.result.uid, data.result.token);
		}
		else {
			$("#signin_alert").css("visibility", "visible");
			switch(data.reason) {
				case 404:
				case 401:
					$("#signin_alert").text("Email or password incorrect");
					break;
				case 400:
					$("#signin_alert").text("Bad Request");
					break;
			}
		}
	}
	else {
		$("#signin_alert").css("visibility", "visible");
		$("#signin_alert").text("Empty fields");
	}
}
async function createAccount() {
	const form = document.forms["signin_create-form"];
	
	const name = form.signin_create_name.value;
	const email = form.signin_create_email.value;
	const cEmail = form.signin_create_conf_email.value;
	const password = form.signin_create_pw.value;
	const cPw = form.signin_create_conf_pw.value;

	if(name && email && cEmail && password && cPw) {
		if(email === cEmail) {
			if(password === cPw) {
				const data = await request("POST", "api/account/create", { email, password, name });
				if(data.success) {
					form.reset();
					$("#signin_alert").css("visibility", "hidden");
					await signin(data.result.uid, data.result.token);
				}
				else {
					$("#signin_alert").css("visibility", "visible");
					switch(data.reason) {
						case 409:
							$("#signin_alert").text("That email address is already in use");
							break;
						case 400:
							$("#signin_alert").text("Bad Request");
							break;
					}
				}
			}
			else {
				$("#signin_alert").css("visibility", "visible");
				$("#signin_alert").text("Passwords do not match");
			}
		}
		else {
			$("#signin_alert").css("visibility", "visible");
			$("#signin_alert").text("Email addresses do not match");
		}
	}
	else {
		$("#signin_alert").css("visibility", "visible");
		$("#signin_alert").text("Empty fields");
	}
}
function account() {
	
}
function signout() {
	if(user && user.uid && user.token) {
		request("POST", "api/account/signout", {
			"uid": user.uid,
			"token": user.token
		});
	}
	
	if(Storage) {
		localStorage.removeItem("uid");
		localStorage.removeItem("token");
	}
	
	user = {};
	
	$("#page_home").hide("fast");
	$("#page_signin").show("fast", centerVertical);
}

async function joinSession(sid, password) {
	const form = document.forms["home_join-form"];
	
	sid = sid || form.home_join_sid.value;
	password = password || form.home_join_pw.value;
	const save = form.home_join_save.checked;
	
	if(sid && password) {
		form.className = "";
		
		const data = await request("POST", "api/session/join", { sid, password, "uid": user.uid, "token": user.token, save });
		if(data.success) {
			if(await confirmModal("Join Session", "Are you sure you want to join the session '" + data.result.name + "'?")) {
				loadSession(sid, password);
			}
			else {
				await leftSession();
			}
		}
		else {
			switch(data.reason) {
				case 401:
					await alertModal("Error Joining Session", "Session Signed Out");
					signout();
					break;
				case 403:
					await alertModal("Error Joining Session", "Invalid Session Password");
					break;
				case 404:
					await alertModal("Error Joining Session", "Invalid Session ID");
					break;
				case 400:
					await alertModal("Error Joining Session", "Error: Bad Request", "danger");
					break;
			}
		}
	}
	else {
		form.className = "was-validated";
	}
}
async function createSession() {
	const form = document.forms["home_create-form"];
	
	const name = form.home_create_name.value;
	const password = form.home_create_pw.value;
	
	if(name && password) {
		form.className = "";
		
		if(await confirmModal("Create Session", "Are you sure you want to create the session?<br /> - Name: " + name, " - Password: " + password)) {
			const data = await request("POST", "api/session/create", { name, password, "uid": user.uid, "token": user.token });
			if(data.success) {
				const data2 = await request("POST", "api/session/join", { "sid": data.result.sid, password, "uid": user.uid, "token": user.token });
				if(data2.success) {
					loadSession(data.result.sid, password);
				}
				else {
					await alertModal("Error Joining Session", "Unexpected Error: " + data2.reason);
				}
			}
			else {
				switch(data.reason) {
					case 401:
						await alertModal("Error Joining Session", "Session Signed Out");
						signout();
						break;
					case 400:
						await alertModal("Error Joining Session", "Error: Bad Request", "danger");
						break;
				}
			}
		}
	}
	else {
		form.className = "was-validated";
	}
}
async function leftSession() {
	user.session = null;
	const data = await request("POST", "api/session/leave", { uid: user.uid, token: user.token });
	if(!data.success) {
		switch(data.reason) {
			case 401:
				await alertModal("Error Leaving Session", "Session Signed Out");
				signout();
				break;
			case 400:
				await alertModal("Error Leaving Session", "Error: Bad Request", "danger");
				break;
		}
	}
	return data.success;
}
async function leaveSession() {
	if(await confirmModal("Leave Session", "Are you sure you want to leave the session?", "danger")) {
		disconnect();
		if(await leftSession()) {		
			$("#page_video").hide("fast");
			$("#inner").show("fast");
			await signin(user.uid, user.token);
		}
	}
}

async function removeSession(sid) {
	const data = await request("POST", "api/session/remove", { sid, uid: user.uid, token: user.token });
	if(data.success) {
		await getSessions();
	}
	else {
		alertModal("Error Removing Session", "Error: " + data.reason, "danger");
	}
}
async function getSessions() {
	$("#home_join-table tbody").html("");
	const data = await request("GET", "api/session/get", { uid: user.uid, token: user.token });
	if(data.success) {
		if(data.result.length > 0) {
			for(const session of data.result) {
				const owner = session.owner === user.uid;
				
				const node = document.createElement("tr");
				node.id = session.sid;
				node.innerHTML = `
					<td>${session.name}</td>
					<td>${session.sid}</td>
					<td><div class="btn-group float-right">
						<button class="btn btn-info fa" type="button">&#xf05a;</button>
						<button class="btn btn-danger" type="button">&times;</button>
					</div></td>
				`;
				node.style.cursor = "pointer";
				node.className = owner ? "table-primary" : "";
				node.onclick = () => {
					joinSession(session.sid, session.password);
				};
				
				if(owner) {
					$("#home_join-table tbody").prepend(node);
				}
				else {
					$("#home_join-table tbody").append(node);
				}
				$(`#${session.sid} button:nth-child(1)`).click((event) => {
					sessionInfo(session);
					event.stopPropagation();
				});
				$(`#${session.sid} button:nth-child(2)`).click((event) => {
					showModal(
						owner ? "Delete Session" : "Remove Session",
						owner ? "Are you sure you want to permanently delete this session?" : "Are you sure you want to forget this session?",
						[{ text: owner ? "Delete" : "Remove", context: "danger", onclick: () => removeSession(session.sid) }, { text: "Cancel", context: "secondary" }]
					);
					event.stopPropagation();
				});
			}
		}
		else {
			$("#home_join-table tbody").append("<td class=\"text-right\">no saved sessions</td>");
		}
	}
	else {
		switch(data.reason) {
			case 401:
				await alertModal("Error Getting Sessions", "Session Signed Out");
				signout();
				break;
			case 400:
				await alertModal("Error Getting Sessions", "Error: Bad Request", "danger");
				break;
		}
	}
}

function loadSession() {
	$("#inner").hide("fast");
	$("#page_video").show("fast", async () => {
		user.session = await connect(user.uid, user.token);
		if(user.session) {
			$("#video_session-name").html(user.session.name);
		}
	});
}

function sessionInfo(session) {
	session = session || user.session;
	showModal("Session Info", `
		<div class="form-group">
			<label for="modal_name">Session Name:</label>
			<input class="form-control" type="text" id="modal_name" value="${session.name}" readonly>
		</div>
		<div class="form-group">
			<label for="modal_sid">Session ID:</label>
			<input class="form-control" type="text" id="modal_sid" value="${session.sid}" readonly>
		</div>
		<div class="form-group">
			<label for="modal_pw">Session Password:</label>
			<input class="form-control" type="text" id="modal_pw" value="${session.owner === user.uid ? session.password : "\" placeholder=\"<hidden>"}" readonly>
		</div>
	`, [{ text: "Close", context: "secondary" }]);
}

Object.assign(window, { showLogin, showCreate, login, createAccount, account, signout, joinSession, createSession, sessionInfo, leaveSession });