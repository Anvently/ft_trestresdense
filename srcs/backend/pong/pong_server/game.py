from typing import List, Dict, Any

class PongLobby:

	def __init__(self, lobby_id: str) -> None:
		self.lobby_id = lobby_id
		
	# Class function
	def init_game():
		pass

	def player_input(self, player_id, key):
		pass

	def get_state(self) -> Dict[str, Any]:
		return {
			'ball': self.ball_position,
			'playerN': "pos"
		}
	
lobbys_list : Dict[str, PongLobby] = []
		