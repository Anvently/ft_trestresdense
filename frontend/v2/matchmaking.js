class WebSocketHandler {
	constructor(url, dispatcher) {
		this.url = url;
		this.socket = null;
		this.isConnected = false;
		this.dispatcher = dispatcher;
		this.messageQueue = [];
	}

	connect() {
		this.socket = new WebSocket(this.url);

		this.socket.onopen = () => {
			console.log('WebSocket connected');
			this.isConnected = true;
			this.flushQueue();
		};

		this.socket.onmessage = (event) => {
			const message = JSON.parse(event.data);
			this.handleMessage(message);
		};

		this.socket.onclose = () => {
			console.log('WebSocket disconnected');
			this.isConnected = false;
			// Implement reconnection logic here if needed
		};

		this.socket.onerror = (error) => {
			console.error('WebSocket error:', error);
		};
	}

	sendMessage(message) {
		if (this.isConnected) {
			this.socket.send(JSON.stringify(message));
		} else {
			this.messageQueue.push(message);
		}
	}

	flushQueue() {
		while (this.messageQueue.length > 0) {
			const message = this.messageQueue.shift();
			this.sendMessage(message);
		}
	}

	handleMessage(message) {
		// Implement message handling logic here
		console.log('Received message:', message);
		this.dispatcher(message)
		// Example: You might want to dispatch the message to a game state handler
		// gameStateHandler.processMessage(message);
	}

	disconnect() {
		if (this.socket) {
			this.socket.close();
		}
	}
}

let socket;
let isHost= true;
let lobbyId;

function connectWebSocket() {
	socket = new WebSocketHandler(`wss://${location.hostname}:8083/ws/matchmaking/anonymous/`, dispatchMessage)
	socket.connect();
}


function general_update(message) {
	const availableLobbiesEl = document.querySelector('#availableLobbies tbody');
	const ongoingMatchesEl = document.querySelector('#ongoingMatches tbody');

	availableLobbiesEl.innerHTML = '';
	ongoingMatchesEl.innerHTML = '';

	message.availableLobbies.forEach(lobby => {
		const [id, obj] = Object.entries(lobby)[0];
		availableLobbiesEl.innerHTML += createLobbyHTML(id, obj, true);
	});

	message.ongoingMatches.forEach(match => {
		const [id, obj] = Object.entries(match)[0];
		ongoingMatchesEl.innerHTML += createLobbyHTML(id, obj, false);
	});
}

function createLobbyHTML(id, lobby, isAvailable) {
	// console.log(id)
	const tournamentClass = lobby.match_type == 'tournament_lobby' ? 'tournament' : '';
	const actionButton = isAvailable
		? `<button class="btn btn-sm btn-primary" onclick="joinLobby('${id}')">Rejoindre</button>`
		: `<button class="btn btn-sm btn-secondary" onclick="observeMatch('${id}')">Observer</button>`;

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

function createLobby() {
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

	socket.sendMessage({
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

function joinLobbyById() {
	const lobbyId = document.getElementById('lobbyIdInput').value;
	console.log('Rejoindre le lobby avec l\'ID:', lobbyId);
	// Implémentez la logique pour rejoindre le lobby ici
}

function switchLobbyView() {

	console.log(`lobby=${lobbyId}`)
	document.getElementById('mainView').style.display = (lobbyId === undefined ? 'none' : 'block');
	document.getElementById('lobbyView').style.display = (lobbyId === undefined ? 'block' : 'none');
	// Pour tous les éléments avec la classe 'mainView'
	document.querySelectorAll('.mainView').forEach(function(element) {
		element.style.display = (lobbyId === undefined ? 'none' : 'block');
	});
	// Pour tous les éléments avec la classe 'lobbyView'
	document.querySelectorAll('.lobbyView').forEach(function(element) {
		element.style.display = (lobbyId === undefined ? 'block' : 'none');
	});
	console.log(lobbyId === undefined && isHost === true)
	document.getElementById('hostOptions').style.display = (lobbyId === undefined && isHost === true ? 'flex' : 'none');

	// Recevoir les détails du lobby via WebSocket
	// socket.sendMessage({ type: 'getLobbyDetails', lobbyId: lobbyId });
}

function joinLobby(lobbyId) {
	console.log('Rejoindre le lobby:', lobbyId);
	// Implémentez la logique pour rejoindre le lobby ici
	socket.sendMessage({ type: 'join_lobby', lobby_id: lobbyId });
	switchLobbyView(lobbyId);
	lobbyId = lobbyId
}

function leaveLobby() {
	console.log('Quitter le lobby:', lobbyId);
	// socket.sendMessage({ type: 'leave_lobby', lobbyId: lobbyId });
	switchLobbyView()
	lobbyId = null
}

function lobby_update(message) {
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

function kickPlayer(playerId) {
	// socket.sendMessage({ type: 'kickPlayer', playerId: playerId });
}

function inviteFriends() {
	// Afficher la modale pour inviter des amis
	new bootstrap.Modal(document.getElementById('inviteFriendsModal')).show();
}

function addBot() {
	socket.sendMessage({ type: 'addBot' });
}

function openLobbyOptions() {
	new bootstrap.Modal(document.getElementById('lobbyOptionsModal')).show();
}

function saveLobbyOptions() {
	const options = {
		gameType: document.getElementById('gameType').value,
		lobbyName: document.getElementById('lobbyNameInput').value,
		slotCount: document.getElementById('slotCount').value,
		livesCount: document.getElementById('livesCount').value,
		allowSpectators: document.getElementById('allowSpectators').checked
	};

	socket.sendMessage({ type: 'updateLobbyOptions', options });
}

function observeMatch(matchId) {
	console.log('Observer le match:', matchId);
	// Implémentez la logique pour observer le match ici
}

function showOnlinePlayers() {
	// Demander la liste des joueurs en ligne via WebSocket
	socket.send(JSON.stringify({ type: 'getOnlinePlayers' }));
}

function displayOnlinePlayers(players) {
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
function error(message) {
	document.getElementById('errorMessage').textContent = message.data;
	const errorPopup = document.getElementById('errorPopup');
	errorPopup.style.display = 'block';

	// Masquer le pop-up après quelques secondes (optionnel)
	setTimeout(() => {
		errorPopup.style.display = 'none';
	}, 5000); // Masquer après 5 secondes
}

// Fonction pour fermer le pop-up
function closeErrorPopup() {
	document.getElementById('errorPopup').style.display = 'none';
}

// Connecter le WebSocket au chargement de la page
function dispatchMessage(message) {
	console.log(message.type)
	if (typeof window[message.type] === "function") {
		window[message.type](message);
	} else {
		console.error(`Received a message type which has no handler: ${message.type}`);
	}
}

registerCleanup('matchmaking', () => {
	console.log("cleaning matchmaking page");
	socket.close();
	lobbyId = undefined;
	isHost = false;
});

registerInit('matchmaking', () => {
	console.log("init matchmaking page");
	connectWebSocket();
});
