import json
import time
import asyncio
from django.conf import settings
from channels.generic.websocket import AsyncJsonWebsocketConsumer
import jwt
from typing import List, Dict, Set, Tuple, Any
from enum import Enum
import uuid
import base64
import enum
from channels.layers import get_channel_layer
from matchmaking.common import online_players, lobbies, PlayerStatus
from matchmaking.lobby import Lobby
from matchmaking.tournament import Tournament


def verify_jwt(token, is_ttl_based=False, ttl_key="exp"):
	data = jwt.decode(token, settings.RSA_PUBLIC_KEY, algorithms=["RS512"])
	if is_ttl_based:
		if data[ttl_key] < time.time():
			raise ValueError("Token expired")
	return data



def is_in_game(username):
	# check wether the client is already in a game/tournament
	# maybe allow client to connect but limit its actions ?
	if username in MatchMakingConsumer.in_game_players:
		return True
	else:
		return False


def jsonize_lobby(lobby : Lobby):
	lobby_data = {}
	lobby_data['game_type'] = lobby.game_type
	lobby_data['match_type'] = str(lobby)
	lobby_data['name'] = lobby.name
	lobby_data['host'] = lobby.hostname
	lobby_data['slots'] = f"{len(lobby.players)}/{lobby.player_num}"
	lobby_data['players'] = lobby.players
	lobby_data['settings'] = lobby.settings
	return lobby_data

def jsonize_player(player_id):
	player_data = {}
	player_data['player_id'] = player_id
	player_data['status'] = online_players[player_id].status
	if online_players[player_id].status != PlayerStatus.NO_LOBBY and online_players[player_id]._lobby_id[1] == 'O':
		player_data['lobby_id'] = online_players[player_id]._lobby_id
	return player_data

	def start(self):
		""" Send a request to backend to instantiate the lobby """


# QUESTION: est ce que on lance une boucle qui envoie une mise a jour du matchmking toutes les x secondes ou
# chaque action d'un client est transmise a tous pour adapter le front en temps reel
# cas 1 => moins de messages, il faut mettre en place une boucle
# cas 2 => bcp de messages, bcp de fonctions, plus simple

"""
Status:
	- waiting for a lobby
	- in lobby
	- in game
	- waiting for next tournt game
 """

"""
	online players = {
		"payer_1": {
			'status': int,
			'lobby_id': str,
			'turnament_id': str
		}
	}
 """


"""
{2, 125.0, 125} -> {3, 125.1 , 125}
"""
reset_status = {'status': 0, 'lobby_id' : None, 'turnament_id' : None}

class Errors(Enum):
	INVALID_TYPE = 4001
	USERNAME_MISSING = 4002
	AUTH_ERROR = 4003
	JOIN_ERROR = 4004
	HOST_ERROR = 4005
	LEAVE_ERROR = 4006

def get_status_from_lobby(lobby_id):
	match lobby_id[0]:
		case 'I':
			return PlayerStatus.IN_TURNAMENT_LOBBY
		case _:
			return PlayerStatus.IN_LOBBY

class MatchMakingConsumer(AsyncJsonWebsocketConsumer):

	matchmaking_group = 'main_group'
	matchmaking_lock = asyncio.Lock()
	# list all the players online to handle invitations
	# list all available lobbies to send to front
	lobbies: Dict[str, Lobby] = {}


	def __init__(self, *args, **kwargs):

		self.username = None
		self._is_host = False
		self._is_valid = False
		super().__init__(*args, **kwargs)


	def _auth_client(self) -> bool:
		if "cookies" in self.scope and "auth-token" in self.scope["cookies"]:
			token = self.scope["cookies"]["auth-token"]
			try:
				data = verify_jwt(token, True)
				self.username = data['username']
			except:
				self.scope['error'] = 'token verification failed'
				self.scope['error_code'] = Errors.AUTH_ERROR
			return True
		else:
			self.scope['error'] = "auth token not provided"
			self.scope['error_code'] = Errors.AUTH_ERROR
		return False

	DISABLE_AUTH = False

	def get_status(self):
		return online_players[self.username]['status']

	async def _is_valid_client(self):
		if MatchMakingConsumer.DISABLE_AUTH:
			try:
				self.username = self.scope['url_route']['kwargs']["username"]
			except:
				self.scope['error'] = "username name not provided in kwargs"
				self.scope['error_code'] = Errors.AUTH_ERROR
				return False
			return True
		if not self._auth_client():
			return False
		async with MatchMakingConsumer.matchmaking_lock:
			if self.username in online_players and online_players[self.username]["status"] < PlayerStatus.IN_GAME:
				self.scope['error'] = "an websocket connection for is already opened"
				self.scope['error_code'] = Errors.AUTH_ERROR
				return False
		return True

	async def check_infos(self):
		if self.username in online_players:
			await self.send_json({"type": "in_game", "game_id": online_players[self.username]['lobby_id']})
		else:
			online_players[self.username] = {'status': PlayerStatus.NO_LOBBY, 'lobby_id': None, 'tournament_id': None}
			await self.channel_layer.group_add(self.username, self.channel_name)
			await self.channel_layer.group_add(MatchMakingConsumer.matchmaking_group, self.channel_name)

	async def connect(self):
		await self.accept()
		if await self._is_valid_client():
			self._is_valid = True
			async with MatchMakingConsumer.matchmaking_lock:
				await self.check_infos()
		else:
			await self._send_error(self.scope['error'], self.scope['error_code'], True)
		await self.send_general_update()

	async def disconnect(self, code):
		async with MatchMakingConsumer.matchmaking_lock:
			status = online_players[self.username]['status']
			if status == PlayerStatus.IN_LOBBY:
				if self._is_host == 1:
					await self.cancel_lobby(self._lobby_id)
				else:
					lobbies[self._lobby_id].remove_player(self.username)
				del online_players[self.username]
				await self.channel_layer.group_discard(self._lobby_id, self.channel_name)
			del online_players[self.username]
		await self.send_general_update()
		await self.channel_layer.group_discard(self.username, self.channel_name)
		await self.channel_layer.group_discard(MatchMakingConsumer.matchmaking_group, self.channel_name)


	async def receive_json(self, content, **kwargs):
		# perform some basic checks ?
		try:
			await self.dispatch(content)
		except ValueError as e:
			await self._send_error(msg="Incorrect type", code=Errors.INVALID_TYPE, close=False)


	# send methods
