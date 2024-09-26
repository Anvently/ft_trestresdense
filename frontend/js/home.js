import { Router } from './router.js';
import { ViewManager } from './view-manager.js';
import { UserInfoManager } from './user-infos-manager.js';

const router = new Router();
const viewManager = new ViewManager(document.getElementById('content'));

/**
 * @note
 * userInfo default structures returned by the userManager can be used as such.

 * This class can be used to wrap those informations into an object allowing more
 * methods.

 * It is also usefull to translate an undefined userInfo into a default user
 * that can be use to print missing informations (=> default value of the constructor can be used as such)

 * @description
 * Example : const user = new User("foo-user", undefined).valid_info => false
 * But it can be used to print transitionnal values when using userManager background updater.

 * Example : const user = new User("herve", userManager.fetchUserInfo).valid_info => true
 * @param {username} username you should always instantiate object for an existing user.
 * Thus this parameter should always be defined
 * @param {objToAssign} objToAssign an userInfo structure that will be assign at creation.
 * If defined, the user object will always be considered as valid, and thus its informations
 * can be trusted.
*/
export class User {
	constructor(username, objToAssign = undefined) {
		this.avatar = `https://${window.location.host}/avatars/__default__.jpg`;
		this.friends = [];
		this.last_visit = "2024-09-25T11:33:00.563109Z";
		this.display_name = "UnknownName";
		this.username = username;
		this.scores_set = [];
		if (objToAssign) {
			Object.assign(this, objToAssign);
			this.valid_info = true;
		} else {
			this.valid_info = false;
		}
	}

	get is_online() {
		return (Date.now() - new Date(this.last_visit).getTime()) < 5 * 60 * 1000;
	}
}

class AuthenticatedUser extends User {
	constructor() {
		super('anonymous');
		this._avatar = `https://${window.location.host}/avatars/__default__.jpg`;
	}
	async getInfos() {
		const response = await fetch(`https://${document.location.host}/api/me/`);
		if (!response.ok) {
			console.error(`Failed to fetch user informations: status=${response.statusText}`);
			this.valid_info = false;
			throw (new Error("Seems your auth-token is not valid"));
			// console.log(response.status);
			// if (response.status === 401) {
			// 	logOut();
			// }
		}
		Object.assign(this, await response.json());
		this.valid_info = true;
	}
	get avatar() {
		return this._avatar;
	}
	set avatar(url) {
		if (this._avatar !== url) {
			this._avatar = url;
			this.updateUserMenu();
		}
		this._avatar = url;
	}
	updateUserMenu() {
		const userMenu = document.getElementById('userMenu');
		if (this.isAuthenticated) {
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
		document.getElementById("userAvatar").src = this._avatar + "#" + new Date().getTime();
	}
	get isAuthenticated() {
		return document.cookie.includes('auth-token');
	}
	logOut() {
		document.cookie = 'auth-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
		Object.assign(this, new AuthenticatedUser());
		this.updateUserMenu();
	}

	is_friend(friend_id)
	{
		if (this.friends.includes(friend_id))
			return true;
		else
			return false;
	}

}

export const authenticatedUser = new AuthenticatedUser();

// Définition des routes
router.addRoute('#', './views/matchmaking.js', 'html/matchmaking.html');
router.addRoute('#login', './views/login.js', 'html/login.html');
router.addRoute('#profile', './views/profile.js', 'html/profile.html');
router.addRoute('#about', './views/about.js', 'html/about.html');
router.addRoute('#stats', './views/stats.js', 'html/stats.html');
router.addRoute('#user', './views/user.js', 'html/user.html');
router.addRoute('#lobby', './views/lobby.js', 'html/lobby.html');
router.addRoute('#pong2d', './views/pong2d.js', 'html/pong2d.html');
router.addRoute('#pong3d', './views/pong3d.js', 'html/pong3d.html');

export const userManager = new UserInfoManager(3600000, 300000, 3000);

userManager.startBackgroundRefresh();

// Fonction pour afficher le pop-up d'erreur
function errorHandler(error, attemptReconnect = false) {
	document.getElementById('errorMessage').textContent =
		(typeof error === 'object' && error.data !== undefined) ?
		error.data :
		error;
	const successPopup = document.getElementById('successPopup');
	if (successPopup)
		successPopup.style.display = 'none';
	const errorPopup = document.getElementById('errorPopup');
	errorPopup.style.display = 'block';
	// if (!attemptReconnect)
	// 	this.received_error = true;
	// Masquer le pop-up après quelques secondes (optionnel)
	setTimeout(() => {
		errorPopup.style.display = 'none';
	}, 5000); // Masquer après 5 secondes
	throw error; //UNCOMMENT TO TRACK ERROR IN CONSOLE
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
	authenticatedUser.logOut();
	window.location.hash = '#login';
}

document.querySelectorAll('.logoutButton').forEach(function (el) {
	el.addEventListener('click', (e) => {
		e.preventDefault();
		logOut();
	});
});

// Middleware d'authentification
router.use((path, next) => {
	if (path !== '#login' && !authenticatedUser.isAuthenticated) {
		console.log("Not logged in, redirecting to login page.");
		router.navigate('#login');
	} else {
		next();
	}
});

//Midleware pour obtenir les informations sur l'utilisateur actif.
router.use(async (path, next) => {
	if (authenticatedUser.isAuthenticated && !authenticatedUser.valid_info && window.location.hash !== "#login") {
		try {
			authenticatedUser.getInfos();
		} catch (error) {
			// throw new Error(error);
			errorHandler(error);
			return
		}
	}
	next();
});

// Gestion du changement de route
router.onRouteChange(async (route) => {
	return await viewManager.loadView(route.viewPath, route.htmlPath);
});

viewManager.setErrorHandler(errorHandler);
viewManager.setSuccessHandler(successHandler);
router.setErrorHandler(errorHandler);

if (authenticatedUser.isAuthenticated) {
	try {
		await authenticatedUser.getInfos();
		if (!authenticatedUser.valid_info)
			throw new Error("Failed to fetch your personnal informations");
	} catch (error) {
		errorHandler(error);
	}
}

// Initialisation du routeur
router.init();

// Gestion des boutons précédent/suivant du navigateur
window.addEventListener('popstate', () => {
	router.handleLocationChange();
});
