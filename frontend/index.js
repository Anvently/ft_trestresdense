

// function navigate(page) {
// 	const mainContainer = document.getElementById("mainContainer");

// 	switch (page) {
// 		case "home":
// 			mainContainer.innerHTML = "<p>home page</p>";
// 			break;
// 		case "about":
// 			mainContainer.innerHTML = "<p>about page</p>";
// 			break;
// 		case "contact":
// 			mainContainer.innerHTML = "<p>contact page</p>";
// 			break;
// 		default:
// 			mainContainer.innerHTML = '<p>Page not found.</p>';
// 	}
// }



function navigate(page) {
	const mainContainer = document.getElementById("mainContainer");

	mainContainer.innerHTML = '<p>Loading...</p>';

	fetch(`${page}.html`)
		.then(response => response.text())
		.then(html => {
			mainContainer.innerHTML = html;
			executeScripts(mainContainer);
		})
		.catch(error => {
			mainContainer.innerHTML = '<p>Error loading page.</p>';
			console.error('Error loadinf page:', error);
		});
}

function executeScripts(container) {
	// select all scripts from the mainContainer
	const scripts = container.querySelectorAll('script')

	scripts.forEach(script => {
		const newScript = document.createElement('script');

		// if script is external
		if (script.src) {
			newScript.src = script.src;
			newScript.async = false; // make sure scripts are execute in right order ?
		} else {
			newScript.textContent = script.textContent;  // Copy inline scripts
		}
		document.body.appendChild(newScript);  // Append script to DOM to execute
		script.remove();  // Remove old script to prevent re-injection
	});
}