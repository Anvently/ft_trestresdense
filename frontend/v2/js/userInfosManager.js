export class UserInfoManager {
	constructor(cacheExpiration = 3600000, refreshInterval = 300000, updateTimeout = 3000, userCache = new UserCache()) {
		this.userCache = userCache;
		this.expiry = cacheExpiration;
		this.backgroundUpdater = new BackgroundUpdater(this.userCache, refreshInterval, updateTimeout);
	}

	/**
	 * Return userInfo either from the cache or from a request.
	 * getUserAttr should be prefered as it allows for batch request with 
	 * dynamic updates.
	 */
	getUserInfo(username, dft = null, suscribe_changes = true) {
		let userInfo = userCache.getUser(username);
		if (suscribe_changes)
			this.backgroundUpdater.addActiveUser(username);
		if (userInfo) {
			return Promise.resolve(userInfo);
		} else {
			this.backgroundUpdater.registerUserToUpdate(username);
			return Promise.resolve(dft);
		}
	}
	
	/**
	 * Does stuff
	 * @param {attr} attr user attribute to retrieve. Example: 'display_name' => return user.display_name
	 * @param {dft} dft transitory value that will be return from if user could not be resolve
	 * @param {suscribe_changes} suscribe_changes change in userInfo will be followed and updated
	 * immediately. User will be consequently updated in the next batch request, and associated content
	 * dynamically updated also (provided that it's been added to the backgroundUpdate registerd properties).
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

	forceUpdate() {
		this.backgroundUpdater.forceUpdate();
	}

	startBackgroundRefresh() {
		this.backgroundUpdater.startResfreshUpdates();
	}

	stopBackgroundRefresh() {
		this.backgroundUpdater.stopRefreshUpdates();
	}

	//Clear active users of the view
	//Should be called when cleaning a view
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
		if (!itemStr) return null;

		const item = JSON.parse(itemStr);
		if (Date.now() > item.expiry) {
				localStorage.removeItem(`user_${username}`);
				return null;
		}

		return item.value;
	}

	isValid(username) {
		const user = this.getUser(username);
		return user !== null;
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
		this.refreshIntervalId;
		this.updateTimeoutId;
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
		if (this.updateTimeoutId === null) {
			this.updateTimeoutId = setTimeout(() => {
				this.forceUpdate(), this.updateTimeout}
			);
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
		this.updateTimeoutId = null;
	}

	forceUpdate() {
		this.updateUsers(this.usersToUpdate);
		if (this.updateTimeoutId) {
			clearTimeout(this.updateTimeoutId);
			this.updateTimeoutId = null;
		}
		this.usersToUpdate.clear();
	}

	async fetchUsersBatch(usernames) {
		try {
		  const response = await fetch('https://api.example.com/users/batch', {
			method: 'POST',
			headers: {
			  'Content-Type': 'application/json',
			},
			body: JSON.stringify({ usernames: usernames }),
		  });
	  
		  if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		  }
	  
		  return await response.json();
		} catch (error) {
		  console.error('Erreur lors de la récupération des utilisateurs:', error);
		  throw error;
		}
	}

	async fetchUserFromAPI(username) {
		try {
			const response = await fetch(`https://${window.location.host}/api/users/${username}`);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			return await response.json();
		} catch (error) {
			console.error('Erreur lors de la récupération des utilisateurs:', error);
			throw error;
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
		for (const username of users) {
			try {
				const updatedInfo = await fetchUserFromAPI(username);
				if (JSON.stringify(updatedInfo) !== JSON.stringify(this.userCache.getUser(username))) {
					this.userCache.setUser(username, updatedInfo);
					this.userChangeHandler(username, updatedInfo);
				}
			} catch (error) {
				console.error(`Erreur lors de la mise à jour de ${username}:`, error);
			}
		}
	}

}
