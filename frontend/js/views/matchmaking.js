import { BaseView, ViewManager } from '../view-manager.js';
import { authenticatedUser, userManager, User } from '../home.js'
import TournamentTree from '../components/tournamentTree.js';

export default class MatchmakingView extends BaseView {
    constructor() {
        super('matchmaking-view');
        this.socket = null;
		this.isConnected = false;
		this.isHost = false;
		this.isReady = false;
		this.lobbyId;
		this.url = `wss://${location.host}/ws/matchmaking/`;
		this.received_error = false;
		this.reconnectAttempts = 0;
		this.maxReconnectAttempts = 5;
		this.reconnectInterval = 2000; // 5 secondes
		this.messageQueue = new Map();
		this.messageId = 0;
		this.nickName = "";
    }


    async initView() {

        // Initialiser la connexion WebSocket
        this.initWebSocket();

		this.showOnlinePLayersButton = document.getElementById('buttonShowOnlinePlayers');
		this.openLobbyOptionsButton = document.getElementById('buttonOptionsLobby');
		//this.startGameButton = document.getElementById('startGameButton');
		this.inviteFriendsButton = document.getElementById('inviteFriendsButton');
		this.addLocalPlayerButton = document.getElementById('addLocalPlayerButton');
		this.beReadyButton = document.getElementById('beReadyButton');
		this.leaveLobbyButton = document.getElementById('leaveLobbyButton');
		this.submitNicknameButton = document.getElementById('submitNicknameButton');
		this.joinLobbyButton = document.getElementById('joinLobbyButton');
		this.createLobbyButton = document.getElementById('createLobbyButton');
		this.saveLobbyOptionsButton = document.getElementById("saveLobbyOptionsButton");
		this.showOnlinePLayersButton.addEventListener('click', () => this.showOnlinePlayers());
		this.openLobbyOptionsButton.addEventListener('click', (e) => this.openLobbyOptions());
		//this.startGameButton.addEventListener('click', () => this.startGame());
		this.inviteFriendsButton.addEventListener('click', () => this.inviteFriends());
		this.leaveLobbyButton.addEventListener('click', () => this.leaveLobby());
		this.joinLobbyButton.addEventListener('click', () => this.joinLobbyById());
		this.createLobbyButton.addEventListener('click', () => this.createLobby());
		this.saveLobbyOptionsButton.addEventListener('click', () => this.saveLobbyOptions());
		this.submitNicknameButton.addEventListener('click', () => this.submitNickname());
		this.addLocalPlayerButton.addEventListener('click', () => this.addLocalPlayer());

		document.getElementById('displayBracketButton').addEventListener('click', async () => {
			if (this.lobbyData && this.lobbyData.tournament_id)
				await this.displayTournamentTree(this.lobbyData.tournament_id);
		});

		userManager.setDynamicUpdateHandler(this.updateUserInfos);

		document.getElementById('nicknameModal').addEventListener('hidden.bs.modal', function () {
            document.getElementById('nicknameInput').value = '';});


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
			console.error("Error initializing websocket:", error);
      		this.reconnect();
		}
    }

	reconnect() {
		if (this.reconnectAttempts < this.maxReconnectAttempts) {
			this.reconnectAttempts++;
			this.errorHandler(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectInterval / 1000} seconds...`, true);
			setTimeout(async () => await this.initWebSocket(), this.reconnectInterval);
		} else {
			this.errorHandler(`Max reconnection attempts number reached.`, false);
			// console.error('');
		}
	}

	async sendMessage(message, timeout = 0) {
		return new Promise((resolve, reject) => {
			if (!this.isConnected) {
				reject(new Error("Unable to send message: websocket disconnected."));
				return;
			}
			try {
				if (timeout === 0) {
					this.socket.send(JSON.stringify(message));
					resolve();
					return;
				}
				const id = this.messageId++;
				message.id = id;
				this.socket.send(JSON.stringify(message));
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

		if (message.availableLobbies && message.availableLobbies.length) {
			availableLobbiesEl.innerHTML = '';
			message.availableLobbies.forEach(lobby => {
				const [id, obj] = Object.entries(lobby)[0];
				this.appendLobbyEntry(availableLobbiesEl, id, obj, true);
				const joinButton = document.getElementById(`joinLobbyButton-${id}`);
				if (joinButton) {
					joinButton.addEventListener('click', () => {
						this.joinLobby(id);
					});
				}
			});
		} else {
			availableLobbiesEl.innerHTML = `<tr><td colspan="5">Aucun résultat.</td></tr>`;
		}

		if (message.ongoingMatches && message.ongoingMatches.length) {
			ongoingMatchesEl.innerHTML = '';
			message.ongoingMatches.forEach(match => {
				const [id, obj] = Object.entries(match)[0];
				this.appendLobbyEntry(ongoingMatchesEl, id, obj, false);
				const spectateButton = document.getElementById(`spectateLobbyButton-${id}`);
				if (spectateButton) {
					spectateButton.addEventListener('click', () => {
						this.spectateLobby(id);
					});
				}
			});
		} else {
			ongoingMatchesEl.innerHTML = `<tr><td colspan="5">Aucun résultat.</td></tr>`;
		}

		userManager.forceUpdate();
	}

	appendLobbyEntry(tableElement, id, lobby, isAvailable) {
		const row = document.createElement('tr');
		row.id = id;
		if (lobby.match_type === 'tournament_lobby') {
		row.classList.add('tournament');
		}

		const nameCell = document.createElement('td');
		nameCell.classList.add('left');
		nameCell.textContent = lobby.name;
		row.appendChild(nameCell);

		const gameTypeCell = document.createElement('td');
		gameTypeCell.classList.add('center');
		gameTypeCell.textContent = lobby.game_type;
		row.appendChild(gameTypeCell);

		const hostCell = document.createElement('td');
		hostCell.classList.add('center');
		const linkBlock = document.createElement('a');
		linkBlock.classList.add('user-link', 'd-flex', 'align-items-center', 'text-decoration-none');
		const hostAvatar = document.createElement('img');
		hostAvatar.classList.add('rounded-circle', 'me-2');
		const hostNameSpan = document.createElement('span');
		if (!lobby.host || lobby.host[0] === '!') {
			hostAvatar.src = "/avatars/__bot__.png";
			hostNameSpan.textContent = "Bot";
			linkBlock.href =  "javascript:void(0)";
		} else {
			userManager.getUserAttr(lobby.host, 'avatar', "/avatars/__default__.jpg").then(url => {
				hostAvatar.src = url;
			});
			hostAvatar.classList.add(`dynamicAvatarUrl`, `user-${lobby.host}`);
			hostNameSpan.classList.add(`dynamicDisplayName`, `user-${lobby.host}`);
			userManager.getUserAttr(lobby.host, 'display_name', lobby.host).then(displayName => {
				hostNameSpan.textContent = displayName;
			});
			linkBlock.href = `https://${window.location.host}/#user?username=${lobby.host}`;;
		}
		linkBlock.appendChild(hostAvatar);
		linkBlock.appendChild(hostNameSpan);
		hostCell.appendChild(linkBlock);
		row.appendChild(hostCell);

		const slotsCell = document.createElement('td');
		slotsCell.classList.add('center');
		slotsCell.textContent = lobby.slots;
		row.appendChild(slotsCell);

		const actionCell = document.createElement('td');
		actionCell.classList.add('right');
		const actionButton = document.createElement('button');
		actionButton.className = isAvailable ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-secondary';
		actionButton.id = isAvailable ? `joinLobbyButton-${id}` : `spectateLobbyButton-${id}`;
		actionButton.textContent = isAvailable ? 'Rejoindre' : 'Observer';
		actionCell.appendChild(actionButton);
		row.appendChild(actionCell);

		tableElement.appendChild(row);
	}


	async submitNickname() {

		const nicknameInput = document.getElementById('nicknameInput');
		const nickname = nicknameInput.value.trim();
		if (nickname === "")
		{
			nickname = this.username + "." + this.username;
		}
		this.nickName = nickname;
		bootstrap.Modal.getInstance(document.getElementById('nicknameModal')).hide();
	}

	async createLobby() {
		const form = document.getElementById('createLobbyForm');
		const modal = bootstrap.Modal.getInstance(document.getElementById('createLobbyModal'));
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
		modal.hide();
		if (matchType === "local_match")
		{

			const nicknameModal = new bootstrap.Modal(document.getElementById('nicknameModal'));
            nicknameModal.show();
			await new Promise(resolve => {
				document.getElementById('nicknameModal').addEventListener('hidden.bs.modal', resolve, { once: true });
			});
			nicknameModal.hide();
		}
		try {
			await this.sendMessage({
				type: 'create_lobby',
				lobby_type: matchType,
				name: lobbyName,
				nbr_players: maxPlayers,
				nbr_bots: botsCount,
				game_type: gameType,
				public: (lobbyPrivacy === 'public' ? true : false),
				allow_spectators: (spectators === 'allowed' ? true: false),
				lives: nbrLives,
				nickname: this.nickName,
			});
		} catch (error) {
			this.errorHandler(error);
		}
		this.isHost = true;
		this.nickName = "";
	}




	joinLobbyById() {
		const lobbyId = document.getElementById('lobbyIdInput').value;
		console.log('Rejoindre le lobby avec l\'ID:', lobbyId);
		this.joinLobby(lobbyId);
		const modal = bootstrap.Modal.getInstance(document.getElementById('joinLobbyModal'));
		modal.hide();
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
		// Implémentez la logique pour rejoindre le lobby ici
		this.sendMessage({ type: 'join_lobby', lobby_id: lobbyId }).catch((error) => this.errorHandler(error));
		// this.lobbyId = lobbyId
		// this.updateCurrentView(lobbyId);
	}



	leaveLobby() {
		if (this.lobbyId[0] == 'T')
		{
			const modalElement = document.getElementById('leaveTnLobbyModal');
    		const modal = new bootstrap.Modal(modalElement);
			const confirmBtn = document.getElementById('confirmLeaveBtn');
			const cancelBtn = document.getElementById('cancelLeaveBtn');
    		cancelBtn.onclick = () => {
				modal.hide();
				return;
			}
			confirmBtn.onclick = () => {
    		  modal.hide();
    		};
			modal.show();
		}
		this.sendMessage({ type: 'leave_lobby' }).catch((error) => this.errorHandler(error));;
		this.isReady = false;
		this.lobbyId = undefined;
		this.isHost = false;
		this.updateCurrentView();

	}





	lobby_canceled(content)
	{
		// this.errorHandler("Lobby got cancelled");
		this.lobbyId = undefined;
		this.isReady = false;
		this.isHost = false;
		this.updateCurrentView();
	}

	in_game(content)
	{
		console.log(content);
		const lobby_id = content.lobby_id;

		let modal = new bootstrap.Modal(document.getElementById('inGame'));
		const rejoinButton = document.getElementById('rejoinButton');
		const concedeButton = document.getElementById('concedeButton');

		rejoinButton.onclick = () => {
			this.lobbyId = lobby_id;
			modal.hide();
			window.location.hash = `#${content.game_type}?id=${lobby_id}`;
		};
		concedeButton.onclick = () => {
			this.lobbyId = undefined;
			this.isReady = false;
			this.isHost = false;
			modal.hide();
			this.sendMessage({type : 'concede_game'})
		};
		modal.show();
	}

	in_tournament_lobby(content) {
		this.joinLobby(content['lobby_id']);
	}

	be_kicked(content)
	{
		this.isReady = false ;
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

	async lobby_update(message) {
		console.log(message)
		let isTnMatch = false;
		let isLoc = false;
		if (message.match_type === "tournament_match")
		{
			this.isHost = false;
			isTnMatch = true;
			document.getElementById('displayBracketButton').classList.remove('d-none');
			document.getElementById('inviteFriendsButton').classList.add('d-none');
			document.getElementById('addLocalPlayerButton').classList.add("d-none");
		}
		else if(message.match_type === "local_match")
		{
			isLoc = true;
			document.getElementById('inviteFriendsButton').classList.add('d-none');
			document.getElementById('addLocalPlayerButton').classList.remove('d-none');
			document.getElementById('displayBracketButton').classList.add('d-none');
		}
		else {
			document.getElementById('inviteFriendsButton').classList.remove('d-none');
			document.getElementById('displayBracketButton').classList.add('d-none');
			document.getElementById('addLocalPlayerButton').classList.add("d-none");
		}
		document.getElementById('lobbyName').textContent = message.name;
		const lobbyNameEl = document.getElementById('lobbyName');
		const playerListEl = document.getElementById('playerList');

		// lobbyNameEl.textContent = message.lobbyName;
		playerListEl.innerHTML = '';  // Vider la liste avant mise à jour

		this.lobbyData = message;

		await Object.entries(message.players).forEach(async ([playerId, playerData]) => {
			if (isLoc){
				await this.appendLocPlayerEntry(playerListEl, playerId, playerData, message.host, isTnMatch);
			}
			else{
				await this.appendPlayerEntry(playerListEl, playerId, playerData, message.host, isTnMatch, isLoc);}
		});

		// Gérer les slots libres
		let players_len = Object.keys(message.players).length;
		for (let i = players_len; i < message.settings.nbr_players; i++) {
			this.appendEmptySlotEntry(playerListEl, i === players_len);
		}

		await userManager.forceUpdate();
	}

	async appendLocPlayerEntry(tableElement, playerId, playerData, hostId, isTnMatch) {
		const playerRow = document.createElement('tr');
		let playerState;
		if (playerData.is_ready) {
			playerState = 'Prêt';
			playerRow.classList.add('player-ready')
		} else if (playerData.has_joined) {
			playerState = 'A rejoint';
		} else {
			playerState = 'N\'a pas encore rejoint';
			playerRow.classList.add('text-muted');
		}

		const user = new User(playerId, await userManager.getUserInfo(playerId));

		const nameCell = document.createElement('td');
		nameCell.classList.add('left');
		const linkBlock = document.createElement('a');
		linkBlock.classList.add('user-link', 'd-flex', 'align-items-center', 'text-decoration-none');
		const userAvatar = document.createElement('img');
		userAvatar.classList.add('rounded-circle', 'me-2', 'dynamicAvatarUrl', `user-${user.username}`);
		const userNameSpan = document.createElement('span');
		userNameSpan.classList.add('dynamicDisplayName', `user-${user.username}`);
		userNameSpan.textContent = user.display_name;
		userAvatar.src = user.avatar;
		linkBlock.href = !user.is_bot ? `https://${window.location.host}/#user?username=${playerId}` : "javascript:void(0)";
		linkBlock.appendChild(userAvatar);
		linkBlock.appendChild(userNameSpan);
		nameCell.appendChild(linkBlock);
		playerRow.appendChild(nameCell);

		const stateCell = document.createElement('td');
		stateCell.classList.add('center');
		stateCell.textContent = playerState;
		playerRow.appendChild(stateCell);

		const actionCell = document.createElement('td');
		actionCell.classList.add('right');
		if (playerId !== hostId && !isTnMatch) {
			console.log("creating kick button");
			const kickButton = document.createElement('button');
			kickButton.className = 'btn btn-danger';
			kickButton.textContent = 'Expulser';
			kickButton.onclick = () => this.kickPlayer(playerId);
			actionCell.appendChild(kickButton);
		} else if (playerId === hostId) {
			const beReadyButton = document.createElement('button');
			beReadyButton.className = 'btn btn-warning';
			beReadyButton.textContent = this.isReady ? 'Unready' : 'Ready-Up';
			beReadyButton.onclick = () => {
				if (this.isReady == false){
					this.beReady(playerId);
					this.isReady = true;
				}
				else{
					this.unready(playerId);
					this.isReady = false;
				}
				}
			actionCell.appendChild(beReadyButton);
		}
		playerRow.appendChild(actionCell);

		tableElement.appendChild(playerRow);
	}



	async appendPlayerEntry(tableElement, playerId, playerData, hostId, isTnMatch) {
		const playerRow = document.createElement('tr');
		let playerState;
		if (playerData.is_ready) {
			playerState = 'Prêt';
			playerRow.classList.add('player-ready')
		} else if (playerData.has_joined) {
			playerState = 'A rejoint';
		} else {
			playerState = 'N\'a pas encore rejoint';
			playerRow.classList.add('text-muted');
		}

		const user = new User(playerId, await userManager.getUserInfo(playerId));

		const nameCell = document.createElement('td');
		nameCell.classList.add('left');
		const linkBlock = document.createElement('a');
		linkBlock.classList.add('user-link', 'd-flex', 'align-items-center', 'text-decoration-none');
		const userAvatar = document.createElement('img');
		userAvatar.classList.add('rounded-circle', 'me-2', 'dynamicAvatarUrl', `user-${user.username}`);
		const userNameSpan = document.createElement('span');
		userNameSpan.classList.add('dynamicDisplayName', `user-${user.username}`);
		userNameSpan.textContent = user.display_name;
		userAvatar.src = user.avatar;
		linkBlock.href = !user.is_bot ? `https://${window.location.host}/#user?username=${playerId}` : "javascript:void(0)";
		linkBlock.appendChild(userAvatar);
		linkBlock.appendChild(userNameSpan);
		nameCell.appendChild(linkBlock);
		playerRow.appendChild(nameCell);

		const stateCell = document.createElement('td');
		stateCell.classList.add('center');
		stateCell.textContent = playerState;
		playerRow.appendChild(stateCell);

		const actionCell = document.createElement('td');
		actionCell.classList.add('right');
		if (this.isHost && playerId !== hostId && !isTnMatch) {
			console.log("creating kick button");
			const kickButton = document.createElement('button');
			kickButton.className = 'btn btn-danger';
			kickButton.textContent = 'Expulser';
			kickButton.onclick = () => this.kickPlayer(playerId);
			actionCell.appendChild(kickButton);
		} else if (authenticatedUser.username === playerId) {
			const beReadyButton = document.createElement('button');
			beReadyButton.className = 'btn btn-warning';
			beReadyButton.textContent = this.isReady ? 'Unready' : 'Ready-Up';
			beReadyButton.onclick = () => {
				if (this.isReady == false){
					this.beReady(playerId);
					this.isReady = true;
				}
				else{
					this.unready(playerId);
					this.isReady = false;
				}
				}
			actionCell.appendChild(beReadyButton);
		}
		playerRow.appendChild(actionCell);

		tableElement.appendChild(playerRow);
	}

	appendEmptySlotEntry(tableElement, addButton = false) {
		const emptySlotRow = document.createElement('tr');
		emptySlotRow.classList.add('text-muted', 'empty_slot');

		const nameCell = document.createElement('td');
		nameCell.classList.add('left');
		nameCell.textContent = 'Slot libre';
		emptySlotRow.appendChild(nameCell);

		const stateCell = document.createElement('td');
		stateCell.classList.add('center');
		stateCell.textContent = 'En attente';
		emptySlotRow.appendChild(stateCell);

		const actionCell = document.createElement('td');
		actionCell.classList.add('right');
		if (this.isHost && addButton) {
			const addBotButton = document.createElement('button');
			addBotButton.className = 'btn btn-info';
			addBotButton.textContent = 'Ajouter un bot';
			addBotButton.onclick = () => {
				this.isReady = false;
				this.addBot();
			}
			actionCell.appendChild(addBotButton);
		}
		emptySlotRow.appendChild(actionCell);

		tableElement.appendChild(emptySlotRow);
	}

	kickPlayer(playerId) {


		this.sendMessage({"type" : "kick_player", "player_target" : playerId});
	}

	async addLocalPlayer()
	{
		const nicknameModal = new bootstrap.Modal(document.getElementById('nicknameModal'));
		this.nickName = "";
        nicknameModal.show();
		await new Promise(resolve => {
			document.getElementById('nicknameModal').addEventListener('hidden.bs.modal', resolve, { once: true });
		});
		this.sendMessage({'type' : 'add_local_player', 'nickname' : this.nickName});
	}

	inviteFriends() {
		this.sendMessage({'type' : 'get_invite_list'}, 1000)
		.then ((message) => {
			const friends = message.players;
			this.displayFriends(friends);
		})
		.catch (error => this.errorHandler(error));
	}

	set_unready(message)
	{
		this.isReady = false;
	}

	beReady(playerId)
	{
		this.sendMessage({'type'  : "player_ready"});
	}

	ready_up(message)
	{
		let modal = new bootstrap.Modal(document.getElementById('readyUp'));
		const invite = document.getElementById('readyUpDiv');
        const inviteText = document.getElementById('readyUpText');
        const buttonContainer = document.getElementById('readyUpButtonContainer');


		inviteText.textContent = "All players joined ! Ready Up !"
		buttonContainer.innerHTML = '';
		const joinButton = document.createElement('button');
            joinButton.className = "btn btn-success btn-lg";
            joinButton.textContent = "Ready Up!";
            joinButton.onclick = () => {
                modal.hide();
				if (!this.isReady){
					this.isReady = true;
					this.beReady(this.playerId);
				}
            };
            buttonContainer.appendChild(joinButton);
			modal.show();
	}

	unready(playerId)
	{
		this.sendMessage({'type' : 'player_unready'});
	}

	inviteFriend(friend_id)
	{
		this.sendMessage({"type": "invite_player", "invite_id" : friend_id});
	}

	be_invited(message)
	{
			let modal = new bootstrap.Modal(document.getElementById('receiveInvitation'));
            const invite = document.getElementById('invitation');
            const inviteText = document.getElementById('inviteText');
            const buttonContainer = document.getElementById('buttonContainer');

            let inviting_player = message.invite_from;
            const lobby_id = message.lobby_id;

            userManager.getUserAttr(inviting_player, 'display_name', inviting_player).then(displayName => {
                inviting_player = displayName;
                inviteText.textContent = `${inviting_player} wants to challenge you!`;
            });

            // Clear existing content
            buttonContainer.innerHTML = '';

            // Create and append the join button
            const joinButton = document.createElement('button');
            joinButton.className = "btn btn-success btn-lg";
            joinButton.textContent = "Join Game";
            joinButton.onclick = () => {
                modal.hide();
				this.isHost = false;
                this.joinLobby(lobby_id);
            };
            buttonContainer.appendChild(joinButton);

            modal.show();
        }



	appendFriendEntry(tableElement, player_id)
	{
		// on cree une nouvelle ligne pour y inserer l'ami
		const friendRow = document.createElement('tr');
		// on cree une nouvelle cellule pour y inscrire le pseudo du joueur et son avatar
		const nameCell = document.createElement('td');
		nameCell.classList.add('left');
		const linkBlock = document.createElement('a');
		linkBlock.classList.add('user-link', 'd-flex', 'align-items-center', 'text-decoration-none');
		const userAvatar = document.createElement('img');
		userAvatar.classList.add('rounded-circle', 'me-2');
		const userNameSpan = document.createElement('span');
		userManager.getUserAttr(player_id, 'avatar', "/avatars/__default__.jpg").then(url =>
		{
			userAvatar.src = url;
		});
		userAvatar.classList.add(`dynamicAvatarUrl`, `user-${player_id}`);
		userNameSpan.classList.add(`dynamicDisplayName`, `user-${player_id}`);
		userManager.getUserAttr(player_id, 'display_name', player_id).then(displayName => {
			console.log(`display name is ${displayName}`);
			userNameSpan.textContent = displayName;
		});
		linkBlock.href = `https://${window.location.host}/api/users/${player_id}/`;
		linkBlock.appendChild(userAvatar);
		linkBlock.appendChild(userNameSpan);
		nameCell.appendChild(linkBlock);
		friendRow.appendChild(nameCell);

		const buttonCell = document.createElement('td');
		buttonCell.classList.add('right');
		const inviteButton = document.createElement('button');
		inviteButton.className = "btn btn-warning";
		inviteButton.style.backgroundColor = "#a05618";
		inviteButton.style.borderColor = "#a05618";
    	inviteButton.style.color = "#000";
		inviteButton.textContent = "Invite";
		inviteButton.onclick = () => {this.inviteFriend(player_id);
			inviteButton.textContent = "Invite sent";
			inviteButton.disabled = true;
		}
		buttonCell.appendChild(inviteButton);
		friendRow.appendChild(buttonCell);

		tableElement.appendChild(friendRow);
	}

	displayFriends(friends)
	{
		const friendList = document.getElementById('friendList');
		friendList.innerHTML = '';

		friends.forEach(friend_id => {
			if (authenticatedUser.is_friend(friend_id))
				this.appendFriendEntry(friendList, friend_id);
		});
		new bootstrap.Modal(document.getElementById('inviteFriendsModal')).show();
	}

	addBot() {
		this.sendMessage({ type: 'add_bot' });
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

		this.sendMessage({ type: 'updateLobbyOptions', options }).catch((error) => this.errorHandler(error));
	}

	showOnlinePlayers() {
		// Demander la liste des joueurs en ligne via WebSocket
		this.sendMessage({'type' : 'get_online_players'}, 1000)
		.then ((message) => {
			const players = message.players;
			console.log(`online players`);
			console.log(players);
			this.displayOnlinePlayers(players);
		})
		.catch (error => this.errorHandler(error));
	}


	appendPlayerStatusEntry(tableElement, player_id, player_data, modal)
	{

		console.log('adding player');
		console.log(player_id);
		console.log(self.username);
		if (player_id == authenticatedUser.username)
		{
			return ;
		}
		const playerRow = document.createElement('tr');

		const nameCell = document.createElement('td');
		nameCell.classList.add('left');
		const linkBlock = document.createElement('a');
		linkBlock.classList.add('user-link', 'd-flex', 'align-items-center', 'text-decoration-none');
		const userAvatar = document.createElement('img');
		userAvatar.classList.add('rounded-circle', 'me-2');
		const userNameSpan = document.createElement('span');
		userManager.getUserAttr(player_id, 'avatar', "/avatars/__default__.jpg").then(url =>
		{
			userAvatar.src = url;
		});
		userAvatar.classList.add(`dynamicAvatarUrl`, `user-${player_id}`);
		userNameSpan.classList.add(`dynamicDisplayName`, `user-${player_id}`);
		userManager.getUserAttr(player_id, 'display_name', player_id).then(displayName => {
			userNameSpan.textContent = displayName;
		});
		linkBlock.href = `https://${window.location.host}/api/users/${player_id}/`;
		linkBlock.appendChild(userAvatar);
		linkBlock.appendChild(userNameSpan);
		nameCell.appendChild(linkBlock);
		playerRow.appendChild(nameCell);

		const statusCell = document.createElement('td');
		statusCell.classList.add('center');
		statusCell.textContent = player_data.status;
		playerRow.appendChild(statusCell);

		const buttonCell = document.createElement('td');
		buttonCell.classList.add('right');
		const actionButton = document.createElement('button');
		actionButton.className = "btn btn-warning";
		actionButton.style.backgroundColor = "#a05618";
		actionButton.style.borderColor = "#a05618";
    	actionButton.style.color = "#000";
		switch (player_data.status)
		{
			case 'in_game':
				actionButton.textContent = "Spectate";
				actionButton.onclick = () => {this.spectateLobby(player_data.lobby_id);}
				break ;
			case 'in_lobby':
				actionButton.textContent = "Join";
				actionButton.onclick = () => {
					modal.hide();
					this.joinLobby(player_data.lobby_id);
				}
				break ;
			case 'online':
				actionButton.textContent = "Let me chill !"
		}
		buttonCell.appendChild(actionButton);
		playerRow.appendChild(buttonCell);

		tableElement.appendChild(playerRow);

	}


	displayOnlinePlayers(players)
	{
		let modal = new bootstrap.Modal(document.getElementById('displayOnlinePlayersModal'));
		const onlinePlayers = document.getElementById('onlinePlayers');
		onlinePlayers.innerHTML = '';
		Object.entries(players).forEach(player_data => {
			if (authenticatedUser.is_friend(player_data[0]))
				this.appendPlayerStatusEntry(onlinePlayers, player_data[0], player_data[1], modal);
		});
		modal.show();
	}

	spectateLobby(lobby_id)
	{
		this.sendMessage({type : "spectate_game", lobby_id : lobby_id}, 500).then ((message) => {
			if (message === undefined)
				throw new Error("Invalid lobby");
			const game_type = message.game_type;
			window.location.hash = `#${game_type}?id=${message.lobby_id}`;
		})
		.catch (error => this.errorHandler(error));
	}


	game_start(message)
	{
		console.log("WTF");
		const websocket_id = message.websocket_id;
		const game_type = message.game_type;
		window.location.hash = `#${game_type}?id=${websocket_id}`;
	}

	// Connecter le WebSocket au chargement de la page
	dispatch(message) {
		console.log(message.type)
		if (message.type === 'error')
			this.errorHandler(message);
		else if (typeof this[message.type] === "function") {
			this[message.type](message);
		} else {
			const errMessage = `Received a message type which has no handler: ${message.type}`;
			console.error(errMessage);
			this.errorHandler(errMessage);
		}
	}

	async updateUserInfos(username, userInfo) {
		console.log(`updating ${username} informations`);
		document.querySelectorAll(`.dynamicDisplayName.user-${username}`).forEach(el => {
			el.textContent = userInfo.display_name;
		});
		document.querySelectorAll(`.dynamicAvatarUrl.user-${username}`).forEach(el => {
			el.src = userInfo.avatar + "#" + new Date().getTime();
		});
	}

	async displayTournamentTree(id) {
		this.tournamentTree = new TournamentTree(id);
		const container = document.getElementById('tournamentModalDiv');
		this.tournamentTree.init(container);
		let modal = new bootstrap.Modal(document.getElementById('tournamentModal'));
		modal.show();

		// viewManager.v
	}




    cleanupView() {
        if (this.socket) {
			this.received_error = true;
            this.socket.close();
			this.socket = undefined;
        }

		this.showOnlinePLayersButton.removeEventListener('click', this.showOnlinePlayers);
		this.openLobbyOptionsButton.removeEventListener('clck', this.openLobbyOptions);
		//this.startGameButton.removeEventListener('click', this.startGame);
		this.inviteFriendsButton.removeEventListener('click', this.inviteFriends);
		this.leaveLobbyButton.removeEventListener('click', this.leaveLobby);
		this.joinLobbyButton.removeEventListener('click', this.joinLobbyById);
		this.createLobbyButton.removeEventListener('click', this.createLobby);
		this.saveLobbyOptionsButton.removeEventListener('click', this.saveLobbyOptions);

        // this.startButton.removeEventListener('click', this.startMatchmaking);
    }
}


