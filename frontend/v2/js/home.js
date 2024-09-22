import { Router } from './router.js';
// import { AuthService } from './js/services/auth-service.js';
import { ViewManager } from './view-manager.js';

const router = new Router();
const viewManager = new ViewManager(document.getElementById('content'));
const defaultUserInfo = {
	get isAuthenticated() {
		return document.cookie.includes('auth-token');
	},
	set isAuthenticated(pouet) {
		return document.cookie.includes('auth-token');
	}, 
	received: false,
	avatar: "https://localhost:8083/avatars/default.jpg",
	display_name: "Anonymous",
	username: "anonymous"
};
export const userInfo = defaultUserInfo;

// Définition des routes
router.addRoute('#', './views/matchmaking.js', 'html/matchmaking.html');
router.addRoute('#login', './views/login.js', 'html/login.html');
router.addRoute('#profile', './views/profile.js', 'html/profile.html');
router.addRoute('#about', './views/about.js', 'html/about.html');
router.addRoute('#stats', './views/stats.js', 'html/stats.html');
router.addRoute('#pong2d', './views/pong2d.js', 'html/pong2d.html');
router.addRoute('#pong3d', './views/pong3d.js', 'html/pong3d.html');

// Gestion de l'authentification
function updateUserMenu() {
	const userMenu = document.getElementById('userMenu');
	if (userInfo.isAuthenticated) {
		userMenu.classList.remove('d-lg-none');
		document.querySelectorAll('.userOption').forEach((el) => {
			el.classList.remove('d-none');
		});
	} else {
		userMenu.classList.add('d-lg-none');
		document.querySelectorAll('.userOption').forEach((el) => {
			el.classList.add('d-none');
		});
	}
	document.getElementById("userAvatar").src = userInfo.avatar;
}

async function getUserInfos() {
	const response = await fetch(`https://${document.location.host}/api/me/`);
	if (!response.ok) {
		console.error(`Failed to fetch user informations: status=${response.statusText}`);
		userInfo.received = false;
	}
	Object.assign(userInfo, await response.json());
	userInfo.received = true;
}

// Fonction pour afficher le pop-up d'erreur
function errorHandler(error) {
	console.log('Error loading view: ', error);
	document.getElementById('errorMessage').textContent = error;
	const errorPopup = document.getElementById('errorPopup');
	errorPopup.style.display = 'block';

	// Masquer le pop-up après quelques secondes (optionnel)
	setTimeout(() => {
		errorPopup.style.display = 'none';
	}, 5000); // Masquer après 5 secondes
}

document.querySelectorAll('.logoutButton').forEach(function (el) {
	el.addEventListener('click', (e) => {
		e.preventDefault();
		Object.assign(userInfo, defaultUserInfo);
		document.cookie = 'auth-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
		updateUserMenu();
		router.navigate('#login');
	});
});

// Middleware d'authentification
router.use((path, next) => {
	if (path !== '#login' && !userInfo.isAuthenticated) {
		console.log("Not logged in, redirecting to login page.");
		router.navigate('#login');
	} else {
		next();
	}
});

//Midleware pour obtenir les informations sur l'utilisateur actif.
router.use(async (path, next) => {
	if (userInfo.isAuthenticated && !userInfo.received) {
		Object.assign(userInfo, await getUserInfos());
		if (userInfo.received)
			updateUserMenu();
	}
	next();
});

// Gestion du changement de route
router.onRouteChange(async (route) => {
	updateUserMenu()
	const sucess = await viewManager.loadView(route.viewPath, route.htmlPath);
	return sucess;
});

viewManager.setErrorHandler(errorHandler);
router.setErrorHandler(errorHandler);

// Initialisation du routeur
router.init();

// Gestion des boutons précédent/suivant du navigateur
window.addEventListener('popstate', () => {
	router.handleLocationChange();
});