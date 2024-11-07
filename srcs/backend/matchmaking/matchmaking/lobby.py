import uuid
import base64
from typing import List, Dict, Set, Tuple, Any
import json
import requests
import copy
from abc import abstractmethod
from django.conf import settings
# from matchmaking.common import tournament_creator
import time, logging, random, string
from matchmaking.common import online_players, PlayerStatus, lobbies, tournaments, tournament_creator
from channels.layers import get_channel_layer
from asgiref.sync import sync_to_async, async_to_sync
logger = logging.getLogger(__name__)

def generate_id(public, spectate, prefix=''):
	""" Simplr => S
	 	TurnamentInit => I
		 TournamentLobby T
		 LocalLobby => L
		   """
	u = uuid.uuid4()
	match (public, spectate):
		case (True, True):
			prefix += 'OA'
		case (True, False):
			prefix += 'OD'
		case (False, True):
			prefix += 'CA'
		case (False, False):
			prefix += 'CD'
	short_u = base64.urlsafe_b64encode(u.bytes).rstrip(b'=').decode('ascii')
	short_u = prefix + short_u
	if short_u not in lobbies:
		return short_u
	else:
		return generate_id(public)

def generate_bot_id():
	return '!' + ''.join(random.choice(string.ascii_letters + string.digits) for _ in range(31))

