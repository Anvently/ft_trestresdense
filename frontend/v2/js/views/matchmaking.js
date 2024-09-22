import { BaseView } from '../view-manager.js';

export default class MatchmakingView extends BaseView {
    constructor() {
        super('matchmaking-view');
        this.socket = null;
		this.isConnected = false;
		this.isHost = false;
		this.lobbyId;
		this.url = `wss://${location.host}/ws/matchmaking/`;
    }

    async initView() {

        // Initialiser la connexion WebSocket
        this.initWebSocket();

		this.closeErrorButton = document.querySelector('#errorPopup button');
		this.showOnlinePLayersButton = document.getElementById('buttonShowOnlinePlayers');
		this.openLobbyOptionsButton = document.getElementById('buttonOptionsLobby');
		this.startGameButton = document.getElementById('startGameButton');
		this.inviteFriendsButton = document.getElementById('inviteFriendsButton');
		this.beReadyButton = document.getElementById('beReadyButton');
		this.leaveLobbyButton = document.getElementById('leaveLobbyButton');
		this.joinLobbyButton = document.getElementById('joinLobbyButton');
		this.createLobbyButton = document.getElementById('createLobbyButton');
		this.saveLobbyOptionsButton = document.getElementById("saveLobbyOptionsButton");

		this.closeErrorButton.addEventListener('click', (e) => this.closeErrorPopup());
		this.showOnlinePLayersButton.addEventListener('click', () => this.showOnlinePlayers());
		this.openLobbyOptionsButton.addEventListener('clck', (e) => this.openLobbyOptions());
		this.startGameButton.addEventListener('click', () => this.startGame());
		this.inviteFriendsButton.addEventListener('click', () => this.inviteFriends());
		this.beReadyButton.addEventListener('click', () => this.beReady());
		this.leaveLobbyButton.addEventListener('click', () => this.leaveLobby());
		this.joinLobbyButton.addEventListener('click', () => this.joinLobbyById());
		this.createLobbyButton.addEventListener('click', () => this.createLobby());
		this.saveLobbyOptionsButton.addEventListener('click', () => this.saveLobbyOptions());
	}

    initWebSocket() {
        this.socket = new WebSocket(this.url);

		this.socket.onopen = () => {
			console.log('WebSocket connected');
			this.isConnected = true;
		};

		this.socket.onmessage = (event) => {
			const message = JSON.parse(event.data);
			console.log('Received message:', message);
			this.dispatch(message)
		};

		this.socket.onclose = () => {
			console.log('WebSocket disconnected');
			this.isConnected = false;
		};

		this.socket.onerror = (error) => {
			console.error('WebSocket error:', error);
		};
    }

	sendMessage(message) {
		this.socket.send(JSON.stringify(message));
	}

    general_update(message) {
		const availableLobbiesEl = document.querySelector('#availableLobbies tbody');
		const ongoingMatchesEl = document.querySelector('#ongoingMatches tbody');
	
		availableLobbiesEl.innerHTML = '';
		ongoingMatchesEl.innerHTML = '';
	
		message.availableLobbies.forEach(lobby => {
			const [id, obj] = Object.entries(lobby)[0];
			availableLobbiesEl.innerHTML += this.createLobbyHTML(id, obj, true);
			document.getElementById(`joinLobbyButton-${id}`).addEventListener('click', () => {
				this.joinLobby(id);
			});
		});
	
		message.ongoingMatches.forEach(match => {
			const [id, obj] = Object.entries(match)[0];
			ongoingMatchesEl.innerHTML += this.createLobbyHTML(id, obj, false);
			document.getElementById(`spectateLobbyButton-${id}`).addEventListener('click', () => {
				this.spectateLobby(id);
			});
		});
	}
	
	createLobbyHTML(id, lobby, isAvailable) {
		// console.log(id)
		const tournamentClass = lobby.match_type == 'tournament_lobby' ? 'tournament' : '';
		const actionButton = isAvailable
			? `<button class="btn btn-sm btn-primary" id="joinLobbyButton-${id}">Rejoindre</button>`
			: `<button class="btn btn-sm btn-secondary" id="spectateLobbyButton-${id}"">Observer</button>`;

		return `
			<tr class="${tournamentClass}" id="${id}">
				<td>${lobby.name}</td>
				<td>${lobby.game_type}</td>
				<td>${lobby.host}</td>
				<td>${lobby.slots}</td>
				<td>${actionButton}</td>
			</tr>
		`;
	}
	
