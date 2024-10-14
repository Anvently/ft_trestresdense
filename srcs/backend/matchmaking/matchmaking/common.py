from typing import Any, Dict
from enum import IntEnum
import logging
from functools import total_ordering

@total_ordering
class PlayerStatus(IntEnum):
	NO_LOBBY = 0
	IN_LOBBY = 1
	IN_GAME = 2
	IN_TOURNAMENT_LOBBY = 3
	def __lt__(self, other):
		if self.__class__ is other.__class__:
			return self.value < other.value
		return NotImplemented
	# def __int__(self):
	# 	return self.value

lobbies: Dict[str, 'Lobby'] = {}
online_players : Dict[str, Dict[str, Any]] = {}
tournaments: Dict[str, 'Tournament'] = {}

from matchmaking.tournament import Tournament
def tournament_creator(data: Dict[str, Any]) -> bool:
	try:
		tournament = Tournament(data)
		tournaments[tournament.id] = tournament
	except Exception as e :
		logging.error(e)
		return False
	return True
