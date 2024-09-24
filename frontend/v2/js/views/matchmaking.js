import { BaseView } from '../view-manager.js';
import { userInfo } from '../home.js'

export default class MatchmakingView extends BaseView {
    constructor() {
        super('matchmaking-view');
        this.socket = null;
		this.isConnected = false;
		this.isHost = false;
		this.lobbyId;
		this.url = `wss://${location.host}/ws/matchmaking/`;
		this.received_error = false;
		this.reconnectAttempts = 0;
		this.maxReconnectAttempts = 5;
		this.reconnectInterval = 2000; // 5 secondes
		this.messageQueue = new Map();
		this.messageId = 0;
    }

    async initView() {

        // Initialiser la connexion WebSocket
        this.initWebSocket();

		this.showOnlinePLayersButton = document.getElementById('buttonShowOnlinePlayers');
		this.openLobbyOptionsButton = document.getElementById('buttonOptionsLobby');
		this.startGameButton = document.getElementById('startGameButton');
		this.inviteFriendsButton = document.getElementById('inviteFriendsButton');
		this.beReadyButton = document.getElementById('beReadyButton');
		this.leaveLobbyButton = document.getElementById('leaveLobbyButton');
		this.joinLobbyButton = document.getElementById('joinLobbyButton');
		this.createLobbyButton = document.getElementById('createLobbyButton');
		this.saveLobbyOptionsButton = document.getElementById("saveLobbyOptionsButton");

		this.showOnlinePLayersButton.addEventListener('click', () => this.showOnlinePlayers());
		this.openLobbyOptionsButton.addEventListener('clck', (e) => this.openLobbyOptions());
		this.startGameButton.addEventListener('click', () => this.startGame());
		this.inviteFriendsButton.addEventListener('click', () => this.inviteFriends());
		this.beReadyButton.addEventListener('click', () => this.beReady());
		this.leaveLobbyButton.addEventListener('click', () => this.leaveLobby());
		this.joinLobbyButton.addEventListener('click', () => this.joinLobbyById());
		this.createLobbyButton.addEventListener('click', () => this.createLobby());
		this.saveLobbyOptionsButton.addEventListener('click', () => this.saveLobbyOptions());

		document.getElementById('lobbyNameCreation').value = `${userInfo.display_name}'s lobby`;

	}

    async initWebSocket() {
		try {
			this.socket = new WebSocket(this.url);

			this.socket.onopen = () => {
				console.log('WebSocket connected');
				this.successHandler('Websocket connected.')
				this.isConnected = true;
				this.reconnectAttempts = 0;
			};

			this.socket.onmessage = (event) => {
				const message = JSON.parse(event.data);
				if (Object.hasOwn(message, 'id')) {
					if (this.messageQueue.has(message.id)) {
						const {resolve, timeoutId} = this.messageQueue.get(message.id);
						clearTimeout(timeoutId);
						resolve(message);
						this.messageQueue.delete(message.id);
					} else {
						this.errorHandler('Received a message which had no resolve entry.');
					}
				} else {
					console.log('Received message:', message);
					this.dispatch(message)
				}
			};

			this.socket.onclose = () => {
				console.log('WebSocket disconnected');
				this.isConnected = false;
				if (!this.received_error)
					this.reconnect();
			};

			this.socket.onerror = (error) => {
				console.error('WebSocket error:', error);
			};

			await new Promise((resolve, reject) => {
				this.socket.addEventListener('open', resolve);
				this.socket.addEventListener('error', reject);
			  });

		} catch (error) {
			console.error("Error initialising websocket:", error);
      		this.reconnect();
		}
    }