	createLobby() {
		const form = document.getElementById('createLobbyForm');
		console.log(document.querySelectorAll('.form-errors'));
		document.querySelectorAll('.form-errors').forEach(function(el) {
			el.style.display = 'none';
		});
		// Récupérer les valeurs
		const gameType = form.gameType.value;
		const matchType = form.matchType.value;
		const lobbyName = form.lobbyName.value.trim();
		const maxPlayers = parseInt(form.maxPlayers.value, 10);
		const botsCount = parseInt(form.botsCount.value, 10);
		const lobbyPrivacy = form.lobbyPrivacy.value;
		const spectators = form.spectators.value;
		const nbrLives = form.nbrLives.value;
	
		let errorMessage, error = false;
	
		if (!lobbyName) {
			errorMessage = document.getElementById('error-message-lobby-name')
			errorMessage.style.display = 'block';
			errorMessage.innerHTML = "Le nom du lobby ne peut pas être vide.";
			error = true;
		}
		errorMessage = document.getElementById('error-message-max-players')
		if (maxPlayers && maxPlayers >= 2 && maxPlayers <= 8) {
			if (matchType === 'tournament_lobby') {
				if (![2, 4, 8].includes(maxPlayers)) {
					errorMessage.innerHTML = "Le nombre de joueurs doit être pair et compris entre 2 et 8.";
					errorMessage.style.display = 'block';
					error = true;
				}
			} else {
				if (maxPlayers > 4) {
					errorMessage.innerHTML = "Le nombre de joueurs doit être inferieur a 4.";
					errorMessage.style.display = 'block';
					error = true;
				}
				if (gameType === 'pong3d' && maxPlayers > 2) {
					errorMessage.innerHTML = "Le nombre de joueurs doit être inferieur a 2 pour le jeu que vous avez choisi.";
					errorMessage.style.display = 'block';
					error = true;
				}
			}
		}
		else {
			errorMessage.innerHTML = "Le nombre maximum de joueurs doit être compris entre 2 et 8.";
			errorMessage.style.display = 'block';
			error = true;
		}
		if (!botsCount || botsCount < 0 || botsCount > maxPlayers - 1) {
			errorMessage = document.getElementById('error-message-nbr-bots')
			errorMessage.style.display = 'block';
			errorMessage.innerHTML = "Le nombre de bots doit être compris entre 0 et le nombre maximum de joueurs.";
			error = true;
		}
	
		if (error) {
			return;
		}
	
		// Logique de création de lobby (API, stockage, etc.)
		console.log({
			gameType,
			matchType,
			lobbyName,
			maxPlayers,
			botsCount,
			lobbyPrivacy,
			spectators,
			nbrLives
		});
	
		this.sendMessage({
			type: 'create_lobby',
			lobby_type: matchType,
			name: lobbyName,
			nbr_players: maxPlayers,
			nbr_bots: botsCount,
			game_type: gameType,
			public: (lobbyPrivacy === 'public' ? true : false),
			allow_spectators: (spectators === 'allowed' ? true: false),
			lives: nbrLives
		});
	
		// Fermer la modale
		const modal = bootstrap.Modal.getInstance(document.getElementById('createLobbyModal'));
		modal.hide();
	}
	
	joinLobbyById() {
		const lobbyId = document.getElementById('lobbyIdInput').value;
		console.log('Rejoindre le lobby avec l\'ID:', lobbyId);
		// Implémentez la logique pour rejoindre le lobby ici
	}
	
	switchLobbyView() {
	
		document.getElementById('mainView').style.display = (this.lobbyId === undefined ? 'none' : 'block');
		document.getElementById('lobbyView').style.display = (this.lobbyId === undefined ? 'block' : 'none');
		// Pour tous les éléments avec la classe 'mainView'
		document.querySelectorAll('.mainView').forEach((element) => {
			element.style.display = (this.lobbyId === undefined ? 'none' : 'block');
		});
		// Pour tous les éléments avec la classe 'lobbyView'
		document.querySelectorAll('.lobbyView').forEach((element) => {
			element.style.display = (this.lobbyId === undefined ? 'block' : 'none');
		});
		document.getElementById('hostOptions').style.display = (this.lobbyId === undefined && this.isHost === true ? 'flex' : 'none');
	
		// Recevoir les détails du lobby via WebSocket
		// socket.sendMessage({ type: 'getLobbyDetails', lobbyId: lobbyId });
	}
	
	joinLobby(lobbyId) {
		console.log('Rejoindre le lobby:', lobbyId);
		// Implémentez la logique pour rejoindre le lobby ici
		this.sendMessage({ type: 'join_lobby', lobby_id: lobbyId });
		this.switchLobbyView(lobbyId);
		this.lobbyId = lobbyId
	}
	
	leaveLobby() {
		console.log('Quitter le lobby:', this.lobbyId);
		// socket.sendMessage({ type: 'leave_lobby', lobbyId: lobbyId });
		this.switchLobbyView()
		this.lobbyId = undefined
	}
	
