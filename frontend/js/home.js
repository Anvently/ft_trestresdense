import { Router } from './router.js';
import { ViewManager } from './view-manager.js';
import { UserInfoManager } from './userInfosManager.js';


console.log("pouet");

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
	avatar: "https://localhost:8083/avatars/__default__.jpg",
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

export const userManager = new UserInfoManager(3600000, 300000, 3000);

userManager.startBackgroundRefresh();


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
		// console.log(response.status);
		if (response.status === 401) {
			logOut();
			throw (new Error("Seems your auth-token is not valid"));
		}
		userInfo.received = false;
	}
	Object.assign(userInfo, await response.json());
	userInfo.received = true;
}

// Fonction pour afficher le pop-up d'erreur
function errorHandler(message, attemptReconnect = false) {
	document.getElementById('errorMessage').textContent =
		(typeof message === 'object' && message.data !== undefined) ?
		message.data :
		message;
	const successPopup = document.getElementById('successPopup');
	if (successPopup)
		successPopup.style.display = 'none';
	const errorPopup = document.getElementById('errorPopup');
	errorPopup.style.display = 'block';
	if (!attemptReconnect)
		this.received_error = true;
	// Masquer le pop-up après quelques secondes (optionnel)
	setTimeout(() => {
		errorPopup.style.display = 'none';
	}, 5000); // Masquer après 5 secondes
}

// Fonction pour fermer le pop-up
function closeErrorPopup() {
	document.getElementById('errorPopup').style.display = 'none';
}

// Fonction pour afficher le pop-up de success
function successHandler(message) {
	document.getElementById('successMessage').textContent = message;
	const successPopup = document.getElementById('successPopup');
	successPopup.style.display = 'block';
	const errorPopup = document.getElementById('errorPopup');
	errorPopup.style.display = 'none';
	setTimeout(() => {
		successPopup.style.display = 'none';
	}, 3000); // Masquer après 5 secondes
}

// Fonction pour fermer le pop-up
function closeSuccessPopup() {
	document.getElementById('successPopup').style.display = 'none';
}

function logOut() {
	Object.assign(userInfo, defaultUserInfo);
	document.cookie = 'auth-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
	updateUserMenu();
	window.location.hash = '#login';
	// router.navigate('#login');
}

document.querySelectorAll('.logoutButton').forEach(function (el) {
	el.addEventListener('click', (e) => {
		e.preventDefault();
		logOut();
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
		try {
			Object.assign(userInfo, await getUserInfos());
		} catch (error) {
			this.errorHandler(error);
			return;
		}
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
viewManager.setSuccessHandler(successHandler);
router.setErrorHandler(errorHandler);

// Initialisation du routeur
router.init();

// Gestion des boutons précédent/suivant du navigateur
window.addEventListener('popstate', () => {
	router.handleLocationChange();
});