from typing import Dict, Any, List, Tuple
from matchmaking.common import online_players, tournaments, PlayerStatus, lobbies
import re

SUFFIXES = {
	2: ".0",
	4: ".1.{0}",
	8: ".2.{0}",
	16: ".3.{0}",
	32: ".4.{0}"
}


class Tournament:
	def __init__(self, data: Dict[str, Any]) -> None:
		self.game_type = data['game_type']
		self.hostname = data['hostname']
		self.name = data.pop('name', f"{self.hostname}'s tournament")
		self.number_players = data['nbr_players']
		self.default_settings = data.get('default_settings', {
			'lives':10
		})
		self.id = data['id']
		self.players = data['players']
		for i in range(int(self.number_players / 2)):
			id=f"{self.id}{SUFFIXES[self.number_players].format(i)}"
			from matchmaking.lobby import TournamentMatchLobby
			lobbies[id] = TournamentMatchLobby({
				'name': self.generate_match_name(0, 0),
				'game_type': self.game_type,
				'nbr_players': 2,
				'settings': self.default_settings
			}, id)
			print(i, id)
			self.reassign_player(self.players[i], id, PlayerStatus.IN_TOURNAMENT_LOBBY)
			self.reassign_player(self.players[i + int(self.number_players / 2)], id, PlayerStatus.IN_TOURNAMENT_LOBBY)
			# if not lobbies[id].init_game():
			# 	raise Exception("Failed to init tournament")

	def reassign_player(self, player_id: str, lobby_id: str, new_status: int = PlayerStatus.IN_TOURNAMENT_LOBBY):
		lobbies[lobby_id].add_player(player_id)
		if not player_id[0] == '!':
			lobbies[online_players[player_id]['lobby_id']].remove_player(player_id)
			online_players[player_id]['lobby_id'] = lobby_id
			online_players[player_id]['tournament_id'] = self.id
			online_players[player_id]['status'] = new_status


	def generate_match_name(self, stage: int, nbr: int) -> str:
		if stage == 0:
			return f"{self.name}'s final"
		return f'{self.name}\'s {["1st", "2nd", "3rd", "4th"][nbr]} {["semi", "quarter", "eighth"][stage]}'

	@staticmethod
	def extract_id_info(string: str) -> Tuple[int, int]:
		match = re.search(r'\.(\d+)(?:\.(\d+))?', string)
		if match:
			return (int(match.group(1)), int(match.group(2)))
		return (None, None)

	def delete(self):
		""" May want to post special results ?? """
		del tournaments[self.id]

	def setup_next_match(self, previous_stage: int, previous_idx: int) -> str:
		id = f"{self.id}.{previous_stage - 1}.{previous_idx / 2}"
		if id in lobbies:
			return id
		from matchmaking.lobby import TournamentMatchLobby
		lobbies[id] = TournamentMatchLobby({
			'name': self.generate_match_name(previous_stage - 1, previous_idx / 2),
			'game_type': self.game_type,
			'number_players': 2,
			'settings': self.default_settings
		}, id=id)
		return id

	def handle_result(self, results: Dict[str, Any]):
		""" Instantiate the next lobby if any. Assign the winner
		 to its and update loser's status. """
		if results['status'] == 'cancelled':
			self.delete()
			return
		lobby_id:str = results['lobby_id']
		stage, match_idx = Tournament.extract_id_info(lobby_id)
		for score in results['scores_set']:
			if score['has_win'] == True and stage != 0:
				""" We need to instantiate the new lobby if it doesn't exist yet,
				 and assign player to it. """
				next_match_id = self.setup_next_match(stage, match_idx)
				self.reassign_player(score['username'], next_match_id, PlayerStatus.IN_TOURNAMENT_LOBBY)
			else:
				""" If someone lose or it was a final, it's up to the
				 lobby result handler to update status of associated players. """
				pass
		if stage == 0: #If final match
			self.delete()

