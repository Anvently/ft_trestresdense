import { BaseView } from '../view-manager.js';
import { userManager } from '../home.js'

export default class LobbyView extends BaseView {
	initView(urlParams) {
		console.log(urlParams);
		// const lobbyId = new URLSearchParams(window.location.search).get('id');
		// this.fetchLobbyData(lobbyId);
	}

	cleanupView() {
		// Clean up any event listeners or other resources
	}

	fetchLobbyData(lobbyId) {
		fetch(`/api/lobbies/${lobbyId}`)
			.then(response => response.json())
			.then(data => {
			this.displayLobbyInfo(data.lobby);
			this.displayPlayerScores(data.playerScores);
			})
			.catch(error => console.error('Error fetching lobby data:', error));
	}

	displayLobbyInfo(lobby) {
		document.getElementById('lobby-name').textContent = lobby.name;
		document.getElementById('game-info').textContent = `Game: ${lobby.game} | Date: ${lobby.date}`;
	}

	displayPlayerScores(playerScores) {
		const scoreTable = document.getElementById('player-scores');
		playerScores.forEach(score => {
			const row = document.createElement('tr');
			row.innerHTML = `
			<td>
				<img class="avatar mr-2" src="${score.avatarUrl}" alt="${score.name}'s Avatar">
				<a href="/users?userId=${score.id}">${score.name}</a>
			</td>
			<td>${score.score}</td>
			<td class="${score.won ? 'winner' : ''}">${score.won ? 'Won' : 'Lost'}</td>
			`;
			scoreTable.appendChild(row);
		});
	}
}