import { ComponentView } from "../view-manager.js";
import { userManager, User } from "../home.js";

export default class TournamentTree extends ComponentView {
	constructor(tournamentId, tournamentData = undefined) {
		super();
		this.tournamentId = tournamentId;
		this.tournamentData = tournamentData;
		this.htmlContent = `
			<style>
				#tournamentTree {
					display: flex;
					gap: 40px;
					padding: 20px;
					justify-content: center;
				}
				.round {
					display: flex;
					flex-direction: column;
					gap: 20px;
				}
					.match-container {
					/* position: relative; */
					display: flex;
					align-items: center;
				}
				.match {
					border: 1px solid #ddd;
					border-radius: 5px;
					padding: 8px;
					width: 200px;
					background-color: white;
					display: flex;
					flex-direction: column;
					gap: 5px;
					height: 115px;
				}
				.match.not-completed {
					justify-content: center;
					text-align: center;
					font-style: italic;
				}
				.match.not-completed p {
					margin: 0;
					color: rgb(107, 107, 107);
				}
				.player {
					display: flex;
					align-items: center;
					justify-content: space-between;
				}
				.winner {
					font-weight: bold;
					color: green;
				}
				.round-title {
					text-align: center;
					font-weight: bold;
					margin-bottom: 10px;
				}
				.online {
					border: 2px solid green;
				}
					.offline {
					border: 2px solid red;
				}
				.user-info {
					display: flex;
					align-items: center;
				}
				.user-status {
					width: 46px;
					height: 46px;
					border-radius: 50%;
					display: inline-flex;
					justify-content: center;
					align-items: center;
					margin-right: 10px;
				}
				.user-avatar {
					width: 40px;
					height: 40px;
					border-radius: 50%;
					object-fit: cover;
				}
				@media (min-width:480px) and (max-width:800px) {
					.match {
						width: 130px;
					}
				}
				@media (max-width:480px) {
					#tournamentTree {
						display: grid;
					}
					.match-container {
						margin-top: 0px !important;
					}
				}
			</style>
			<div id="tournamentTree"></div>
		`;
		this.divHeight = 115;
		this.spacing = 10;
		this.marginsTop = [
			[[0]],
			[[(2 * this.divHeight + 1 * this.spacing) / 2 - (this.divHeight / 2)], [0, 0]],
			[[(4 * this.divHeight + 3 * this.spacing) - (this.divHeight * 2 + this.spacing)- (this.divHeight / 2)], [65, 140], [0, 0, 0, 0]]
		];
	}

	async init(parentContainer) {
		super.init(parentContainer);
		if (!this.tournamentData)
			this.tournamentData = await this.fetchTournamentData();
		if (!this.tournamentData) {
			this.errorHandler("Failed to retrieve tournament informations");
			return;
		}
		// userManager.setDynamicUpdateHandler(this.updateUserInfos);
		await this.renderTournament();
	}

	async fetchTournamentData() {
		const response = await fetch(`https://${window.location.host}/api/tournaments/${this.tournamentId}/`);
		if (!response.ok) {
			return;
		}
		return await response.json();
	}

	async updateUserInfos(username, userInfo) {
		const user = new User(username, userInfo);
		document.querySelectorAll(`div.user-info.user-${username}`).forEach((scoreEl) => {
			scoreEl.querySelector('img').src = user.avatar;
			scoreEl.querySelector('.user-name').innerText = user.display_name;
		});
	}

	computeNbrRounds(nbr_player) {
		if (nbr_player % 2)
			return 0;
		var count = 0;
		while (nbr_player / 2 >= 1) {
			nbr_player /= 2;
			count++;
		}
		return count;
	}

