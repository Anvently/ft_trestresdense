import { BaseView } from '../view-manager.js';
import { userManager, User, authenticatedUser } from '../home.js'

export default class UserView extends BaseView {
	constructor() {
		super('user-view');
	}
	
	async initView() {
		this.username = this.urlParams.get('username');
		if (!this.username) {
			this.errorHandler("No user specified !");
			return;
			// May throw an error if we want to redirect user to the previous page
		}
		this.userInfo = new User(this.username, await userManager.fetchUserInfo(this.username));
		if (!this.userInfo.valid_info) {
			this.errorHandler("Failed to retrieve user informations");
			throw new Error("Failed to retrieve user informations");
			return;
		}
		this.editFriendButton = document.getElementById('edit-friend-button');
		this.editFriendButton.addEventListener('click', async (e) => {
			e.preventDefault();
			this.switchFriendStatus();
		})
		this.updateEditFriendButton();
		this.displayUserInfo();
		this.displayScores();
		userManager.setDynamicUpdateHandler(this.updateUserInfos);
		await this.updateFriendsList();
		await userManager.forceUpdate();
	}

	async cleanupView() {
		// Clean up any event listeners or other resources
	}

	async switchFriendStatus() {
		try {
			if (authenticatedUser.isFriendWith(this.userInfo.username)) {
				await authenticatedUser.removeFriend(this.userInfo.username);
			} else {
				await authenticatedUser.addFriend(this.userInfo.username);
			}
		} catch (error) {
			this.errorHandler("L'action a echouee.");
			return;
		}
		this.successHandler("Action effectuee.");
		this.updateEditFriendButton();
	}

	updateEditFriendButton() {
		if (this.userInfo.username === authenticatedUser.username || this.userInfo.username[0] === '!') {
			this.editFriendButton.classList.add('d-none');
			return;
		}
		this.editFriendButton.classList.remove('btn-danger', 'btn-success');
		if (authenticatedUser.isFriendWith(this.userInfo.username)) {
			this.editFriendButton.innerText = "Retirer des amis";
			this.editFriendButton.classList.add('btn-danger');
		} else {
			this.editFriendButton.innerText = "Ajouter comme ami";
			this.editFriendButton.classList.add('btn-success');
		}
	}

	fetchUserData(userId) {
		fetch(`/api/users/${userId}`)
			.then(response => response.json())
			.then(data => {
			this.displayUserInfo(data.user);
			this.displayFriends(data.friends);
			this.displayScores(data.scores);
			})
			.catch(error => console.error('Error fetching user data:', error));
	}

	displayUserInfo() {
		document.querySelector(".user-status").classList.add(this.userInfo.is_online ? 'online' : 'offline');
		document.getElementById('user-avatar').src = this.userInfo.avatar;
		document.getElementById('user-display-name').textContent = this.userInfo.display_name;
	}

	async updateFriendsList() {
		if (!this.userInfo.friends || !this.userInfo.friends.length)
			return;
		const friendsList = document.getElementById('friends-list');
		friendsList.innerHTML = ''; // Clear existing content
		this.userInfo.friends.forEach(async user => {
			const friend = new User(user, await userManager.getUserInfo(user));
			const friendElement = document.createElement('div');
			friendElement.classList.add('friend-element', 'col', `user-${user}`);
			friendElement.innerHTML = `
				<div class="friend-status ${friend.is_online ? 'online' : 'offline'}">
					<img src="${friend.avatar}"
						class="friend-avatar" 
						onclick="window.location.href='#user?username=${user}'">
						<span class="friend-tooltip">${friend.display_name}</span>
				</div>
				<div class="friend-name user-${user}">${friend.display_name}</div>
			`;
			friendsList.appendChild(friendElement);
		});
	}
	convertDate(ugly_date) {
		const date = new Date(ugly_date);
		const jour = date.getDate().toString().padStart(2, '0'); // Jour avec deux chiffres
		const mois = (date.getMonth() + 1).toString().padStart(2, '0'); // Mois (index commence à 0)
		const annee = date.getFullYear();
		const heures = date.getHours().toString().padStart(2, '0');
		const minutes = date.getMinutes().toString().padStart(2, '0');

		return `${jour}/${mois}/${annee} ${heures}h${minutes}`;
	}

	displayScores() {
		if (!this.userInfo.scores_set || !this.userInfo.scores_set.length) return;
		const scoreTable = document.getElementById('score-table');
		scoreTable.innerHTML = '';
		this.userInfo.scores_set.forEach(score => {
				const row = document.createElement('tr');
				row.innerHTML = `
				<td>${this.convertDate(score.date)}</td>
				<td><a class="lobby-link" href="#lobby?id=${score.lobby_id}">${score.lobby_name}</a></td>
				<td>${score.game_name}</td>
				<td>${score.score}</td>
				<td class="${score.has_win ? 'has-win' : 'has-lose'}">${score.has_win ? 'Won' : 'Lost'}</td>
				`;
				// row.classList.add(score.has_win ? 'has-win' : 'has-lose');
				scoreTable.appendChild(row);
			});
	}

	async updateUserInfos(username, data) {
		const friend_el = document.querySelector(`.friend-element.user-${username}`);
		const user = new User(username, data);
		if (friend_el) {
			const status_div = friend_el.querySelector('.friend-status');
			status_div.classList.remove('online', 'offline');
			status_div.classList.add(user.is_online ? 'online' : 'offline');
			friend_el.querySelector('img').src = user.avatar;
			friend_el.querySelector('span').innerText = user.display_name;
			friend_el.querySelector(`.friend-name.user-${username}`).innerText = user.display_name;
		}
	}

}