function createResult(result) {
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
function createReason(reason) {
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

async function request(method, url, params) {
	try {
		url = window.location.origin + (url.startsWith("/") ? "" : "/") + url;
		
		let init, q;
		switch(method) {
			case "GET":
				init = {
					method: "GET"
				};
				q = new URLSearchParams();
				for(const key in params) {
					q.set(key, params[key]);
				}
				url += (url.endsWith("/") ? "" : "/") + "?" + q.toString();
				break;
			case "POST":
				init = {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(params)
				};
				break;
		}
		const res = await fetch(url, init);
		if(res.ok) {
			if(res.headers && res.headers.get("Content-Type").includes("application/json")) {
				return createResult(await res.json());
			}
			else {
				return createResult();
			}
		}
		else {
			if(res.status === 400) {
				console.warn(res.statusText);
			}
			return createReason(await res.status);
		}
	}
	catch(err) {
		console.warn(err.message);
		return createReason(500);
	}
}

export { request };