class Lobby():
	def __init__(self, settings: Dict[str, Any], id:str = None, prefix:str='') -> None:
		self.hostname = settings.pop('hostname', None)
		# self.check_rules(lives, player_num, type)
		self.name = settings.pop('name', f"{self.hostname}'s lobby")
		if id == None:
			self.id = generate_id(settings['public'], settings['allow_spectators'], prefix)
		else:
			self.id = id
		""" {has_joined: bool, is_ready: bool, is_bot: bool} """
		self.players: Dict[str, Dict[str, Any]] = {}
		self.started = False
		self.game_type = settings.pop('game_type')
		self.player_num = settings.pop('nbr_players')
		if ('settings' in settings):
			self.settings = settings['settings']
		else:
			self.settings = settings
		self.settings['nbr_players'] = self.player_num
		self.check_rules()
		for n in range(settings.get('nbr_bots', 0)):
			self.add_bot()

	def iterate_human_player(self):
		return ((player_id, player) for player_id, player in self.players.items() if not player['is_bot'])

	def add_bot(self) -> bool:
		return self.add_player(generate_bot_id())

	def remove_bot(self):
		""" Delete the first bot in the list players if any. """
		for player_id, player in self.players:
			if player['is_bot'] == True:
				del self.players[player_id]
				return

	def add_player(self, player_id) -> bool:
		""" Add a player  to a lobby. Return True is success.
		 If player was bot it will mark himself has ready and possibly trigger
		  game initialization. """


		if player_id in self.players:
			return True

		if len(self.players) == self.player_num:
			logger.warning(f"Trying to add a player ({player_id}) to a full lobby")
			return False

		self.players[player_id] = {
			'has_joined': False,
			'is_ready': False,
			'is_bot': False
		}
		if player_id[0] == '!':
			self.players[player_id] = {
				'has_joined': True,
				'is_ready': True,
				'is_bot': True
			}
			self.player_ready(player_id)
			""" NOTE
			 If a player mark himself has ready and before a bot joins the game,
			  we'll have no way to inform back the player the game needs to be started.
			   Can only happen with modif during lobby phase if we allow that. """
		return True

	def player_ready(self, player_id) -> bool:
		""" Mark a player as ready and return True if it was the last player
		 and the game was initiated with success. """
		if self.started == True:
			logger.warning(f"{player_id} marked as ready but game has already started.")
			return False
		if player_id not in self.players:
			return False
		self.players[player_id]['is_ready'] = True
		if len(self.players) != self.player_num or any(not player['is_ready'] for (player_id, player) in self.players.items()):
			return False
		if not self.init_game():
			return False
		return True

	def player_not_ready(self, player_id):
		self.players[player_id]['is_ready'] = False

	async def player_joined(self, player_id):
		if player_id not in self.players:
			raise Exception(f"{player_id} try to join lobby {self.id} but does not belong to it.")
		self.players[player_id]['has_joined'] = True
		await self.check_all_joined()

	async def check_all_joined(self):
		pass

	async def player_quit(self, player_id):
		pass

	def remove_player(self, player_id):
		if player_id in self.players:
			del self.players[player_id]
		if sum (1 for _ in self.iterate_human_player()) == 0:
			self.delete()

	def remove_all(self):
		self.players = {}
		self.delete()


	def check_rules(self):
		pass

	def init_game(self, extra_data: Dict[str, any] = None) -> bool:
		""" Send HTTP request to pong backend and sent link to consumers. Update players status """
		# This exception could be ignored and we could complete here missing player with bots
		if len(self.players) != self.player_num:
			raise Exception("Can't init game. Actual number of players does not match set number of players.")
		# Send request
		data = {
			'game_name': self.game_type,
			'game_id': self.id,
			'hostname': self.hostname,
			'settings': self.settings,
			'player_list': list(self.players.keys())
		}
		if (extra_data):
			data.update(extra_data)
		try:
			response = requests.post('http://pong:8002/init-game/?format=json',
					data=json.dumps(data),
					headers = {
						'Host': 'localhost',
						'Content-type': 'application/json',
						'Authorization': "Bearer {0}".format(settings.API_TOKEN.decode('ASCII'))
						}
					)
			if response.status_code != 201:
				raise Exception(f"expected status 201 got {response.status_code} ({response.content})")
		except Exception as e:
			logger.error(f"ERROR: Failed to post game initialization to pong api: {e}")
			return False
		# Update player status
		for player_id, player in self.iterate_human_player():
			online_players[player_id]['status'] = PlayerStatus.IN_GAME
		self.started = True
		return True

	def delete(self):
		""" Delete players from online_players and remove lobby from list of lobbies """
		for player_id, player in self.iterate_human_player():
			if player_id in online_players and online_players[player_id]['lobby_id'] == self.id:
				del online_players[player_id]
		if self.id in lobbies:
			del lobbies[self.id]

	async def handle_results(self, results: dict[str, Any]):
		""" register in database"""
		if self.hostname:
			results['host'] = self.hostname
		results['lobby_name'] = self.name
		# results['scores_set'] = [el for el in results['scores_set'] if el['username'][0] != '!']
		try:
			response = await sync_to_async(requests.post)('http://users-api:8001/post-result/?format=json',
					data=json.dumps(results),
					headers = {
						'Host': 'localhost',
						'Content-type': 'application/json',
						'Authorization': "Bearer {0}".format(settings.API_TOKEN.decode('ASCII'))
						}
					)
			if response.status_code != 201:
				raise Exception(f"expected status 201 got {response.status_code} ({response.content})")
		except Exception as e:
			logger.error(f"Failed to post results to users_info: {e}")

	def check_time_out(self):
		pass

	def jsonize(self):
		lobby_data = {}
		lobby_data['game_type'] = self.game_type
		lobby_data['match_type'] = str(self)
		lobby_data['lobby_id'] = self.id
		if (hasattr(self, 'tournament_id')):
			lobby_data['tournament_id'] = self.tournament_id
		lobby_data['name'] = self.name
		lobby_data['host'] = self.hostname
		lobby_data['slots'] = f"{len(self.players)}/{self.player_num}"
		lobby_data['players'] = copy.deepcopy(self.players)
		lobby_data['settings'] = self.settings
		if (str(self) == "local_match" or str(self) == "local_tournament_initial_lobby"):
			lobby_data['host'] = self.hostnickname
		return lobby_data

	def __str__(self) -> str:
		return "lobby"