	reconnect() {
		if (this.reconnectAttempts < this.maxReconnectAttempts) {
			this.reconnectAttempts++;
			this.errorHandler(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectInterval / 1000} seconds...`, true);
			setTimeout(() => this.initWebSocket(), this.reconnectInterval);
		} else {
			this.errorHandler(`Max reconnection attempts number reached.`, false);
			// console.error('');
		}
	}

	sendMessage(message, timeout = 0) {
		return new Promise((resolve, reject) => {
			if (!this.isConnected) {
				reject(new Error("Unable to send message: websocket disconnected."));
				return;
			}
			try {
				this.socket.send(JSON.stringify(message));
				if (timeout === 0) {
					resolve();
					return;
				}
				const id = this.messageId++;
				message.id = id;
				const timeoutId = setTimeout(() => {
				if (this.messageQueue.has(id)) {
					this.messageQueue.delete(id);
					reject(new Error('Response timeout'));
				}
				}, timeout);
				this.messageQueue.set(id, { resolve, timeoutId });
			} catch (error) {
				reject(new Error(`Error sending message: ${error.message}`));
			}
		});
	}

    general_update(message) {
		const availableLobbiesEl = document.querySelector('#availableLobbies tbody');
		const ongoingMatchesEl = document.querySelector('#ongoingMatches tbody');

		availableLobbiesEl.innerHTML = '';
		ongoingMatchesEl.innerHTML = '';

		message.availableLobbies.forEach(lobby => {
			const [id, obj] = Object.entries(lobby)[0];
			availableLobbiesEl.insertAdjacentHTML('beforeend', this.createLobbyHTML(id, obj, true));

			const joinButton = document.getElementById(`joinLobbyButton-${id}`);
			if (joinButton) {
				joinButton.addEventListener('click', () => {
					this.joinLobby(id);
				});
			}
		});

		message.ongoingMatches.forEach(match => {
			const [id, obj] = Object.entries(match)[0];
			ongoingMatchesEl.insertAdjacentHTML('beforeend', this.createLobbyHTML(id, obj, false));

			const spectateButton = document.getElementById(`spectateLobbyButton-${id}`);
			if (spectateButton) {
				spectateButton.addEventListener('click', () => {
					this.spectateLobby(id);
				});
			}
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

	async createLobby() {
		const form = document.getElementById('createLobbyForm');
		document.querySelectorAll('.form-errors').forEach(function(el) {
			el.style.display = 'none';
		});
		// Récupérer les valeurs
		const gameType = form.gameType.value;
		const matchType = form.matchType.value;
		const lobbyName = form.lobbyNameCreation.value.trim();
		const maxPlayers = parseInt(form.maxPlayers.value, 10);
		const botsCount = parseInt(form.botsCount.value, 10);
		const lobbyPrivacy = form.lobbyPrivacy.value;
		const spectators = form.spectators.value;
		const nbrLives = parseInt(form.nbrLives.value);

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
		if (botsCount < 0 || botsCount > maxPlayers - 1) {
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

		const modal = bootstrap.Modal.getInstance(document.getElementById('createLobbyModal'));
			await this.sendMessage({
				type: 'create_lobby',
				lobby_type: matchType,
				name: lobbyName,
				nbr_players: maxPlayers,
				nbr_bots: botsCount,
				game_type: gameType,
				public: (lobbyPrivacy === 'public' ? true : false),
				allow_spectators: (spectators === 'allowed' ? true: false),
				lives: nbrLives});
		this.isHost = true;


		// Fermer la modale
		modal.hide();

	}

	joinLobbyById() {
		const lobbyId = document.getElementById('lobbyIdInput').value;
		console.log('Rejoindre le lobby avec l\'ID:', lobbyId);
		// Implémentez la logique pour rejoindre le lobby ici
	}

	updateCurrentView() {

		if (this.lobbyId) {
			document.getElementById('lobbyView').classList.remove('d-none');
			document.getElementById('mainView').classList.add('d-none');
			if (this.isHost) {
				document.getElementById('hostOptions').classList.remove('d-none');
			} else {
				document.getElementById('hostOptions').classList.add('d-none');
			}
		} else {
			document.getElementById('mainView').classList.remove('d-none');
			document.getElementById('lobbyView').classList.add('d-none');
		}
	}

	joinLobby(lobbyId) {
		console.log('Rejoindre le lobby:', lobbyId);
		// Implémentez la logique pour rejoindre le lobby ici
		this.sendMessage({ type: 'join_lobby', lobby_id: lobbyId });
		// this.lobbyId = lobbyId
		// this.updateCurrentView(lobbyId);
	}

	leaveLobby() {
		console.log('Quitter le lobby:', this.lobbyId);
		// socket.sendMessage({ type: 'leave_lobby', lobbyId: lobbyId });
		this.sendMessage({ type: 'leave_lobby' });
		this.lobbyId = undefined;
		this.isHost = false;
		this.updateCurrentView();
	}

	lobby_canceled(content)
	{
		console.log('lobby_canceled event');
		console.log(content);
		this.lobbyId = undefined;
		this.updateCurrentView();
	}

	lobby_joined(message)
	{
		console.log("lobby_join event");
		console.log(message);
		console.log(message.lobby_id)
		const lobby_id = message.lobby_id;
		this.lobbyId = lobby_id;
		this.updateCurrentView();
	}

	lobby_update(message) {
		const lobbyNameEl = document.getElementById('lobbyName');
		const playerListEl = document.getElementById('playerList');
		const hostOptionsEl = document.getElementById('hostOptions');

		lobbyNameEl.textContent = message.lobbyName;
		playerListEl.innerHTML = '';  // Vider la liste avant mise à jour

		Object.entries(message.players).forEach(player => {
			const playerRow = document.createElement('tr');
			const playerState = player[1].is_ready ? 'Prêt' : (player[1].has_joined ? 'A rejoint' : 'N\'a pas encore rejoint');
			playerRow.innerHTML = `
				<td>${player[0]}</td>
				<td>${playerState}</td>
				<td>
					${this.isHost && player.id !== message.hostId ? `<button class="btn btn-danger" onclick="kickPlayer('${player.id}')">Expulser</button>` : ''}
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
		
		this.sendMessage({ type: 'get_online_players' });
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

	// Connecter le WebSocket au chargement de la page
	dispatch(message) {
		console.log(message.type)
		if (typeof this[message.type] === "function") {
			this[message.type](message);
		} else {
			const errMessage = `Received a message type which has no handler: ${message.type}`;
			console.error(errMessage);
			this.errorHandler(errMessage);
		}
	}

    cleanupView() {
        if (this.socket) {
			this.received_error = true;
            this.socket.close();
        }

		this.closeErrorButton.removeEventListener('click', this.closeErrorPopup);
		this.showOnlinePLayersButton.removeEventListener('click', this.showOnlinePlayers);
		this.openLobbyOptionsButton.removeEventListener('clck', this.openLobbyOptions);
		this.startGameButton.removeEventListener('click', this.startGame);
		this.inviteFriendsButton.removeEventListener('click', this.inviteFriends);
		this.beReadyButton.removeEventListener('click', this.beReady);
		this.leaveLobbyButton.removeEventListener('click', this.leaveLobby);
		this.joinLobbyButton.removeEventListener('click', this.joinLobbyById);
		this.createLobbyButton.removeEventListener('click', this.createLobby);
		this.saveLobbyOptionsButton.removeEventListener('click', this.saveLobbyOptions);

        // this.startButton.removeEventListener('click', this.startMatchmaking);
    }
}
