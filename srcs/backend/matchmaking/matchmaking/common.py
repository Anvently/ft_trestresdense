from typing import Any, Dict
from enum import Enum

class PlayerStatus(Enum):
	NO_LOBBY = 0
	IN_LOBBY = 1
	IN_GAME = 2
	IN_TURNAMENT_LOBBY = 3

lobbies: Dict[str, 'Lobby'] = {}
online_players : Dict[str, Dict[str, Any]] = {}
tournaments: Dict[str, 'Tournament'] = []

from matchmaking.tournament import Tournament
def tournament_creator(data: Dict[str, Any]) -> bool:
	try:
		tournaments[data['id']] = Tournament(data)
	except:
		return False
	return True
