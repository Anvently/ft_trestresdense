// import { userInfo } from "./home";
import { User } from "./home.js"

export class UserInfoManager {
	constructor(cacheExpiration = 3600000, refreshInterval = 300000, updateTimeout = 3000, userCache = new UserCache()) {
		this.userCache = userCache;
		this.expiry = cacheExpiration;
		this.backgroundUpdater = new BackgroundUpdater(this.userCache, refreshInterval, updateTimeout);
	}

	/**
	 * Return userInfo from a fetch request, even if user exists in the cache.
	 * Update the cache with the received infos.
	 * For page displaying multiple users, getUserAttr should be prefered
	 * as it allows for batch request with dynamic updates.
	 * If the request fails, return the cached information or default user if none.
	 */
	async fetchUserInfo(username) {
		const userInfo = await this.backgroundUpdater.fetchUserFromAPI(username);
		if (!userInfo) {
			return this.userCache.getUser(username);
		}
		this.userCache.setUser(username, userInfo);
		return userInfo;
	}

	/**
	 * Return userInfo either from the cache or undefined.
	 * Users absent from the cache will be fetched in the background.
	 * Set a callback handler to have the view updated dynamically.
	 */
	getUserInfo(username, suscribe_changes = true) {
		let userInfo = this.userCache.getUser(username);
		if (suscribe_changes)
			this.backgroundUpdater.addActiveUser(username);
		if (userInfo) {
			return Promise.resolve(userInfo);	
		} else {
			this.backgroundUpdater.registerUserToUpdate(username);
			return Promise.resolve(undefined);
		}
	}
	
	/**
	 * @param {attr} attr user attribute to retrieve. Example: 'display_name' => return user.display_name
	 * @param {dft} dft transitory value that will be return from if user could not be resolved immediatly
	 * @param {suscribe_changes} suscribe_changes enable by default. disable to prevent user info to be refreshed at a set interval.
	*/
	getUserAttr(username, attr, dft = 'unknown', suscribe_changes = true) {
		let userInfo = this.userCache.getUser(username);
		if (suscribe_changes)
			this.backgroundUpdater.addActiveUser(username);
		if (userInfo) {
			if (Object.hasOwn(userInfo, attr))
				return Promise.resolve(userInfo[attr]);
			return Promise.resolve(`undefined property \{${attr}\}`);
		} else {
			this.backgroundUpdater.registerUserToUpdate(username);
			return Promise.resolve(dft);
		}
	}

	setDynamicUpdateHandler(handler) {
		this.backgroundUpdater.userChangeHandler = handler;
	}

	/**
	 * Trigger an immediate batch request for every user that needs to be updated.
	 * Reset the timeout. The dynamicUpdateHandler will be called. Make sure to call this
	 * function when you have added every user to be displayed to the DOM.
	*/
	async forceUpdate() {
		await this.backgroundUpdater.forceUpdate();
	}

	/**
	 * The background refresher refresh current userInfo at a set interval.
	 * The interval should coincide with the cache expiration time.
	 * It is independant from the update timeout which is used when one or more
	 * specific user informations are missing from the cache. 
	 */
	startBackgroundRefresh() {
		this.backgroundUpdater.startResfreshUpdates();
	}

	stopBackgroundRefresh() {
		this.backgroundUpdater.stopRefreshUpdates();
	}

	// Clear active users of the view.
	// They will stop being refreshed by the backgroundRefresher.
	// Should be called when cleaning a view
	clearUsers() {
		this.backgroundUpdater.clearActiveUsers();
	}
}

class UserCache {
		constructor(ttl = 3600000) { // TTL par défaut: 1 heure
		this.ttl = ttl;
	}

	setUser(username, userData) {
		const item = {
			value: userData,
			expiry: Date.now() + this.ttl
		};
		localStorage.setItem(`user_${username}`, JSON.stringify(item));
	}

