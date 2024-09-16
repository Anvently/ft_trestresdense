from typing import Dict, Any, List
from matchmaking.consumers import Lobby

class Turnament:
	def __init__(self, data: Dict[str, Any]) -> None:
		self.game_name = data['game_name']
		self.number_of_players = data['number_players']
		self.default_settings = data.get('default_settings', {
			'lives':10
		})
		self.public = data.get('public', True)
		self.lobbys: List[Lobby] = []

	def 