######################################################################

	async def _send_error(self, msg: str=None, code:int=4001, close=False):
		await self.send_json({'type': 'error', 'data': msg})
		if close:
			await self.close(code, msg)


	async def lobby_canceled(self, content):
		if online_players[self.username] not in (PlayerStatus.IN_LOBBY, PlayerStatus.IN_TURNAMENT_LOBBY):
			return
		if not self._is_host:
			await self.send_json(content)
			await self.channel_layer.group_discard(self._lobby_id, self.channel_name)
			online_players[self.username] = reset_status
			await self.channel_layer.group_add(MatchMakingConsumer.matchmaking_group, self.channel_name)


	async def join_lobby(self, content):

		target_lobby = content['lobby_id']
		if target_lobby not in lobbies or lobbies[target_lobby].started:
			self._send_error(msg='Can\'t join this lobby', code=Errors.JOIN_ERROR, close=False)
		if self.get_status() == PlayerStatus.IN_LOBBY:
			await self.switch_lobby(target_lobby)
		elif self.get_status() == PlayerStatus.IN_TURNAMENT_LOBBY:
			self._send_error(msg='Already in tournament lobby.', code=Errors.JOIN_ERROR, close=False)
		else:
			if lobbies[target_lobby].add_player(self.username):
				await self.channel_layer.group_add(target_lobby, self.channel_name)
				await self.channel_layer.group_discard(MatchMakingConsumer.matchmaking_group, self.channel_name)
				online_players[self.username]['status'] = get_status_from_lobby(target_lobby)
				online_players[self.username]['lobby_id'] = target_lobby
				await self.send_lobby_update(target_lobby)
				await self.send_general_update()
			else:
				await self._send_error(msg='Could not join the requested lobby', code=Errors.JOIN_ERROR, close=False)


	async def switch_lobby(self, target_lobby):

		actual_lobby = online_players[self.username]['lobby_id']
		if lobbies[target_lobby].add_player(self.username):
			lobbies[actual_lobby].remove_player(self.username)
			await self.channel_layer.group_discard(actual_lobby, self.channel_name)
			online_players[self.username]['lobby_id'] = target_lobby
			online_players[self.username]['status'] = get_status_from_lobby(target_lobby)
			await self.channel_layer.group_add(target_lobby, self.channel_name)
			await self.send_lobby_update(actual_lobby)
			await self.send_lobby_update(target_lobby)
			await self.send_general_update()
		else:
			self._send_error(msg="Could not switch to the requested lobby", code=Errors.JOIN_ERROR, close=False)



	async def leave_lobby(self, content=None):

		if online_players[self.username]['status'] not in (PlayerStatus.IN_LOBBY, PlayerStatus.IN_TURNAMENT_LOBBY):
			await self._send_error(msg='You are not in a lobby, leave failed', close=False)
			return
		lobby_id = online_players[self.username]['lobby_id']
		if self._is_host == 1:
			await self.cancel_lobby()
		else:
			await self.channel_layer.group_discard(lobby_id, self.channel_name)
			lobbies[lobby_id].remove_player(self.username)
			self.lobby_update(lobby_id)
			online_players[self.username] = reset_status
			await self.channel_layer.group_add(MatchMakingConsumer.matchmaking_group, self.channel_name)
			await self.send_general_update()


	async def create_lobby(self, content):
		if online_players[self.username]['status'] != PlayerStatus.NO_LOBBY:
			self._send_error(msg='You can\t host at this moment', code=Errors.HOST_ERROR, close=False)
			return
		try:
			data = content['settings']
			match data.pop('lobby_type'):
				case "simple_match":
					new_lobby = SimpleMatchLobby(data)
					game_type = PlayerStatus.IN_LOBBY
				case "local_match":
					new_lobby = LocalMatchLobby(data)
					game_type = PlayerStatus.IN_LOBBY
				case "tournament_lobby":
					new_lobby = TurnamentInitialLobby(data)
					game_type = PlayerStatus.IN_LOBBY
				case _:
					raise KeyError(f"Wrong game type")
		except KeyError as e:
			await self._send_error(msg="Wrong lobby settings", code=Errors.HOST_ERROR, close=False)
			return
		except TypeError as e:
			await self._send_error(msg="Wrong lobby settings", code=Errors.HOST_ERROR, close=False)
			return
		lobbies[new_lobby.id] = new_lobby
		online_players[self.username]['status'] = game_type
		online_players[self.username]['lobby_id'] = new_lobby.id
		await self.channel_layer.group_add(new_lobby.id, self.channel_name)
		await self.channel_layer.group_discard(MatchMakingConsumer.matchmaking_group, self.channel_name)
		await self.send_lobby_update(new_lobby.id)
		await self.send_general_update()

	async def be_invited(self, content):
		pass

