from typing import Dict, Any, List
from matchmaking.lobby import Lobby, lobbies, generate_id

class Tournament:
	def __init__(self, data: Dict[str, Any]) -> None:
		self.game_type = data['game_type']
		self.hostname = data['hostname']
		self.name = data.get('name', f"{self.hostname}'s tournament")
		self.number_players = data['number_players']
		self.default_settings = data.get('default_settings', {
			'lives':10
		})
		self.id = data['id']
		# self.current_matches: List[str] = []

	def validate(self):
		if self.id in lobbies:
			raise Exception('Tournament with this id already exists.')
		if self.number_players != 0 or self.number_players % 2 or self.number_players == 6 or self.number_players > 8:
			raise Exception('Invalid number of players.')
		
	def init_waiting_lobby(self):
		""" Add the initial lobby to the list of lobbies """
		lobbies[self.id] = Lobby(
			hostname=self.hostname,
			name=self.name,
			lives=self.default_settings['lives'],
			player_num=self.number_players,
			public=self.public,
			tournament=self.id
		)

	def register_match(self):
		"""  """

tournaments: Dict[str, Tournament] = []
