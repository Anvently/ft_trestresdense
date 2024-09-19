const routes = [
	{ path: '/', url: '/home.html' },
	{ path: '/cheval_canard', url: '/cheval_canard.html' },
	{ path: '/contact', url: '/contact.html' },
];

const mainContainer = document.getElementById('mainContainer');
let loadedScripts = [];

// Function to clean up loaded scripts NE FONCTIONNE PAS
function cleanScripts() {
	console.log("loadedScripts = ", loadedScripts);
	clean();

	loadedScripts.forEach(script => {
		console.log("script : ", script)
		if (script.clean) {
			console.log("calling clean...");
			script.clean(); // Ensure each script has a clean method
		}
	});
	loadedScripts = [];
}

// Function to add a script to the loaded scripts array
function addScript(script) {
	const scriptElement = document.createElement('script');
	scriptElement.src = script.src || '';
	scriptElement.text = script.text || '';
	scriptElement.onload = () => {
		loadedScripts.push(scriptElement);
	};
	document.body.appendChild(scriptElement);
	document.body.removeChild(scriptElement); // Clean up immediately after loading
}

async function router(event) {
	event.preventDefault();
	const url = new URL(event.target.href).pathname;
	history.pushState({}, 'newUrl', url);
	await renderPage(url);
}

async function renderPage(path = window.location.pathname) {
	const route = routes.find(route => route.path === path);
	if (route) {
		try {
			const response = await fetch(route.url);

			if (!response.ok) {
				// throw new Error('Network response was not ok.');
				console.log("network response was not ok");
			}
			const html = await response.text();
			
			// Create a temporary element to hold the HTML
			const tempDiv = document.createElement('div');
			tempDiv.innerHTML = html;

			// Clean up old scripts
			cleanScripts();

			// Load new scripts
			const scripts = tempDiv.querySelectorAll('script');
			scripts.forEach(script => {
				addScript({
					src: script.src,
					text: script.text
				});
			});

			// Replace the content of mainContainer
			mainContainer.innerHTML = tempDiv.innerHTML;
		} catch (error) {
			mainContainer.innerHTML = `<h1>Error: ${error.message}</h1>`;
		}
	} else {
		mainContainer.innerHTML = `<h1>Page not found</h1>`;
	}
}

// Manage the previous tab (popstate event)
window.addEventListener('popstate', () => renderPage(window.location.pathname));

// Manage page reload
window.addEventListener('DOMContentLoaded', () => renderPage(window.location.pathname));

// Attach the router function to your navigation links
document.querySelectorAll('a').forEach(link => {
	link.addEventListener('click', router);
});
