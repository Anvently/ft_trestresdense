import { BaseView } from '../view-manager.js';
import { userManager, User } from '../home.js'

export default class LobbyView extends BaseView {
	async initView() {
		this.lobby_id =this.urlParams.get('id');
		if (!this.lobby_id) {
			this.errorHandler("No lobby specified !");
			return;
			// May throw an error if we want to redirect user to the previous page
		}
		const response = await fetch(`https://${window.location.host}/api/lobbies/${this.lobby_id}/`);
		if (!response.ok) {
			this.errorHandler("Failed to retrieve lobby informations");
			throw new Error("Failed to retrieve lobby informations");
			return;
		}
		this.lobbyData = await response.json();
	
		this.lobbyName = document.getElementById('lobby-name');
		this.lobbyDate = document.getElementById('lobby-date');
		this.hostCell = document.getElementById('lobby-host');
		this.gameName = document.getElementById('lobby-game-name');
		this.tournamentName = document.getElementById('lobby-tournament-name');
		this.tournamentLink = document.getElementById('lobby-tournament-link');
		userManager.setDynamicUpdateHandler(this.updateUserInfos);
		await this.displayLobbyInfo();
		await this.displayPlayerScores();
		await userManager.forceUpdate();
	}

	cleanupView() {
		// Clean up any event listeners or other resources
	}

	async displayLobbyInfo() {
		this.lobbyName.textContent = this.lobbyData.lobby_name;
		this.lobbyDate.textContent = new Date(this.lobbyData.date).toLocaleString();
		const host = new User(this.lobbyData.host, await userManager.getUserInfo(this.lobbyData.host));
		this.hostCell.innerHTML = `
			<div class="user-info">
				<div class="user-status user-status-small ${host.is_online ? 'online' : 'offline'}">
					<img src="${host.avatar}"
					class="user-avatar user-avatar-small"
					onclick="window.location.href='#user?username=${host.username}'">
				</div>
				<span class="user-name">${host.display_name}</span>
			</div>`;
		this.hostCell.classList.add(`user-${host.username}`);
		this.gameName.textContent = this.lobbyData.game_name;
		if (this.lobbyData.tournament_id) {
			this.tournamentLink.textContent = this.lobbyData.tournament_name;
			this.tournamentLink.href = `https://${window.location.host}/#tournament?id=${this.lobbyData.tournament_id}`;
			document.querySelector(".tournament-details").classList.remove('d-none');
		}
	}

	async displayPlayerScores() {
		const scoreTable = document.getElementById('scores-table');
		await Promise.all(this.lobbyData.scores_set.map(async score => {
			const user = new User(score.username, await userManager.getUserInfo(score.username));
			const row = document.createElement('tr');
			row.classList.add(score.has_win ? 'winner' : 'loser');
			row.innerHTML = `
			<td class="user-${user.username}">
				<div class="user-info">
					<div class="user-status ${user.is_online ? 'online' : 'offline'}">
						<img src="${user.avatar}"
						class="user-avatar"
						onclick="window.location.href='#user?username=${user.username}'">
					</div>
					<span class="user-name">${user.display_name}</span>
				</div>
			</td>
			<td>${score.score}</td>
			<td class="${score.won ? 'winner' : ''}">${score.has_win ? 'Won' : 'Lost'}</td>
			`;
			scoreTable.appendChild(row);
		}));
	}

	async updateUserInfos(username, userInfo) {
		const user = new User(username, userInfo);
		document.querySelectorAll(`td.user-${username}`).forEach((scoreEl) => {
			scoreEl.querySelector('img').src = user.avatar;
			scoreEl.querySelector('.user-name').innerText = user.display_name;
		});
	}
}