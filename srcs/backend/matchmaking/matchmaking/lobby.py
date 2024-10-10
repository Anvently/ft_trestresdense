import uuid
import base64
from typing import List, Dict, Set, Tuple, Any
import json
import requests
from abc import abstractmethod
from django.conf import settings
# from matchmaking.common import tournament_creator
import time, logging, random, string
from matchmaking.common import online_players, PlayerStatus, lobbies, tournaments, tournament_creator



def generate_id(public, spectate ,prefix=''):
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
		if len(self.players) == self.player_num:
			logging.warning(f"Trying to add a player ({player_id}) to a full lobby")
			print(f"players = {self.players}")
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
			logging.warning(f"{player_id} marked as ready but game has already started.")
			return False
		self.players[player_id]['is_ready'] = True
		if len(self.players) != self.player_num or any(not player['is_ready'] for (player_id, player) in self.players.items()):
			return False
		if not self.init_game():
			return False
		return True

	def player_not_ready(self, player_id):
		self.players[player_id]['is_ready'] = False

	def player_joined(self, player_id):
		if player_id not in self.players:
			raise Exception(f"{player_id} try to join lobby {self.id} but does not belong to it.")
		self.players[player_id]['has_joined'] = True

	def remove_player(self, player_id):
		print(f"before kick {self.players}")
		if player_id in self.players:
			del self.players[player_id]
		if len(self.players) == 0:
			self.delete()
		print(f"after kick {self.players}")

	def check_rules(self):
		pass

	def init_game(self) -> bool:
		""" Send HTTP request to pong backend and sent link to consumers. Update players status """
		# This exception could be ignored and we could complete here missing player with bots
		if len(self.players) != self.player_num:
			raise Exception("Can't init game. Actual number of players does not match set number of players.")
		# Send request
		data = {
			'game_name': self.game_type,
			'game_id': self.id,
			'settings': self.settings,
			'player_list': list(self.players.keys())
		}
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
			print(f"ERROR: Failed to post game initialization to pong api: {e}")
			return False
		# Update player status
		for player_id, player in self.iterate_human_player():
			online_players[player_id]['status'] = PlayerStatus.IN_GAME
		self.started = True
		return True

	def delete(self):
		""" Delete players from online_players and remove lobby from list of lobbies """
		for player_id, player in self.iterate_human_player():
			if online_players[player_id]['lobby_id'] == self.id:
				del online_players[player_id]
		del lobbies[self.id]

	def handle_results(self, results: dict[str, Any]):
		""" register in database"""
		if results['status'] != 'cancelled':
			results.pop('status')
			results['hostname'] = self.hostname
			# results['scores_set'] = [el for el in results['scores_set'] if el['username'][0] != '!']
			try:
				response = requests.post('http://users_api:8001/post-result/?format=json',
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
				logging.error(f"Failed to post results to users_info: {e}")

	def check_time_out(self):
		pass

	def __str__(self) -> str:
		return "lobby"


class SimpleMatchLobby(Lobby):

	def __init__(self, settings: Dict[str, Any], prefix:str='S') -> None:
		super().__init__(settings, prefix=prefix)
		self.add_player(self.hostname)

	def handle_results(self, results: Dict[str, Any]):
		super().handle_results(results)
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

	def __init__(self, settings: Dict[str, Any]) -> None:
		super().__init__(settings, prefix='L')
		self.settings['public'] = False

	def handle_results(self, results: Dict[str, Any]):
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


class TurnamentInitialLobby(Lobby):

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


	def handle_results(self, results: Dict[str, Any]):
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
			return False
		self.delete()
		return True

	def __str__(self) -> str:
		return "tournament_lobby"


class TurnamentMatchLobby(Lobby):

	def __init__(self, settings: Dict[str, Any], id:str) -> None:
		super().__init__(settings, id, 'T')
		self.tournament_id = self.id[:self.id.find('.')]
		self.tournament_name = self.settings.pop('tournament_name')
		# self.tournament_name = settings.get('tournament_name')
		self.created_at = time.time()

	def handle_results(self, results: Dict[str, Any]):
		if self.tournament_id in tournaments: #Probably not necessary to check that
			results['tournament_name'] = self.tournament_name
			super().handle_results(results)
			tournaments['tournament_id'].handle_result(results)
		self.delete()

	def __str__(self) -> str:
		return "tournament_match"

	# def check_time_out(self):
	# 	if time.time() - self.created_at >


lobby = SimpleMatchLobby({
	'hostname': '!AI1',
	'name': 'pouet_pouet',
	'game_type': 'pong3d',
	'nbr_players': 2,
	'lives':20,
	'allow_spectators':True,
	'public': True
})

lobby2 = SimpleMatchLobby({
	'hostname': 'herve',
	'name': "Herve's room",
	'game_type': 'pong2d',
	'nbr_players': 4,
	'lives':20,
	'allow_spectators':False,
	'public': True
})


lobby3 = TurnamentInitialLobby({
	'hostname': 'john',
	'name': "Tornois",
	'game_type': 'pong2d',
	'nbr_players': 8,
	'lives':20,
	'allow_spectators':False,
	'public': True
})

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

lobbies[lobby.id] = lobby
lobbies[lobby2.id] = lobby2
lobbies[lobby3.id] = lobby3

# lobbies[lobby.id].add_bot()
# lobbies["9"].add_bot()






"""



"""