# extract from content the necessary info to update the frontend of a given client :
# if the client is in game or tournament => send him back to its ongoing activity => to be refined for the tournament
# if the client is in a not started lobby => send him infos abouts his lobby
# if the client is browsing the lobbies => send him all the joinable/watchable lobbies
	async def general_update(self, data):
		if online_players[self.username]['status'] != PlayerStatus.NO_LOBBY:
			return
		state = {}
		state["type"] = "general_update"
		state["availableLobbies"] = data["games_to_join"]
		state["ongoingMatches"] = data["ongoing_games"]
		# state["tournament_to_join"] = data["tournaments_to_join"]
		await self.send_json(state)

	async def lobby_update(self,content):
		if self.get_status not in (1,3):
			return
		await self.send_json(content)


	async def player_ready(self, content):
		if self.get_status() not in (PlayerStatus.IN_LOBBY, PlayerStatus.IN_TURNAMENT_LOBBY):
			await self._send_error(msg="You are not in a lobby, ready up failed",code=4005, close=False)
			return
		if lobbies[self._lobby_id].player_ready(self.username):
			self.dispatch_players(self._lobby_id, True)
			self.send_general_update()
		else:
			self.dispatch_players(self._lobby_id, False)

##########################################################################3

	#hosting lobby related func
	#####################################################
	async def cancel_lobby(self, lobby_id):
		await self.channel_layer.group_discard(self._lobby_id, self.channel_name)
		await self.channel_layer.group_send(lobby_id, {'type': 'lobby_canceled'})
		online_players[self.username] = reset_status
		self._is_host = 0
		if lobby_id in lobbies:
			del lobbies[lobby_id]
		await self.send_general_update()

	async def send_general_update(self):
		data = await self.generate_update_data()
		await self.channel_layer.group_send(MatchMakingConsumer.matchmaking_group, data)

	async def send_lobby_update(self, lobby_id):
		if lobby_id not in lobbies:
			return
		data = jsonize_lobby(lobbies[lobby_id])
		data['type'] = 'lobby_update'
		await self.channel_layer.group_send(lobby_id, data)


	####################################################3


# """
# lobby type : first letter =>	Simplr => S
# 	 							TurnamentInit => I
# 								TournamentLobby T
# 								LocalLobby => L

# visibility type : second letter =>	Open -> O
# 									Confidential -> C

# """
	async def generate_update_data(self):
		data = {"type": "general_update", "games_to_join" : [{}], "ongoing_games": [{}], "tournaments_to_join": [{}], "ongoing_tournaments": [{}], "private": [{}]}
		async with MatchMakingConsumer.matchmaking_lock:
			lobbies_copy = lobbies
		data['games_to_join'] = [{lobby_id: jsonize_lobby(lobbies_copy[lobby_id])} for lobby_id in lobbies_copy if (lobby_id[1] == 'O' and not lobbies_copy[lobby_id].started)]
		data['ongoing_games'] = [{lobby_id: jsonize_lobby(lobbies_copy[lobby_id])} for lobby_id in lobbies_copy if (lobby_id[2] == 'A' and lobby_id[0] in ('S', 'T')  and lobbies_copy[lobby_id].started)]
		# data["private"] = [{lobby_id, jsonize_lobby(lobbies_copy[lobby_id])} for lobby_id in lobbies_copy if (lobby_id[1] == 'C')]
		return data



"""
actions from the front:
-> join a lobby => should trigger a general update
-> create a lobby -> different types => should trigger a general update
-> leave a lobby => should trigger a GU
-> invite someone => goes throught private channel layer
-> accept/refuse and invite => should trigger a join lobby or ? => should trigger a join lobby if accepted
-> concede defeat on an ongoing game/tournament => trigger an early update of the game => change status of players in the game
-> leave matchmaking => disconnect several effects depending on the status
-> add a bot in a lobby => need to be in a lobby and the host of the lobby => GU
-> remove a bot in a lobby => same as above => GU
-> launch a game / tournament => GU if public ?




 """


"""
when player_rdy => true get all players in the lobby and send them their match websocket
"""
