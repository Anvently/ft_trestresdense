import { authenticatedUser, userManager } from '../home.js';
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
				window.location.href = `https://api.intra.42.fr/oauth/authorize?client_id=u-s4t2ud-7b58cca1aa55dd25c0845e50d85160e19d51224f609b8d441d4b6281473ba7ee&redirect_uri=https%3A%2F%${window.location.host}%3A8083%2Fapi%2Fauth%2F42-api-callback&response_type=code`;
		});
		
		this.signupForm.addEventListener('change', (e) => {
			e.preventDefault();
			this.onPasswordChange();
		});

		this.signupForm.signupUsername.addEventListener('change', (e) => {
			e.preventDefault();
			e.target.setCustomValidity("");
		})

		this.signupForm.signupEmail.addEventListener('change', (e) => {
			e.preventDefault();
			e.target.setCustomValidity("");
		})

    }

	resetLoginForm(username = "") {
		var loginTab = document.querySelector('#login-tab');
		var tab = new bootstrap.Tab(loginTab);
		tab.show();
		this.loginForm.loginUsername.value = username;
		this.loginForm.loginPassword.value = "";
		const errorDiv = document.getElementById('errorLogin');
		errorDiv.style.display = 'none';
		errorDiv.innerHTML = "";
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
					authenticatedUser.getInfos();
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
		if (!this.signupForm.signupPassword.value) {
			this.signupForm.signupPassword.setCustomValidity("Password must be non-empty.")
			document.getElementById("feedback-password").textContent = "Mot de passe requis";
		}
		else if (this.signupForm.signupPassword.value !== this.signupForm.confirmPassword.value) {
			this.signupForm.signupPassword.setCustomValidity("");
			this.signupForm.confirmPassword.setCustomValidity("Passwords must match.")
		} else {
			this.signupForm.signupPassword.setCustomValidity("");
			this.signupForm.confirmPassword.setCustomValidity("");
		}
	}

	showErrorRegister(errors) {
		for (const error of errors) {
			try {
				const field = error[0].charAt(0).toUpperCase() + error[0].slice(1);
				const detail = error[1][0];
				console.log(field, detail);
				const el = document.getElementById(`feedback-${error[0]}`);
				if (el) {
					el.textContent = detail;
					document.getElementById(`signup${field}`).setCustomValidity(detail);
				}
			} catch (exception) {
				const errorDiv = document.getElementById('errorRegister');
				errorDiv.style.display = 'block';
				errorDiv.innerHTML += `${error}\n`;
			}
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
					password: this.signupForm.signupPassword.value
				})
			});
			if (response.status === 400) {
				this.showErrorRegister(Object.entries(await response.json()));
				return;
			}
			if (!response.ok)
				throw new Error("L'inscription a echouee.");
			this.successHandler("Inscription reussie !");
			errorDiv.style.display = 'none';
			this.resetLoginForm();
		} catch (error) {
			errorDiv.style.display = 'block';
			errorDiv.innerHTML = error;
		}
	}

	async cleanupView() {
		// À implémenter dans les classes filles
	
		
	}

}