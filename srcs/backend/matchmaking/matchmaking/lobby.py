import uuid
import base64
from matchmaking.consumers import MatchMakingConsumer
from typing import List, Dict, Set, Tuple, Any
import json




def generate_id(public):
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
	def __init__(self, hostname, name, lives=3, player_num = 2 , type='classic', public: bool = True) -> None:
		self.hostname = hostname
		self.check_rules(lives, player_num, type)
		self.lobby_name = name
		self.id = generate_id(public)
		self.players: List[str]
		self.players.append(hostname)
		self.players[0] = hostname
		self.public = public
		self.started = False

	def add_player(self, player_id):
		if len(self.players) == self.player_num:
			return False
		self.players.append(player_id)
		return True

	def remove_player(self, player_id):
		if player_id in self.players:
			self.players.remove(player_id)

	def check_rules(self, lives, player_num, type):
		match (type, player_num, lives):
			case("classic", x, y) if (x == 2 or x ==4) and y > 0 :
				pass
			case("3d", 2, y) if y > 0:
				pass
			case _:
				raise ValueError("Wrong rules")
		self.game_type = type
		self.player_num = player_num
		self.lives = lives
