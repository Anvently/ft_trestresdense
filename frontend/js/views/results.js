import { BaseView } from '../view-manager.js';
import { userManager, User } from '../home.js'

export default class ResultsView extends BaseView {

	async initView() {
		
		await Promise.all([
			this.fetchLobbiesResults(),
			this.fetchTournaments()
		]);
		userManager.setDynamicUpdateHandler(this.updateUserInfos);
		await this.displayLobbies();
		await this.displayTournaments();
		// await this.displayLobbyInfo();
		// await this.displayPlayerScores();
		await userManager.forceUpdate();
	}

	cleanupView() {
		// Clean up any event listeners or other resources
	}

	async fetchLobbiesResults() {
		const response = await fetch(`https://${window.location.host}/api/lobbies/`);
		if (!response.ok) {
			this.errorHandler("Failed to retrieve lobbies results from api");
			return;
		}
		this.lobbiesResults = await response.json();
	}

	async fetchTournaments() {
		const response = await fetch(`https://${window.location.host}/api/tournaments/`);
		if (!response.ok) {
			this.errorHandler("Failed to retrieve tournaments from api");
			return;
		}
		this.tournaments = await response.json();
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

	async displayLobbies() {
		if (!this.lobbiesResults || this.lobbiesResults.length === 0) {
			return;
		}
		const lobbiesTable = document.getElementById('lobbies-table');
		lobbiesTable.innerHTML = "";
		await Promise.all(this.lobbiesResults.map(async lobby => {
			const hostName = (lobby.host ? lobby.host : lobby.tournament_host);
			const host = new User(hostName, await userManager.getUserInfo(hostName)); 
			const row = document.createElement('tr');
			row.innerHTML = `
			<td>${this.convertDate(lobby.date)}</td>
			<td><a class="lobby-link" href="#lobby?id=${lobby.lobby_id}">${lobby.lobby_name}</a></td>
			<td class="user-${host.username}">
				<div class="user-info">
					<div class="user-status ${host.is_online ? 'online' : 'offline'}">
						<img src="${host.avatar}"
						class="user-avatar"
						onclick="window.location.href='#user?username=${host.username}'">
					</div>
					<span class="user-name">${host.display_name}</span>
				</div>
			</td>
			<td>${lobby.game_name}</td>
			<td>${lobby.scores_set.length}</td>`;
			lobbiesTable.appendChild(row);
		}));
	}

	async displayTournaments() {
		if (!this.tournaments || this.tournaments.length === 0) {
			return;
		}
		const tournamentsTable = document.getElementById('tournaments-table');
		tournamentsTable.innerHTML = "";
		await Promise.all(this.tournaments.map(async tournament => {
			const host = new User(tournament.host, await userManager.getUserInfo(tournament.host)); 
			const row = document.createElement('tr');
			row.innerHTML = `
			<td>${this.convertDate(tournament.date)}</td>
			<td><a class="tournament-link" href="#tournament?id=${tournament.tournament_id}">${tournament.tournament_name}</a></td>
			<td class="user-${host.username}">
				<div class="user-info">
					<div class="user-status ${host.is_online ? 'online' : 'offline'}">
						<img src="${host.avatar}"
						class="user-avatar"
						onclick="window.location.href='#user?username=${host.username}'">
					</div>
					<span class="user-name">${host.display_name}</span>
				</div>
			</td>
			<td>${tournament.game_name}</td>
			<td>${tournament.number_players}</td>`;
			tournamentsTable.appendChild(row);
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