class SimpleMatchLobby(Lobby):

	def __init__(self, settings: Dict[str, Any], prefix:str='S') -> None:
		super().__init__(settings, prefix=prefix)
		self.add_player(self.hostname)

	async def handle_results(self, results: Dict[str, Any]):
		await super().handle_results(results)
		self.delete()

	def __str__(self) -> str:
		return "simple_match"

	def check_rules(self):
		match (self.game_type, self.player_num, self.settings['lives']):
			case ("pong2d", x, y) if x in (2, 4) and y > 0:
				pass
			case ("pong3d", x, y) if x == 2 and y > 0:
				pass
			case _:
				raise KeyError("Wrong settings")


class LocalMatchLobby(SimpleMatchLobby):

	def __init__(self, settings: Dict[str, Any], prefix='L') -> None:
		settings['public'] = False
		super().__init__(settings, prefix)
		self.remove_player(self.hostname)
		self.hostnickname = self.hostname + '.' + settings['nickname']
		self.add_player(self.hostnickname)

	async def handle_results(self, results: Dict[str, Any]):
		self.delete()

	def __str__(self) -> str:
		return "local_match"

	def check_rules(self):
		match(self.game_type, self.player_num, self.settings['lives']):
			case ("pong2d", x, y) if x in (2,4) and y > 0:
				pass
			case ("pong3d", 2, y) if y > 0:
				pass
			case _:
				raise KeyError("Wrong settings")

	def delete(self):
		""" Delete players from online_players and remove lobby from list of lobbies """
		if online_players[self.hostname]['lobby_id'] == self.id:
			del online_players[self.hostname]
		if self.id in lobbies:
			del lobbies[self.id]

	def add_local_player(self, player_id):
		if len(self.players) == self.player_num:
			return False
		if player_id in self.players:
			return False
		self.players[player_id] = {
			'has_joined': True,
			'is_ready': True,
			'is_bot': False
		}
		return True

	def player_not_ready(self, player_id):
		if player_id != self.hostname:
			return
		self.players[self.hostnickname]['is_ready'] = False

	def player_ready(self, player_id) -> bool:
		""" Mark a player as ready and return True if it was the last player
		 and the game was initiated with success. """
		if self.started == True:
			logger.warning(f"{player_id} marked as ready but game has already started.")
			return False
		if player_id != self.hostname:
			return False
		self.players[self.hostnickname]['is_ready'] = True
		if len(self.players) != self.player_num or any(not player['is_ready'] for (player_id, player) in self.players.items()):
			return False
		if not self.init_game():
			return False
		return True

	def init_game(self, extra_data: Dict[str, any] = None) -> bool:
		""" Send HTTP request to pong backend and sent link to consumers. Update players status """
		# This exception could be ignored and we could complete here missing player with bots
		if len(self.players) != self.player_num:
			raise Exception("Can't init game. Actual number of players does not match set number of players.")
		# Send request
		data = {
			'game_name': self.game_type,
			'game_id': self.id,
			'hostname': self.hostname,
			'settings': self.settings,
			'player_list': self.order_players(),
		}
		if (extra_data):
			data.update(extra_data)
		try:
			response = requests.post('http://pong:8002/init-game/?format=json',
					data=json.dumps(data),
					headers = {
						'Host': 'localhost',
						'Content-type': 'application/json',
						'Authorization': "Bearer {0}".format(settings.API_TOKEN.decode('ASCII'))
						}
					)
			if response.status_code != 201:
				raise Exception(f"expected status 201 got {response.status_code} ({response.content})")
		except Exception as e:
			logger.error(f"ERROR: Failed to post game initialization to pong api: {e}")
			return False
		# Update player status
		online_players[self.hostname]['status'] = PlayerStatus.IN_GAME
		self.started = True
		return True

	async def player_joined(self, player_id):
		if player_id != self.hostname:
			raise Exception(f"{player_id} try to join lobby {self.id} but does not belong to it.")
		self.players[self.hostnickname]['has_joined'] = True


	def order_players(self):
		player_list = []
		for player in self.players.keys():
			if player[0] != '!':
				player_list.append(player)
		for player in self.players.keys():
			if player[0] == '!':
				player_list.append(player)
		return player_list


