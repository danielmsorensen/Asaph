import { request } from "./fetch.js";
import { connect } from "./socket.js";

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
$(window).resize(() => {
	centerVertical();
});
$(window).on("orientationchange", () => {
	centerVertical();
});

function centerVertical() {
	if($("#inner").height() > $("#outer").height()) {
		$("#inner").css({
			"transform": "translate(-50%, 0)",
			"top": "0"
		});
	}
	else {
		$("#inner").css({
			"transform": "translate(-50%, -50%)",
			"top": "50%"
		});
	}
}

let signinPage = 0;
function showLogin() {
	if(signinPage === 1) {
		$("#signin").collapse("hide");
		signinPage = 0;
	}
	else {
		$("#create-form").hide("fast");
		$("#login-form").show("fast", centerVertical);
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
		$("#login-form").hide("fast");
		$("#create-form").show("fast", centerVertical);
		if(signinPage === 0) {
			$("#signin").collapse("show");
		}
		signinPage = 2;
	}
	$("#signin_alert").css("visibility", "hidden");
}

let session = {};
function signin(uid, token) {
	if(uid && token) {
		request("GET", "api/account/profile", { uid, token }).then(data => {
			if(data.success) {
				if(Storage) {
					localStorage.setItem("uid", uid);
					localStorage.setItem("token", token);
				}
				
				session.uid = uid;
				session.token = token;
				session.profile = data.result;
				
				$("#page_signin").hide("fast");
				$("#page_home").show("fast", centerVertical);
				$("#home_name").text("Logged in as " + data.result.name);
			}
			else {
				alert("Error signing in: " + data.reason);
			}
		});
	}
}
function login() {
	const form = document.forms["login-form"];
	const email = form.login_email.value;
	const password = form.login_pw.value;

	if(email && password) {
		request("POST", "api/account/login", { email, password }).then(data => {
			if(data.success) {
				form.reset();
				$("#signin_alert").css("visibility", "hidden");
				signin(data.result.uid, data.result.token);
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
		});
	}
	else {
		$("#signin_alert").css("visibility", "visible");
		$("#signin_alert").text("Empty fields");
	}
}
function createAccount() {
	const form = document.forms["create-form"];
	
	const name = form.create_name.value;
	const email = form.create_email.value;
	const cEmail = form.create_conf_email.value;
	const password = form.create_pw.value;
	const cPw = form.create_conf_pw.value;

	if(name && email && cEmail && password && cPw) {
		if(email === cEmail) {
			if(password === cPw) {
				request("POST", "api/account/create", { email, password, name }).then(data => {
					if(data.success) {
						form.reset();
						$("#signin_alert").css("visibility", "hidden");
						signin(data.result.uid, data.result.token);
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
				});
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
	if(session && session.uid && session.token) {
		request("POST", "api/account/signout", {
			"uid": session.uid,
			"token": session.token
		});
	}
	
	if(Storage) {
		localStorage.removeItem("uid");
		localStorage.removeItem("token");
	}
	
	$("#page_home").hide("fast");
	$("#page_signin").show("fast", centerVertical);
}
function joinSession() {
	connect();
}
function createSession() {
	connect();
}

Object.assign(window, { showLogin, showCreate, login, createAccount, account, signout, joinSession, createSession });