import uuid
import base64
from matchmaking.consumers import MatchMakingConsumer
from typing import List, Dict, Set, Tuple, Any
import json
from abc import abstractmethod


def generate_id(public):
	""" Soimplr => S
	 	TurnamentInit => I
		 TournamentLobby T
		   """
	u = uuid.uuid4()
	match public:
		case False:
			prefix = 'C'
		case True:
			prefix = 'O'
	short_u = base64.urlsafe_b64encode(u.bytes).rstrip(b'=').decode('ascii')
	short_u = prefix + short_u
	if short_u not in MatchMakingConsumer.public_lobbies and short_u not in MatchMakingConsumer.private_lobbies:
		return short_u
	else:
		return generate_id()


class Lobby():
	def __init__(self, settings: Dict[str, Any], id:str = None) -> None:
		self.hostname = settings.pop('hostname', None)
		# self.check_rules(lives, player_num, type)
		self.name = settings.pop('name', f"{self.hostname}'s lobby")
		if not id:
			self.id = generate_id(settings.get('public'))
		self.players: List[str] = []
		self.started = False
		self.game_type = settings.pop('game_type')
		self.player_num = settings.pop('number_players')
		self.settings = settings
		self.check_rules()

	def add_player(self, player_id):
		if len(self.players) == self.player_num:
			return False
		self.players.append(player_id)
		return True

	def remove_player(self, player_id):
		if player_id in self.players:
			self.players.remove(player_id)

	def check_rules(self):
		match (self.type, self.player_num, self.settings['lives']):
			case("classic", x, y) if (x == 2 or x == 4) and y > 0 :
				pass
			case("3d", 2, y) if y > 0:
				pass
			case _:
				raise ValueError("Wrong rules")
			
	def init_game(self):
		""" Send HTTP request to pong backend and sent link to consumers. Update players status """
		pass
			
	@abstractmethod
	def handle_results(self, results: dict[str, Any]):
		""" Simple Match: register in database
			Turnament Match: register in database + refer to turnament instance"""
		pass

	def handle_full(self):
		""" For turnament lobby, may be usefull to start game automatically """
		pass

class SimpleMatchLobby(Lobby):

	def __init__(self, settings: Dict[str, Any]) -> None:
		super().__init__(settings)
		self.players.append(self.hostname)

class LocalMatchLobby(SimpleMatchLobby):

	def __init__(self, settings: Dict[str, Any]) -> None:
		super().__init__(settings)
		self.settings['public'] = False

	def handle_results(self, results: Dict[str, Any]):
		pass

class TurnamentInitialLobby(Lobby):

	def __init__(self, settings: Dict[str, Any]) -> None:
		super().__init__(settings)

	def check_rules(self):
		""" Need to override """
		if self.number_players not in (2, 4, 8):
			raise Exception('Invalid number of players.')

	def handle_results(self, results: Dict[str, Any]):
		pass

	def handle_full(self):
		pass

	def start_tournament(self):
		""" Create turnament instance. Turnament instance will then create lobby instances
		 asnd assign players to them. """
		pass

class TurnamentMatchLobby(Lobby):

	def __init__(self, settings: Dict[str, Any], id:str) -> None:
		super().__init__(settings, id)

lobbies: Dict[str, Lobby] = {}