class TournamentInitialLobby(Lobby):

	def __init__(self, settings: Dict[str, Any]) -> None:
		super().__init__(settings, prefix='I')
		self.add_player(self.hostname)

	def check_rules(self):

		if self.game_type not in ("pong2d", "pong3d"):
			raise KeyError(f"Wrong settings {self.game_type}")
		if self.player_num not in (2, 4 ,8):
			raise KeyError(f"Wrong settings, {self.player_num} players")
		if self.settings['lives'] < 1:
			raise KeyError(f"Wrong lives, {self.settings['lives']}")


	async def handle_results(self, results: Dict[str, Any]):
		pass

	def init_game(self) -> bool:
		""" Create turnament instance. Turnament instance will then create lobby instances
		 asnd assign players to them. """
		if not tournament_creator({
			'game_type': self.game_type,
			'hostname': self.hostname,
			'name': self.name,
			'nbr_players': self.player_num,
			'default_settings': self.settings,
			'id': self.id,
			'players': list(self.players.keys())
		}):
			logger.error("error creating tournament")
			return False
		self.delete()
		return True

	def __str__(self) -> str:
		return "tournament_lobby"


class TournamentMatchLobby(Lobby):

	def __init__(self, settings: Dict[str, Any], id:str) -> None:
		self.tournament_id = id[:id.find('.')]
		self.created_at = time.time()
		self.hostname = None
		super().__init__(settings, id, 'T')

	async def handle_results(self, results: Dict[str, Any]):
		if self.tournament_id in tournaments: #Probably not necessary to check that
			await super().handle_results(results)
			await tournaments[self.tournament_id].handle_result(results)
		self.delete()

	def remove_player(self, player_id):
		if player_id in self.players:
			del self.players[player_id]

	async def handle_default_results(self, leaver_id):
		result = dict()
		result['status'] = 'terminated'
		result['lobby_id'] = self.id
		result['lobby_name'] = self.name
		result['game_name'] = self.game_type
		result['tournament_id'] = self.tournament_id
		result['scores_set'] = []
		for player in self.players:
			if player == leaver_id:
				pass
			else:
				result['scores_set'].append({'username' : player, 'score' : self.settings['lives'], 'has_win' : True})
		result['scores_set'].append({'username' : leaver_id, 'score' : 0, 'has_win' : False})

		await self.handle_results(result)



	def init_game(self, extra_data: Dict[str, Any] = None) -> bool:
		return super().init_game({
			'tournament_id': self.tournament_id
		})

	def __str__(self) -> str:
		return "tournament_match"

	async def check_all_joined(self):
		if self.started:
			return True
		if len(self.players) != self.player_num:
			return False
		for player in self.players:
			if not self.players[player]['has_joined']:
				return False
		channel_layer = get_channel_layer()
		await channel_layer.group_send(self.id, {'type': 'ready_up'})
		return True

	async def get_default_winner(self):
		player_joined = 0
		absent = None
		for player in self.players:
			if self.players[player]['has_joined']:
				player_joined += 1
			else:
				absent = player
		if player_joined == 0:
			return "?cancel"
		if player_joined == 2:
			return "?ok"
		return absent

class LocalTournamentLobby(Lobby):

	from matchmaking.tournament import LocalTournament

	def __init__(self, tournament: LocalTournament) -> None:
		self.created_at = time.time()
		self.tournament = tournament
		self.id = self.tournament.id
		self.game_type = self.tournament.game_type

	async def handle_results(self, results: Dict[str, Any]):
		online_players[self.tournament.hostname]['status'] = PlayerStatus.IN_LOCAL_TOURNAMENT_LOBBY
		await self.tournament.handle_result(results)

	def delete(self):
		if self.tournament.hostname in online_players:
			del online_players[self.tournament.hostname]
		if self.tournament.id in lobbies:
			del lobbies[self.id]
		if self.tournament.id in tournaments:
			del tournaments[self.tournament.id]

	async def start_game(self, lobby_id):
		return await self.tournament.start_game(lobby_id)

	def jsonize(self):
		return {
			'lobby_id': self.tournament.id,
			'name': self.tournament.name,
			'host': self.tournament.hostname,
			'game_name': self.tournament.game_type,
			'date': self.created_at,
			'number_players': self.tournament.number_players,
			'match_type': str(self),
			'lobbies_set': [match for id, match in self.tournament.matches.items()]
		}

	def __str__(self) -> str:
		return "local_tournament_lobby"

