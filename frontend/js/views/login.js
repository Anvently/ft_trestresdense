import { userInfo, userManager } from '../home.js';
import { BaseView } from '../view-manager.js';

export default class LoginView extends BaseView {
    constructor() {
        super('login-view');
		this.loginUrl = `https://${window.location.host}/api/auth/login/`;
		this.registerUrl = `https://${window.location.host}/api/auth/register/`;
    }

    async initView() {
		this.loginForm = document.getElementById('loginForm');
		this.signupForm = document.getElementById('signupForm');
		this.login42Button = document.getElementById('login42');

        // Le HTML est déjà chargé, vous pouvez maintenant initialiser les éléments
        this.loginForm.addEventListener('submit', (e) => {
			e.preventDefault();
			this.login();
		});

		this.signupForm.addEventListener('submit', (e) => {
				e.preventDefault();
				this.register();
		});

		this.login42Button.addEventListener('click', () => {
				// Redirection vers l'authentification 42
				window.location.href = 'https://api.intra.42.fr/oauth/authorize?client_id=u-s4t2ud-7b58cca1aa55dd25c0845e50d85160e19d51224f609b8d441d4b6281473ba7ee&redirect_uri=https%3A%2F%2Flocalhost%3A8083%2Fapi%2Fauth%2F42-api-callback&response_type=code';
		});

		this.signupForm.addEventListener('change', (e) => {
			e.preventDefault();
			this.onPasswordChange();
		});

    }

	login () {
		const username = document.getElementById('loginUsername').value;
		const password = document.getElementById('loginPassword').value;
		
		fetch(this.loginUrl, {
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
					userInfo.refresh();
					// Rediriger vers la page principale ou effectuer d'autres actions
					window.location.hash = '#';
				} else {
					// Échec de la connexion
					console.error('Échec de la connexion:', data);
					// Afficher un message d'erreur à l'utilisateur
					const errorDiv = document.getElementById('errorLogin');
					errorDiv.style.display = 'block';
					errorDiv.innerHTML = data;
				}
			})
		)
		.catch((e) => {
			console.error('Erreur lors de la connexion:', e);
			alert('Une erreur s\'est produite lors de la tentative de connexion.');
		});
	}

	onPasswordChange() {
		if (!this.signupForm.password.value) {
			this.signupForm.password.setCustomValidity("Password must be non-empty.")
		}
		else if (this.signupForm.password.value !== this.signupForm.confirmPassword.value) {
			this.signupForm.password.setCustomValidity("");
			this.signupForm.confirmPassword.setCustomValidity("Passwords must match.")
		} else {
			this.signupForm.password.setCustomValidity("");
			this.signupForm.confirmPassword.setCustomValidity("");
		}
	}

	async register () {
		console.log('Enregistrement en cours');
		const errorDiv = document.getElementById('errorRegister');
		try {
			const response = await fetch(this.registerUrl, {
				method: 'POST',
				headers: {'Content-Type': 'application/json',},
				body: JSON.stringify({
					username: this.signupForm.signupUsername.value,
					email: this.signupForm.signupEmail.value,
					password: this.signupForm.password.value
				})
			});
			if (response.status === 400)
				throw new Error(Object.entries(await response.json())[0]);
			if (!response.ok)
				throw new Error("L'inscription a echouee.");
			this.successHandler("Inscription reussie !");
			errorDiv.style.display = 'none';
		} catch (error) {
			errorDiv.style.display = 'block';
			errorDiv.innerHTML = error;
		}
	}

	async cleanupView() {
		// À implémenter dans les classes filles
	
		
	}

}