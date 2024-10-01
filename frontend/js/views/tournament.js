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
        this.renderTournament();
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

	renderTournament() {
		const { game_name, date, lobbys_set } = this.tournamentData;
		document.getElementById('tournamentName').textContent = `Tournoi de ${game_name}`;
		document.getElementById('tournamentDate').textContent = `Date: ${new Date(date).toLocaleString()}`;
		
		const treeContainer = document.getElementById('tournamentTree');
		const rounds = this.organizeMatches(lobbys_set);
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
		
			round.forEach((match, matchIndex) => {
				const matchDiv = this.createMatchElement(match, roundIndex, rounds.length);
				matchContainers[matchIndex].appendChild(matchDiv);
			});
			
			matchContainers.forEach(container => roundDiv.appendChild(container));
			treeContainer.appendChild(roundDiv);
		});
	  }
	
	  createMatchContainers(max_index, roundIndex, count) {
		const divHeight = 100;
		const spacing = 20;
		const marginsTop = [
			[[0]],
			[[(2 * divHeight + 1 * spacing) / 2 - (divHeight / 2)], [0, 0]],
			[[(4 * divHeight + 3 * spacing) - (divHeight * 2 + spacing)- (divHeight / 2)], [50, 130], [0, 0, 0, 0]]
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
	
	  createMatchElement(match, roundIndex, totalRounds) {
		const matchDiv = document.createElement('div');
		matchDiv.className = 'match';
		matchDiv.innerHTML = this.createMatchHTML(match);
		
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
	
	  organizeMatches(lobbys_set) {
		const rounds = [];
		lobbys_set.forEach(lobby => {
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
	
	  createMatchHTML(match) {
		return match.scores_set.map(player => `
		  <div class="player ${player.has_win ? 'winner' : ''}">
			<img src="/avatars/__default__.jpg" alt="${player.display_name}'s avatar">
			<span>${player.display_name}</span>
			<span>${player.score}</span>
		  </div>
		`).join('');
	  }
}