class LocalTournamentInitialLobby(LocalMatchLobby):
	def __init__(self, settings: Dict[str, Any]) -> None:
		settings['public'] = False
		settings['allow_spectators'] = False
		super().__init__(settings, prefix='J')

	def __str__(self) -> str:
		return "local_tournament_initial_lobby"

	def check_rules(self):

		if self.game_type not in ("pong2d", "pong3d"):
			raise KeyError(f"Wrong settings {self.game_type}")
		if self.player_num not in (2, 4, 8):
			raise KeyError(f"Wrong settings, {self.player_num} players")
		if self.settings['lives'] < 1:
			raise KeyError(f"Wrong lives, {self.settings['lives']}")

	async def init_game(self, extra_data: Dict[str, Any] = None) -> bool:
		data = {
			'game_type' : self.game_type,
			'hostname' : self.hostname,
			'name' : self.name,
			'nbr_players' : self.player_num,
			'id' : self.id,
			'default_settings' : self.settings,
			'players' : list(self.players.keys())}
		from matchmaking.tournament import LocalTournament
		tournament = LocalTournament(data)
		lobbies[tournament.id] = LocalTournamentLobby(tournament)
		channel_layer = get_channel_layer()
		await channel_layer.group_send(self.hostname, {"type" : "switch_to_local_tournament_lobby", "new_id" : tournament.id})


	async def player_ready(self, player_id):
		if player_id != self.hostname:
			return
		if len(self.players) != self.player_num:
			return
		await self.init_game()
		self.delete()
		return False




	# def check_time_out(self):
	# 	if time.time() - self.created_at >


# lobby = SimpleMatchLobby({
# 	'hostname': '!AI1',
# 	'name': 'pouet_pouet',
# 	'game_type': 'pong3d',
# 	'nbr_players': 2,
# 	'lives':20,
# 	'allow_spectators':True,
# 	'public': True
# })

# lobby2 = SimpleMatchLobby({
# 	'hostname': 'herve',
# 	'name': "Herve's room",
# 	'game_type': 'pong2d',
# 	'nbr_players': 4,
# 	'lives':20,
# 	'allow_spectators':False,
# 	'public': True
# })


# lobby3 = TournamentInitialLobby({
# 	'hostname': 'john',
# 	'name': "Tornois",
# 	'game_type': 'pong2d',
# 	'nbr_players': 8,
# 	'nbr_bots': 8,
# 	'lives':1,
# 	'allow_spectators': True,
# 	'public': True
# })

# lobbies[lobby3.id] = lobby3
# lobbies[lobby3.id].player_ready('john')

# lobby4 = SimpleMatchLobby({
# 	'hostname': 'chloe',
# 	'name': "Clhloe's room",
# 	'game_type': 'pong2d',
# 	'nbr_players': 4,
# 	'nbr_bots': 4,
# 	'lives':20,
# 	'allow_spectators':True,
# 	'public': True
# })
# lobbies[lobby4.id] = lobby4

# lobby5 = SimpleMatchLobby({
# 	'hostname': 'john',
# 	'name': "John's room",
# 	'game_type': 'pong2d',
# 	'nbr_players': 4,
# 	'nbr_bots': 4,
# 	'lives':20,
# 	'allow_spectators':True,
# 	'public': True
# })
# lobbies[lobby5.id] = lobby5

# lobbies[lobby.id] = lobby
# lobbies[lobby2.id] = lobby2

# lobbies[lobby.id].add_bot()
# lobbies["9"].add_bot()




