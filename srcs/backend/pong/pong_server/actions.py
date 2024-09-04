from typing import Any, Dict, List

def	init_game(id:str, settings: Dict[str, Any], players: List[str]):
	""" 
	Initialize a game with given id, settings and list of players.
	The id must be provided by matchmaking service.
	"""
	pass

def check_lobby_id(id:str) -> bool:
	""" Check that a corresponding lobby exists"""
	return True

def check_user_member(lobby_id:str, username:str):
	"""Check that the user belong to the lobby"""
	return True
