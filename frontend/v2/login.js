function init_login() {
	const loginForm = document.getElementById('loginForm');
	if (loginForm) {
		loginForm.addEventListener('submit', function(e) {
			e.preventDefault();
			const username = document.getElementById('loginUsername').value;
			const password = document.getElementById('loginPassword').value;
			
			// Remplacez 'YOUR_LOGIN_ENDPOINT' par l'URL réelle de votre endpoint de connexion
			fetch('https://localhost:8083/api/auth/login/', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ username: username, password: password }),
			})
			.then((response) => 
				response.json()
				.then((data) => {
					if (response.status == 200) {
						// Connexion réussie
						console.log('Connexion réussie');
						// Rediriger vers la page principale ou effectuer d'autres actions
						window.location.hash = '#matchmaking';
					} else {
						// Échec de la connexion
						console.error('Échec de la connexion:', data);
						// Afficher un message d'erreur à l'utilisateur
						const errorDiv = document.getElementById('error-message-connection-failed');
						errorDiv.style.display = 'block';
						errorDiv.innerHTML = data;
					}
				})
			)
			.catch((e) => {
				console.error('Erreur lors de la connexion:', error);
				alert('Une erreur s\'est produite lors de la tentative de connexion.');
			});
		});

		const signupForm = document.getElementById('signupForm');
		if (signupForm) {
			signupForm.addEventListener('submit', function(e) {
				e.preventDefault();
				// ... (le reste du code de connexion)
			});
		}

		const login42Button = document.getElementById('login42');
		if (login42Button) {
			login42Button.addEventListener('click', function() {
				// Redirection vers l'authentification 42
				window.location.href = 'https://api.intra.42.fr/oauth/authorize?client_id=u-s4t2ud-7b58cca1aa55dd25c0845e50d85160e19d51224f609b8d441d4b6281473ba7ee&redirect_uri=https%3A%2F%2Flocalhost%3A8083%2Fapi%2Fauth%2F42-api-callback&response_type=code';
			});
		}
	}
}

registerCleanup('login', () => {
		console.log("cleaning login page");
});

registerInit('login', () => {
		console.log("init login page");
		init_login();
});

// init_pong();