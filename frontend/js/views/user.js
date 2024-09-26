import { BaseView } from '../view-manager.js';
import { userManager, User } from '../home.js'

export default class UserView extends BaseView {
	constructor() {
		super('user-view');
	}
	
	async initView() {
		console.log(this.urlParams);
		this.username = this.urlParams.get('username');
		if (!this.username) {
			this.errorHandler("No user specified !");
			return;
			// May throw an error if we want to redirect user to the previous page
		}
		this.userInfo = new User(this.username, await userManager.fetchUserInfo(this.username));
		console.log(this.userInfo);
		if (!this.userInfo.valid_info) {
			this.errorHandler("Failed to retrieve user informations");
			throw new Error("Failed to retrieve user informations");
			return;
		}
		this.displayUserInfo();
		// this.displayFriends();
		this.displayScores();

	}

	async cleanupView() {
		// Clean up any event listeners or other resources
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
		document.getElementById('user-avatar').src = this.userInfo.avatar;
		document.getElementById('user-display-name').textContent = this.userInfo.display_name;
	}

	displayFriends() {
		const friendList = document.getElementById('friend-list');
		friends.forEach(friend => {
			const friendItem = document.createElement('li');
			const friendLink = document.createElement('a');
			friendLink.classList.add('friend-link');
			friendLink.href = `/users?userId=${friend.id}`;
			friendLink.textContent = friend.displayName;
			const friendAvatar = document.createElement('img');
			friendAvatar.classList.add('avatar', 'mr-2');
			friendAvatar.src = friend.avatarUrl;
			friendItem.appendChild(friendAvatar);
			friendItem.appendChild(friendLink);
			friendList.appendChild(friendItem);
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
		const scoreTable = document.getElementById('score-table');
		this.userInfo.scores_set.forEach(score => {
				const row = document.createElement('tr');
				row.innerHTML = `
				<td>${this.convertDate(score.date)}</td>
				<td><a class="lobby-link" href="/#lobby?id=${score.lobby_id}">${score.lobby_name}</a></td>
				<td>${score.game_name}</td>
				<td>${score.score}</td>
				<td class="${score.has_win ? 'has-win' : 'has-lose'}">${score.has_win ? 'Won' : 'Lost'}</td>
				`;
				// row.classList.add(score.has_win ? 'has-win' : 'has-lose');
				scoreTable.appendChild(row);
			});
		}
}