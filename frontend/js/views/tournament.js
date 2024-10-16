import { BaseView } from '../view-manager.js';
import { authenticatedUser, User, userManager } from '../home.js';
import TournamentTree from '../components/tournamentTree.js';

export default class TournamentView extends BaseView {

	async initView() {
		this.tournament_id =this.urlParams.get('id');
		if (!this.tournament_id) {
			this.errorHandler("No tournament specified !");
			return;
		}
		this.tournamentData = await this.fetchTournamentData();
		if (!this.tournamentData) {
			this.errorHandler("Failed to retrieve tournament informations");
			return;
		}
		this.tournamentName = document.getElementById("tournamentName");
		this.tournamentDate = document.getElementById("tournamentDate");
		this.tournamentHost = document.getElementById("tournamentHost");
		this.tournamentGame = document.getElementById("tournamentGame");
		userManager.setDynamicUpdateHandler(this.updateUserInfos);
		await this.displayTournamentInfos();
		const tournamentDiv = document.getElementById('tournamentContainer');
		this.tournamentTree = new TournamentTree(this.tournament_id, this.tournamentData);
		this.tournamentTree.setErrorHandler(this.errorHandler);
		this.tournamentTree.init(tournamentDiv);
		await userManager.forceUpdate();
	}

	async cleanupView() {
		// Nettoie les éléments du DOM et réinitialise les données
		if (this.tournamentTree)
			await this.tournamentTree.cleanupView();
	}

	async fetchTournamentData() {
		const response = await fetch(`https://${window.location.host}/api/tournaments/${this.tournament_id}/`);
		if (!response.ok) {
			return;
		}
		return await response.json();
	}

	async displayTournamentInfos() {
		this.tournamentName.textContent = this.tournamentData.tournament_name;
		this.tournamentDate.textContent = new Date(this.tournamentData.date).toLocaleString();
		this.tournamentGame.textContent = this.tournamentData.game_name;
		const host = new User(this.tournamentData.host, await userManager.getUserInfo(this.tournamentData.host));
		this.tournamentHost.innerHTML += `
			<div class="user-info user-${host.username}">
				<div class="user-status user-status-small ${host.is_online ? 'online' : 'offline'}">
					<img src="${host.avatar}"
					class="user-avatar user-avatar-small"
					onclick="window.location.href='#user?username=${host.username}'">
				</div>
				<span class="user-name">${host.display_name}</span>
			</div>`;
	}

	async updateUserInfos(username, userInfo) {
		const user = new User(username, userInfo);
		document.querySelectorAll(`div.user-info.user-${username}`).forEach((scoreEl) => {
			scoreEl.querySelector('img').src = user.avatar;
			scoreEl.querySelector('.user-name').innerText = user.display_name;
		});
	}

	
}