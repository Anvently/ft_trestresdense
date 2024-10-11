import { BaseView } from '../view-manager.js';
import { authenticatedUser, User, userManager } from '../home.js';

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
		await this.renderTournament();
	}

	cleanupView() {
		// Nettoie les éléments du DOM et réinitialise les données
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

	updateUserInfos(username, userInfo) {
		const scoreEl = document.querySelector(`div.user-info.user-${username}`);
		const user = new User(username, userInfo);
		if (scoreEl) {
			scoreEl.querySelector('img').src = user.avatar;
			scoreEl.querySelector('.user-name').innerText = user.display_name;
		}
	}

	async renderTournament() {
		const { lobbies_set } = this.tournamentData;
		
		const treeContainer = document.getElementById('tournamentTree');
		const rounds = this.organizeMatches(lobbies_set);
		const max_index = rounds.length - 1;

		rounds.reverse().forEach((round, roundIndex) => {
			roundIndex = max_index - roundIndex;
			const roundDiv = document.createElement('div');
			roundDiv.className = 'round';
			
			const roundTitle = document.createElement('div');
			roundTitle.className = 'round-title';
			roundTitle.textContent = this.getRoundName(roundIndex);
			roundDiv.appendChild(roundTitle);
			
			const matchContainers = this.createMatchContainers(max_index, roundIndex, round.length);
		
			round.forEach(async (match, matchIndex) => {
				const matchDiv = await this.createMatchElement(match, roundIndex, rounds.length);
				matchContainers[matchIndex].appendChild(matchDiv);
			});
			
			matchContainers.forEach(container => roundDiv.appendChild(container));
			treeContainer.appendChild(roundDiv);
		});
	}
	
	createMatchContainers(max_index, roundIndex, count) {
		const divHeight = 115;
		const spacing = 10;
		const marginsTop = [
			[[0]],
			[[(2 * divHeight + 1 * spacing) / 2 - (divHeight / 2)], [0, 0]],
			[[(4 * divHeight + 3 * spacing) - (divHeight * 2 + spacing)- (divHeight / 2)], [65, 140], [0, 0, 0, 0]]
		];
		const containers = [];
		for (let i = 0; i < count; i++) {
		const container = document.createElement('div');
		container.className = 'match-container';
		console.log(max_index, roundIndex, i);
		container.style.marginTop = `${marginsTop[max_index][roundIndex][i]}px`;
		containers.push(container);
		}
		return containers;
	}
	
	async createMatchElement(match, roundIndex, totalRounds) {
		const matchDiv = document.createElement('div');
		matchDiv.className = 'match';
		matchDiv.innerHTML = await this.createMatchHTML(match);
		
		// if (roundIndex) {
		//   const horizontalConnector = document.createElement('div');
		//   horizontalConnector.className = 'connector connector-horizontal';
		//   matchDiv.appendChild(horizontalConnector);
	
		//   const verticalConnector = document.createElement('div');
		//   verticalConnector.className = 'connector connector-vertical';
		//   verticalConnector.style.height = `${Math.pow(2, roundIndex - 1) * 100}px`;
		//   verticalConnector.style.top = '50%';
		//   matchDiv.appendChild(verticalConnector);
		// }
		
		return matchDiv;
	}
	
	organizeMatches(lobbies_set) {
		const rounds = [];
		lobbies_set.forEach(lobby => {
		const roundNumber = lobby.lobby_id.split('.')[1];
		if (!rounds[roundNumber]) {
			rounds[roundNumber] = [];
		}
		rounds[roundNumber].push(lobby);
		});
		return rounds;
	}
	
	getRoundName(index) {
		const roundNames = ['Finale', 'Demi-finales', 'Quarts de finale'];
		return roundNames[index] || `Round ${index + 1}`;
	}
	
	async createMatchHTML(match) {
		var htmlContent = "";

		await match.scores_set.forEach(async score => {
			const player = new User(score.username, await userManager.getUserInfo(score.username));
			htmlContent += `
			<div class="user-info user-${player.username} player ${score.has_win ? 'winner' : ''}">
				<div class="user-status user-status ${player.is_online ? 'online' : 'offline'}">
					<img src="${player.avatar}"
					class="user-avatar user-avatar"
					onclick="window.location.href='#user?username=${player.username}'">
				</div>
				<span class="user-name">${player.display_name}</span>
				<span>${score.score}</span>
			</div>
			`;
		});
		console.log(htmlContent);

		return htmlContent;
	}
}