	lobby_update(message) {
		const lobbyNameEl = document.getElementById('lobbyName');
		const playerListEl = document.getElementById('playerList');
		const hostOptionsEl = document.getElementById('hostOptions');
	
		lobbyNameEl.textContent = message.lobbyName;
		playerListEl.innerHTML = '';  // Vider la liste avant mise à jour
	
		message.players.forEach(player => {
			const playerRow = document.createElement('tr');
			const playerState = player.isReady ? 'Prêt' : (player.hasJoined ? 'A rejoint' : 'N\'a pas encore rejoint');
			
			playerRow.innerHTML = `
				<td>${player.name}</td>
				<td>${playerState}</td>
				<td>
					${isHost && player.id !== message.hostId ? `<button class="btn btn-danger" onclick="kickPlayer('${player.id}')">Expulser</button>` : ''}
				</td>
			`;
			playerListEl.appendChild(playerRow);
		});
	
		// Gérer les slots libres
		for (let i = message.players.length; i < message.maxSlots; i++) {
			const emptySlotRow = document.createElement('tr');
			emptySlotRow.classList.add('text-muted');
			emptySlotRow.innerHTML = `
				<td>Slot libre</td>
				<td>En attente</td>
				<td>${isHost ? `<button class="btn btn-info" onclick="addBot()">Ajouter un bot</button>` : ''}</td>
			`;
			playerListEl.appendChild(emptySlotRow);
		}
	
		// Si c'est l'hôte, afficher les options supplémentaires
		if (message.hostId === currentPlayerId) {
			isHost = true;
			hostOptionsEl.style.display = 'block';
		} else {
			isHost = false;
			hostOptionsEl.style.display = 'none';
		}
	}
	
	kickPlayer(playerId) {
		// socket.sendMessage({ type: 'kickPlayer', playerId: playerId });
	}
	
	inviteFriends() {
		// Afficher la modale pour inviter des amis
		new bootstrap.Modal(document.getElementById('inviteFriendsModal')).show();
	}
	
	addBot() {
		this.sendMessage({ type: 'addBot' });
	}
	
	openLobbyOptions() {
		new bootstrap.Modal(document.getElementById('lobbyOptionsModal')).show();
	}
	
	saveLobbyOptions() {
		const options = {
			gameType: document.getElementById('gameType').value,
			lobbyName: document.getElementById('lobbyNameInput').value,
			slotCount: document.getElementById('slotCount').value,
			livesCount: document.getElementById('livesCount').value,
			allowSpectators: document.getElementById('allowSpectators').checked
		};
	
		this.sendMessage({ type: 'updateLobbyOptions', options });
	}
	
	showOnlinePlayers() {
		// Demander la liste des joueurs en ligne via WebSocket
		this.sendMessage({ type: 'getOnlinePlayers' });
	}
	
	displayOnlinePlayers(players) {
		const onlinePlayersList = document.getElementById('onlinePlayersList');
		onlinePlayersList.innerHTML = '';
	
		players.forEach(player => {
			let actionButton = '';
			switch (player.status) {
				case 'in_game':
					actionButton = `<button class="btn btn-sm btn-secondary" onclick="observeMatch('${player.matchId}')">Observer</button>`;
					break;
				case 'in_lobby':
					actionButton = `<button class="btn btn-sm btn-primary" onclick="joinLobby('${player.lobbyId}')">Rejoindre</button>`;
					break;
			}
	
			onlinePlayersList.innerHTML += `
				<div class="player-item">
					<p>${player.name} - Status: ${player.status}</p>
					${actionButton}
				</div>
			`;
		});
	
		// Afficher le modal
		new bootstrap.Modal(document.getElementById('onlinePlayersModal')).show();
	}
	
	// Fonction pour afficher le pop-up d'erreur
	error(message) {
		document.getElementById('errorMessage').textContent = message.data;
		const errorPopup = document.getElementById('errorPopup');
		errorPopup.style.display = 'block';
	
		// Masquer le pop-up après quelques secondes (optionnel)
		setTimeout(() => {
			errorPopup.style.display = 'none';
		}, 5000); // Masquer après 5 secondes
	}
	
	// Fonction pour fermer le pop-up
	closeErrorPopup() {
		document.getElementById('errorPopup').style.display = 'none';
	}
	
	// Connecter le WebSocket au chargement de la page
	dispatch(message) {
		console.log(message.type)
		if (typeof this[message.type] === "function") {
			this[message.type](message);
		} else {
			const errMessage = `Received a message type which has no handler: ${message.type}`;
			console.error(errMessage);
			this.error(errMessage);
		}
	}

    cleanupView() {
        if (this.socket) {
            this.socket.close();
        }

		this.closeErrorButton.removeEventListener('click', closeErrorPopup);
		this.showOnlinePLayersButton.removeEventListener('click', showOnlinePlayers);
		this.openLobbyOptionsButton.removeEventListener('clck', openLobbyOptions);
		this.startGameButton.removeEventListener('click', startGame);
		this.inviteFriendsButton.removeEventListener('click', inviteFriends);
		this.beReadyButton.removeEventListener('click', beReady);
		this.leaveLobbyButton.removeEventListener('click', leaveLobby);
		this.joinLobbyButton.removeEventListener('click', joinLobbyById);
		this.joinLobbyButtonModal.removeEventListener('click', joinLobbyById);
		this.createLobbyButton.removeEventListener('click', createLobby);
		this.saveLobbyOptionsButton.removeEventListener('click', saveLobbyOptions);

        // this.startButton.removeEventListener('click', this.startMatchmaking);
    }
}