	getUser(username) {
		const itemStr = localStorage.getItem(`user_${username}`);
		if (!itemStr) return undefined;

		const item = JSON.parse(itemStr);
		if (Date.now() > item.expiry) {
				localStorage.removeItem(`user_${username}`);
				return undefined;
		}

		return item.value;
	}

	isValid(username) {
		const user = this.getUser(username);
		return user !== undefined;
	}
}

// Modification du BackgroundUpdater
class BackgroundUpdater {
	constructor(userCache, refreshInterval = 300000, updateTimeout = 3000) { // 5 minutes par défaut
		this.userCache = userCache;
		this.refreshInterval = refreshInterval;
		this.updateTimeout = updateTimeout;
		this.activeUsers = new Set(); //List of active, ideally only displayed username, that needs to be updated
		this.usersToUpdate = new Set(); //List of username that needs to be updated
		this.refreshIntervalId = undefined;
		this.updateTimeoutId = undefined;
		this.userChangeHandler = (username, userInfo) => {
			throw Error('You need to assign a handler taking (username, userInfo) to update user content');
		};
	}
	
	addActiveUser(username) {
		this.activeUsers.add(username);
	}
	
	removeActiveUser(username) {
		this.activeUsers.delete(username);
	}

	registerUserToUpdate(username) {
		this.usersToUpdate.add(username);
		if (this.updateTimeoutId === undefined) {
			this.updateTimeoutId = setTimeout(async () => {
				await this.forceUpdate();
			}, this.updateTimeout);
		}
	}

	discardUserFromUpdate(username) {
		this.usersToUpdate.delete(username);
	}

	startResfreshUpdates() {
		this.refreshIntervalId = setInterval(() => this.updateUsers(), this.refreshInterval);
	}

	stopRefreshUpdates() {
		clearInterval(this.refreshIntervalId);
	}

	clearActiveUsers() {
		this.activeUsers.clear();
		this.usersToUpdate.clear();
		clearTimeout(this.updateTimeoutId);
		this.updateTimeoutId = undefined;
	}

	async forceUpdate() {
		if (this.usersToUpdate.size == 0) return;
		await this.updateUsers(this.usersToUpdate);
		if (this.updateTimeoutId) {
			clearTimeout(this.updateTimeoutId);
			this.updateTimeoutId = undefined;
		}
		this.usersToUpdate.clear();
	}

	async fetchUsersBatch(users) {
		const response = await fetch(`https://${window.location.host}/api/users-batch/`, {
			method: 'POST',
			headers: {
			'Content-Type': 'application/json',
			},
			body: JSON.stringify({ users: [...users] }),
		});
	
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}
	
		return await response.json();
	}

	async fetchUserFromAPI(username) {
		try {
			const response = await fetch(`https://${window.location.host}/api/users/${username}`);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			return await response.json();
		} catch (error) {
			return undefined;
		}
	}

	/**
	 * Does stuff
	 * @param {usersToUpdate} usersToUpdate If not provided, will update every active users that have expired in cache.
	 * @param {clearTimeout} clearTimeout You may want to set this as false when requesting an update outside
	 * of normal usage. Example: when passing active users as argument, to avoid two retrieve twice the users.
	*/
	async updateUsers(users = undefined) {
		if (!users) { //If not provided, will update every active users that have expired.
			users = Array.from(this.activeUsers).filter(username => {
				const user = this.userCache.getUser(username);
				if (!user) return username;
			});
		}
		if (users.length === 0) return;
		try {
			const receivedInfo = await this.fetchUsersBatch(users);
			for (const userInfo of receivedInfo) {
				if (JSON.stringify(userInfo) !== JSON.stringify(this.userCache.getUser(userInfo.username))) {
					this.userCache.setUser(userInfo.username, userInfo);
					this.userChangeHandler(userInfo.username, userInfo);
				}
			} 
		} catch (error) {
			console.error(`Erreur lors de la mise à jour des utilisateurs (${users}):`, error);
		}
	}

}
