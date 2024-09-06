class Route {
	constructor() {
		this.route = {};
		this.current_view = null;
	}

	async register(view, path) {
		this.route[path] = view;
	}

	async handleLocation() {

		const path = window.location.pathname;

		if (this.current_view != "") {
			console.log("test");
		}

		this.current_view = this.route[path] || this.route[404];
		const html = await fetch(this.current_view.file_html).then((data) => data.text());

		document.getElementById("app").innerHTML = html;
	}

	async handleHistory(event) {
		event = event || window.event;
		event.preventDefault();
		window.history.pushState({}, "", event.target.href);
		this.handleLocation();
	}
};


class AView {

	constructor(script, file_html, ext) {
		this.script = script;
		this.file_html = file_html;
		this.ext = ext;
	}

	async getLoadScript() {
		for (var e of this.script)
			await import(e);
	}
	async init() { }

	async enter() {
		this.getLoadScript();
		this.init();
	}

	async leave() { }
};

class Home extends AView {
	constructor() {
		super(["/script.js"], "/spa/auth.html", true);
	}

	async init() { }

};

class Error extends AView {
	constructor() {
		super([], "/spa/404.html", true);
	}
};


function getCookie(name) {
	var dc = document.cookie;
	var prefix = name + "=";
	var begin = dc.indexOf("; " + prefix);
	if (begin == -1) {
		begin = dc.indexOf(prefix);
		if (begin != 0) return null;
	}
	else {
		begin += 2;
		var end = document.cookie.indexOf(";", begin);
		if (end == -1) {
			end = dc.length;
		}
	}
	return decodeURI(dc.substring(begin + prefix.length, end));
}

function doSomething() {
	var myCookie = getCookie("authtoken");

	if (myCookie == null) {
		console.log("no cookie ! :[");
		foo();
	}
	else {
		console.log("cookie ! :]");
	}
}


function onpopstate_loc(route) {
	route.handleLocation();
}

var router = new Route();

router.register(new Home(), "/");
router.register(new Error(), 404);


window.onpopstate = onpopstate_loc(router);
window.route = router.handleHistory();
router.handleLocation();