	async renderTournament() {
		const { lobbies_set } = this.tournamentData;
		console.log(this.tournamentData);

		
		const nbr_rounds = this.computeNbrRounds(this.tournamentData.number_players);
		const treeContainer = this.element.querySelector('#tournamentTree');
		const rounds = this.organizeMatches(lobbies_set, nbr_rounds);
		const max_index = nbr_rounds - 1;

		rounds.reverse().forEach((round, roundIndex) => {
			roundIndex = max_index - roundIndex;
			const roundDiv = document.createElement('div');
			roundDiv.className = 'round';
			
			const roundTitle = document.createElement('div');
			roundTitle.className = 'round-title';
			roundTitle.textContent = this.getRoundName(roundIndex);
			roundDiv.appendChild(roundTitle);
			
			const matchContainers = this.createMatchContainers(max_index, roundIndex, round.length);
		
			// for (var i = 0; i < 2^roundIndex; i++) {

			// }
			round.forEach(async (match, matchIndex) => {
				const matchDiv = await this.createMatchElement(match, roundIndex, rounds.length);
				matchContainers[matchIndex].appendChild(matchDiv);
			});
			
			matchContainers.forEach(container => roundDiv.appendChild(container));
			treeContainer.appendChild(roundDiv);
		});
	}
	
	createMatchContainers(max_index, roundIndex, count) {
		const containers = [];
		for (let i = 0; i < count; i++) {
		const container = document.createElement('div');
		container.className = 'match-container';
		container.style.marginTop = `${this.marginsTop[max_index][roundIndex][i]}px`;
		containers.push(container);
		}
		return containers;
	}
	
	async createMatchElement(match) {
		const matchDiv = document.createElement('div');
		matchDiv.classList.add('match')
		if (!match.completed)
			matchDiv.classList.add('not-completed');
		matchDiv.innerHTML = await this.createMatchHTML(match);
		return matchDiv;
	}
	
	organizeMatches(lobbies_set, nbr_rounds) {
		const rounds = [];
		const defaultRoundModel = {completed: false};
		for (var i = 0; i < nbr_rounds; i++) {
			rounds[i] = [];
			for (var y = 0; y < 2 ** i; y++) {
				rounds[i][y] = {...defaultRoundModel};
			}
		}
		lobbies_set.forEach(lobby => {
			const roundNumber = parseInt(lobby.lobby_id.split('.')[1]);
			const matchNumber = !roundNumber ? 0 : parseInt(lobby.lobby_id.split('.')[2]);
			if (roundNumber > 2 || matchNumber > 3) {
				console.error(`Invalid tournament: roundNumber=${roundNumber}, matchNumber=${matchNumber}`);
				throw new Error("Invalid tournament structure");
			}
			rounds[roundNumber][matchNumber] = lobby;
			rounds[roundNumber][matchNumber].completed = true;
		});
		return rounds;
	}
	
	getRoundName(index) {
		const roundNames = ['Finale', 'Demi-finales', 'Quarts de finale'];
		return roundNames[index] || `Round ${index + 1}`;
	}
	
	async createMatchHTML(match) {
		var htmlContent = "";

		if (match.completed) {
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
		} else {
			htmlContent = `<p>En attente...</p>`;
		}

		return htmlContent;
	}
}

export class LocalTournamentTree extends TournamentTree {
	constructor(tournamentId, buttonCreationHandler, tournamentData = undefined) {
		super(tournamentId, tournamentData);
		this.htmlContent += `
			<style>
				.match {
					height: 155px;
				}
				
			</style>
		`;
		this.buttonCreationHandler = buttonCreationHandler;
		this.divHeight = 155;
		this.spacing = 10;
		this.marginsTop = [
			[[0]],
			[[(2 * this.divHeight + 1 * this.spacing) / 2 - (this.divHeight / 2)], [0, 0]],
			[[(4 * this.divHeight + 3 * this.spacing) - (this.divHeight * 2 + this.spacing)- (this.divHeight / 2)], [65, 140], [0, 0, 0, 0]]
		];
	}

	async createMatchElement(match) {
		console.log(match);
		const matchDiv = await super.createMatchElement(match);
		const button = document.createElement('button');
		button.classList = "btn btn-primary";
		this.buttonCreationHandler(button, match);
		matchDiv.appendChild(button);
		return matchDiv;
	}


}
