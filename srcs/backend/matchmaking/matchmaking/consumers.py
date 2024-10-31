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
from matchmaking.lobby import Lobby, LocalMatchLobby, SimpleMatchLobby, TournamentInitialLobby, LocalTournamentInitialLobby
import copy
from asgiref.sync import sync_to_async
import requests


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


def jsonize_player(player_dict):
	player_data = {}
	player_data['status'] = player_dict['status']
	player_data['lobby_id'] = player_dict['lobby_id']
	player_data['tournament_id'] = player_dict['tournament_id']
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
			'tournament_id': str
		}
	}
 """


"""
{2, 125.0, 125} -> {3, 125.1 , 125}
"""

default_status = {'status' : PlayerStatus.NO_LOBBY, 'lobby_id' : None, 'tournament_id': None}

class Errors(Enum):
	INVALID_TYPE = 4001
	USERNAME_MISSING = 4002
	AUTH_ERROR = 4003
	JOIN_ERROR = 4004
	HOST_ERROR = 4005
	LEAVE_ERROR = 4006
	INVITE_ERROR = 4007

def get_status_from_lobby(lobby_id):
	match lobby_id[0]:
		case 'T':
			return PlayerStatus.IN_TOURNAMENT_LOBBY
		case 'U':
			return PlayerStatus.IN_LOCAL_TOURNAMENT_LOBBY
		case _:
			return PlayerStatus.IN_LOBBY

def	get_player_status(player_id):
	if player_id not in online_players:
		return None
	return online_players[player_id]['status']

class MatchMakingConsumer(AsyncJsonWebsocketConsumer):

	matchmaking_group = 'main_group'
	matchmaking_lock = asyncio.Lock()
	# list all the players online to handle invitations
	# list all available lobbies to send to front


	@staticmethod
	async def static_general_update():
		channel_layer = get_channel_layer()
		data = await MatchMakingConsumer.generate_update_data(None)
		await channel_layer.group_send(MatchMakingConsumer.matchmaking_group, data)

	@staticmethod
	async def static_lobby_update(id):
		channel_layer = get_channel_layer()
		if id not in lobbies:
			return
		data = lobbies[id].jsonize()
		data['type'] = 'lobby_update'
		await channel_layer.group_send(id, data)

	def __init__(self, *args, **kwargs):

		self.username = None
		self._is_host = False
		self._is_valid = False
		self._lobby_id = None
		self._messageId = None
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
				return False
			return True
		else:
			self.scope['error'] = "auth token not provided"
			self.scope['error_code'] = Errors.AUTH_ERROR
		return False

	DISABLE_AUTH = False

	def get_status(self):
		return copy.copy(online_players[self.username]['status'])

	def get_lobby_id(self):
		return copy.copy(online_players[self.username]['lobby_id'])

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
			if self.username in online_players and online_players[self.username]["status"] not in (PlayerStatus.IN_GAME, PlayerStatus.IN_TOURNAMENT_LOBBY, PlayerStatus.IN_LOCAL_TOURNAMENT_LOBBY):
				self.scope['error'] = "an websocket connection for is already opened"
				self.scope['error_code'] = Errors.AUTH_ERROR
				return False
		return True

	async def check_infos(self):
		if self.username in online_players:
			if online_players[self.username]["status"] == PlayerStatus.IN_GAME:
				self._lobby_id = online_players[self.username]['lobby_id']
				await self.send_json({"type": "in_game", "lobby_id": self._lobby_id, 'game_type' : lobbies[self._lobby_id].game_type})
			if online_players[self.username]["status"] == PlayerStatus.IN_TOURNAMENT_LOBBY:
				self._lobby_id = online_players[self.username]['lobby_id']
				await self.send_json({"type": "in_tournament_lobby", "lobby_id": self._lobby_id})
			if self.get_status() == PlayerStatus.IN_LOCAL_TOURNAMENT_LOBBY:
				self._lobby_id = self.get_lobby_id()
				await self.send_json({"type" : "lobby_joined", "lobby_id" : self._lobby_id, 'is_host': True})
				await self.send_lobby_update(self._lobby_id)
		else:
			online_players[self.username] = copy.deepcopy(default_status)
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
			return
		print(online_players)
		await self.send_general_update()

	async def disconnect(self, code):
		if not self._is_valid:
			return
		async with MatchMakingConsumer.matchmaking_lock:
			if self.username in online_players:
				status = online_players[self.username]['status']
				if status == PlayerStatus.IN_LOBBY:
					if self._is_host == True:
						await self.cancel_lobby()
					else:
						lobbies[self._lobby_id].remove_player(self.username)
						await self.channel_layer.group_discard(self._lobby_id, self.channel_name)
						await self.send_lobby_update(self._lobby_id)
						self._lobby_id = None
				if status not in (PlayerStatus.IN_GAME, PlayerStatus.IN_TOURNAMENT_LOBBY, PlayerStatus.IN_LOCAL_TOURNAMENT_LOBBY):
					del online_players[self.username]
		await self.channel_layer.group_discard(self.username, self.channel_name)
		await self.channel_layer.group_discard(MatchMakingConsumer.matchmaking_group, self.channel_name)
		await self.send_general_update()

	async def send_json(self, content, close=False):
		if self._messageId != None:
			content['id'] = self._messageId
		self._messageId = None
		print(f"\n SENDING {content} \n")
		return await super().send_json(content, close)

	async def receive_json(self, content, **kwargs):
		# perform some basic checks ?
		print(f"\n RECEIVED : {content} \n")
		try:
			if 'id' in content:
				self._messageId = content['id']
			await self.dispatch(content)
		except ValueError as e:
			await self._send_error(msg="Incorrect type", code=Errors.INVALID_TYPE, close=False)


	# send methods
######################################################################

	async def _send_error(self, msg: str=None, code:Errors=Errors.INVALID_TYPE, close=False):
		response = {'type': 'error', 'data': msg}
		await self.send_json(response)
		if close:
			await self.close(code.value, msg)


	async def lobby_canceled(self, content):
		if online_players[self.username]['status'] not in (PlayerStatus.IN_LOBBY, PlayerStatus.IN_TOURNAMENT_LOBBY, PlayerStatus.IN_LOCAL_TOURNAMENT_LOBBY):
			return
		if not self._is_host:
			await self.send_json(content)
			await self.channel_layer.group_discard(self._lobby_id, self.channel_name)
			self._lobby_id = None
			online_players[self.username] = copy.deepcopy(default_status)
			await self.channel_layer.group_add(MatchMakingConsumer.matchmaking_group, self.channel_name)
			await self.send_general_update()

	async def not_show_up(self, content):
		current_stage = content['stage']
		await self.send_json(content)
		await self.channel_layer.group_discard(self._lobby_id, self.channel_name)
		online_players[self.username]['lobby_id'] = "?TBD"
		self._lobby_id = None
		if current_stage == 1:
			online_players[self.username] = copy.deepcopy(default_status)
			await self.channel_layer.group_add(MatchMakingConsumer.matchmaking_group, self.channel_name)
			await self.send_general_update()



	async def join_lobby(self, content):
		target_lobby = content['lobby_id']
		if target_lobby not in lobbies:
			await self._send_error(msg=f'Can\'t join the lobby {target_lobby}: does not exists', code=Errors.JOIN_ERROR, close=False)
		elif lobbies[target_lobby].started:
			await self._send_error(msg=f'Can\'t join the lobby {target_lobby}: already started', code=Errors.JOIN_ERROR, close=False)
		elif self.get_status() == PlayerStatus.IN_LOBBY:
			await self.switch_lobby(target_lobby)
		else:
			if lobbies[target_lobby].add_player(self.username):
				await self.channel_layer.group_add(target_lobby, self.channel_name)
				await self.channel_layer.group_discard(MatchMakingConsumer.matchmaking_group, self.channel_name)
				online_players[self.username]['status'] = get_status_from_lobby(target_lobby)
				online_players[self.username]['lobby_id'] = target_lobby
				await lobbies[target_lobby].player_joined(self.username)
				self._lobby_id = target_lobby
				await self.send_json({"type" : 'lobby_joined', 'lobby_id' : target_lobby, 'is_host' : False})
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
			self._lobby_id = target_lobby
			await self.send_lobby_update(actual_lobby)
			await self.send_lobby_update(target_lobby)
			await self.send_general_update()
		else:
			await self._send_error(msg="Could not switch to the requested lobby", code=Errors.JOIN_ERROR, close=False)

	async def add_bot(self, content):
		if self.get_status() == PlayerStatus.IN_LOBBY and self._is_host:
			lobbies[self._lobby_id].player_not_ready(self.username)
			# await self.send_json("{'type' : 'self_unready'}")
			lobbies[self._lobby_id].add_bot()
			await self.send_lobby_update(self._lobby_id)
			await self.send_general_update()

	async def spectate_game(self, content):
		target_lobby = content['lobby_id']
		if target_lobby not in lobbies or not lobbies[target_lobby].started or target_lobby[2] != 'A':
			await self._send_error(msg='This game cannot be watched', code=Errors.JOIN_ERROR, close=False)
			return
		game_type = lobbies[target_lobby].game_type
		await self.send_json({'type' : 'observe_game', 'lobby_id' : target_lobby, 'game_type' : game_type})


	async def leave_lobby(self, content=None):
		if not self._lobby_id:
			return
		if self._lobby_id[0] == 'T':
			await self.leave_tournament_match_lobby()
			return
		if self.get_lobby_id() == 'U':
			await self.cancel_local_tournament()
			return
		if online_players[self.username]['status'] not in (PlayerStatus.IN_LOBBY, PlayerStatus.IN_TOURNAMENT_LOBBY, PlayerStatus.IN_LOCAL_TOURNAMENT_LOBBY):
			await self._send_error(msg="You are not in a lobby, can't do !", close=False)
			return
		if self._is_host == True:
			await self.cancel_lobby()
			await self.send_general_update()
		else:
			await self.channel_layer.group_discard(self._lobby_id, self.channel_name)
			lobbies[self._lobby_id].remove_player(self.username)
			oldId = self._lobby_id
			self._lobby_id = None
			online_players[self.username] = copy.deepcopy(default_status)
			await self.send_lobby_update(oldId)
			await self.channel_layer.group_add(MatchMakingConsumer.matchmaking_group, self.channel_name)
			await self.send_general_update()

	async def leave_tournament_match_lobby(self):
		# should declare winner the player still in the lobby
		await self.channel_layer.group_discard(self._lobby_id, self.channel_name)
		lobbies[self._lobby_id].remove_player(self.username)
		online_players[self.username] = copy.deepcopy(default_status)
		await self.channel_layer.group_add(MatchMakingConsumer.matchmaking_group, self.channel_name)
		await lobbies[self._lobby_id].handle_default_results(self.username)
		self._lobby_id = None
		self._is_host = False
		await self.send_general_update()

	async def leave_local_tournament(self):
		id = self.get_lobby_id()
		await self.channel_layer.group_discard(id, self.channel_name)
		online_players[self.username] = copy.deepcopy(default_status)
		await self.channel_layer.group_add(MatchMakingConsumer.matchmaking_group, self.channel_name)
		self._lobby_id = None
		self._is_host = False
		del lobbies[self.get_lobby_id()]
		await self.send_general_update()



	async def create_lobby(self, data):
		if online_players[self.username]['status'] != PlayerStatus.NO_LOBBY:
			await self._send_error(msg='You can\t host at this moment', code=Errors.HOST_ERROR, close=False)
			return
		data.pop('type')
		data['hostname'] = self.username
		try:
			match data.pop('lobby_type'):
				case "simple_match":
					new_lobby = SimpleMatchLobby(data)
					game_type = PlayerStatus.IN_LOBBY
				case "local_match":
					new_lobby = LocalMatchLobby(data)
					game_type = PlayerStatus.IN_LOBBY
				case "tournament_lobby":
					new_lobby = TournamentInitialLobby(data)
					game_type = PlayerStatus.IN_LOBBY
				case "local_tournament_lobby":
					new_lobby = LocalTournamentInitialLobby(data)
					game_type = PlayerStatus.IN_LOBBY
				case _:
					raise KeyError("Wrong game type")

		except KeyError as e:
			await self._send_error(msg=f"Wrong lobby settings: {e}", code=Errors.HOST_ERROR, close=False)
			return
		except TypeError as e:
			await self._send_error(msg=f"Wrong lobby settings: {e}", code=Errors.HOST_ERROR, close=False)
			return
		lobbies[new_lobby.id] = new_lobby
		online_players[self.username]['status'] = game_type
		online_players[self.username]['lobby_id'] = new_lobby.id
		self._lobby_id = new_lobby.id
		self._is_host = True
		await lobbies[new_lobby.id].player_joined(self.username)
		# await self.send_json({'type': 'success', 'lobby_id': self._lobby_id})
		await self.send_json({"type" : 'lobby_joined', 'lobby_id' : new_lobby.id, 'is_host': True})
		await self.channel_layer.group_add(new_lobby.id, self.channel_name)
		await self.channel_layer.group_discard(MatchMakingConsumer.matchmaking_group, self.channel_name)
		await self.send_lobby_update(new_lobby.id)
		await self.send_general_update()


# extract from content the necessary info to update the frontend of a given client :
# if the client is in game or tournament => send him back to its ongoing activity => to be refined for the tournament
# if the client is in a not started lobby => send him infos abouts his lobby
# if the client is browsing the lobbies => send him all the joinable/watchable lobbies
	async def general_update(self, data):
		if self.get_status() != PlayerStatus.NO_LOBBY:
			return
		state = {}
		state["type"] = "general_update"
		state["availableLobbies"] = data["games_to_join"]
		state["ongoingMatches"] = data["ongoing_games"]
		# state["tournament_to_join"] = data["tournaments_to_join"]
		await self.send_json(state)

	async def lobby_update(self,content):
		if self.get_status() not in (PlayerStatus.IN_LOBBY, PlayerStatus.IN_TOURNAMENT_LOBBY, PlayerStatus.IN_LOCAL_TOURNAMENT_LOBBY):
			return
		await self.send_json(content)


	async def player_ready(self, content):
		""" If true, check that lobby id in dict is not the same than before. If so then
		 update lobby id from dict and send lobby update """
		if self.get_status() not in (PlayerStatus.IN_LOBBY, PlayerStatus.IN_TOURNAMENT_LOBBY):
			await self._send_error(msg="You are not in a lobby, ready up failed",code=4005, close=False)
			return
		if self.get_lobby_id()[0] == 'J':
			await self.local_player_ready()
			return
		if lobbies[online_players[self.username]['lobby_id']].player_ready(self.username):
			id = copy.copy(online_players[self.username]['lobby_id'])
			if id != self._lobby_id:
				await self.channel_layer.group_send(self._lobby_id, {"type": "switch_to_first_match"})
			else:
				await self.dispatch_players(self._lobby_id)
		else:
			await self.send_lobby_update(self._lobby_id)

	async def local_player_ready(self):
		await lobbies[self.get_lobby_id()].player_ready(self.username)



	async def concede_game(self, content):
		online_players[self.username] = copy.deepcopy(default_status)
		if self._lobby_id[0] in ('L', 'U'):
			url = 'http://pong:8002/delete-lobby/' + self._lobby_id
			response = await sync_to_async(requests.delete)(url, headers = {
								'Host': 'localhost',
								'Content-type': 'application/json',
								'Authorization': "Bearer {0}".format(settings.API_TOKEN.decode('ASCII'))
								})
		else:
			url = 'http://pong:8002/player-concede/' + self._lobby_id + '/' + self.username
			response = await sync_to_async(requests.post)(url,
													headers = {
								'Host': 'localhost',
								'Content-type': 'application/json',
								'Authorization': "Bearer {0}".format(settings.API_TOKEN.decode('ASCII'))
								})
		if self._lobby_id[0] == 'U':
			del (lobbies[self._lobby_id])
		self._lobby_id = None
		await self.channel_layer.group_add(MatchMakingConsumer.matchmaking_group, self.channel_name)
		await self.channel_layer.group_add(self.username, self.channel_name)
		await self.send_general_update()

	async def switch_to_first_match(self, content):
		await self.channel_layer.group_discard(self._lobby_id, self.channel_name)
		self._lobby_id = online_players[self.username]['lobby_id']
		await self.channel_layer.group_add(self._lobby_id, self.channel_name)
		await lobbies[self._lobby_id].player_joined(self.username)
		await self.send_json({'type': 'set_unready'})
		await self.send_json({"type" : 'lobby_joined', 'lobby_id' : self._lobby_id, 'is_host' : False})
		await self.send_lobby_update(self._lobby_id)
		await self.send_general_update()

	async def switch_to_local_tournament_lobby(self, content):
		await self.channel_layer.group_discard(self._lobby_id, self.channel_name)
		new_lobby = content['new_id']
		print(f"new lobby is {new_lobby}")
		online_players[self.username]['lobby_id'] = new_lobby
		self._lobby_id = new_lobby
		online_players[self.username]['tournament_id'] = new_lobby
		online_players[self.username]['status'] = PlayerStatus.IN_LOCAL_TOURNAMENT_LOBBY
		await self.channel_layer.group_add(new_lobby, self.channel_name)
		await self.send_json({'type': 'set_unready'})
		await self.send_json({"type" : 'lobby_joined', 'lobby_id' : self._lobby_id, 'is_host' : True})
		await self.send_lobby_update(self.get_lobby_id())












	async def player_unready(self, content):
		if self.get_status() not in (PlayerStatus.IN_LOBBY, PlayerStatus.IN_TOURNAMENT_LOBBY):
			return
		lobbies[self._lobby_id].player_not_ready(self.username)
		await self.send_lobby_update(self._lobby_id)

	async def dispatch_players(self, lobby_id):

		await self.send_general_update()
		await self.channel_layer.group_send(lobby_id, {'type' : 'game_start', 'websocket_id' : lobby_id, 'game_type' : lobbies[lobby_id].game_type})

	async def game_start(self, content):

		await self.channel_layer.group_discard(self._lobby_id, self.channel_name)
		await self.channel_layer.group_discard(self.username, self.channel_name)
		await self.send_json(content)
##########################################################################3

	#hosting lobby related func
	#####################################################
	async def cancel_lobby(self):
		await self.channel_layer.group_discard(self._lobby_id, self.channel_name)
		await self.channel_layer.group_send(self._lobby_id, {'type': 'lobby_canceled'})
		#!!!!!!May want to unassign every player ??!!!!!
		online_players[self.username] = copy.deepcopy(default_status)
		if self._lobby_id in lobbies:
			lobbies[self._lobby_id].remove_all()
		self._lobby_id = None
		self._is_host = False

	async def send_general_update(self):
		data = await self.generate_update_data()
		await self.channel_layer.group_send(MatchMakingConsumer.matchmaking_group, data)

	async def send_lobby_update(self, lobby_id):
		if lobby_id not in lobbies:
			return
		data = lobbies[lobby_id].jsonize()
		data['type'] = 'lobby_update'
		await self.channel_layer.group_send(lobby_id, data)

	# async def tournament_match_init(self, lobby_id):
	# 	print(f"lobby_id target is {lobby_id}")
	# 	if lobby_id not in lobbies:
	# 		return
	# 	data = jsonize_lobby(lobbies[lobby_id])
	# 	data['type'] = 'tournament_match_init'
	# 	await self.send_json(data)


	async def get_online_players(self, content):
		data = await self.generate_player_list()
		await self.send_json(data)

	async def get_invite_list(self, content):
		data = await self.generate_invite_list()
		await self.send_json(data)

	async def kick_player(self, content):

		if (self.get_status() != PlayerStatus.IN_LOBBY or not self._is_host):
			return
		player_target = content['player_target']
		lobbies[self._lobby_id].remove_player(player_target)
		if not player_target[0] == "!":
			await self.channel_layer.group_send(player_target, {"type" : "be_kicked"})
		await self.send_lobby_update(self._lobby_id)
		await self.send_general_update()

	async def be_kicked(self, content):

		self._lobby_id = None
		online_players[self.username] = copy.deepcopy(default_status)
		await self.send_json(content)
		await self.send_general_update()


	async def add_local_player(self, content):
		if self.get_status() != PlayerStatus.IN_LOBBY or self._lobby_id[0] not in ('L', 'J'):
			return
		lobbies[self._lobby_id].player_not_ready(self.username)
		player_id = self.username + '.' + content['nickname']
		print(f"trying to add {player_id} to localLobby")
		if not lobbies[self._lobby_id].add_local_player(player_id):
			await self._send_error("Could not add a player to lobby")
		await self.send_lobby_update(self._lobby_id)
		await self.send_general_update()


	async def invite_player(self, content):

		player_target = content['invite_id']
		if self.get_status() != PlayerStatus.IN_LOBBY:
			await self._send_error(msg='You are not in position to invite someone', code=Errors.INVITE_ERROR, close=False)
			return
		if get_player_status(player_target) in (None, PlayerStatus.IN_GAME, PlayerStatus.IN_TOURNAMENT_LOBBY, PlayerStatus.IN_LOCAL_TOURNAMENT_LOBBY):
			await self._send_error(msg='This player is not available at the moment', code=Errors.INVITE_ERROR, close=False)
			return
		await self.channel_layer.group_send(player_target, {'type' : 'be_invited', 'invite_from' : self.username,'lobby_id' : self._lobby_id})


	# in case of acceptation this should trigger a join lobby event
	async def be_invited(self, content):

		if self.get_status() not in (PlayerStatus.IN_LOBBY, PlayerStatus.NO_LOBBY):
			return
		await self.send_json(content)

	####################################################3
	#			LOCAL TOURNAMENT ACTION
	#####################################################

	async def start_game(self, content):
		if not 'lobby_id' in content:
			await self._send_error(msg='Invalid message format', code=Errors.INVALID_TYPE, close=False)
		elif not self._lobby_id or str(lobbies[self._lobby_id]) != "local_tournament_lobby":
			await self._send_error(msg='Your are not in a local tournament lobby', code=Errors.INVALID_TYPE, close=False)
		elif await lobbies[self._lobby_id].start_game(content['lobby_id']):
			await self.game_start({'type': 'game_start', 'websocket_id' : content['lobby_id'], 'game_type': lobbies[self._lobby_id].tournament.game_type})
		else:
			await self._send_error(msg='Failed to start game from the backend side', code=Errors.HOST_ERROR, close=False)


	########################################################

	async def ready_up(self, content):
		current_lobby = self._lobby_id
		await self.send_json({'type' : 'ready_up'})
		async def delayed_ready():
			await asyncio.sleep(15)
			if self._lobby_id is not None and self._lobby_id == current_lobby and current_lobby in lobbies:
				if not lobbies[current_lobby].started:
					await self.player_ready(None)
			else:
				print("player left during the window")

		asyncio.create_task(delayed_ready())
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
			lobbies_copy = copy.deepcopy(lobbies)
		data['games_to_join'] = [{lobby_id: lobbies_copy[lobby_id].jsonize()} for lobby_id in lobbies_copy if (lobby_id[1] == 'O' and not lobbies_copy[lobby_id].started)]
		data['ongoing_games'] = [{lobby_id: lobbies_copy[lobby_id].jsonize()} for lobby_id in lobbies_copy if (lobby_id[2] == 'A' and lobby_id[0] in ('S', 'T')  and lobbies_copy[lobby_id].started)]
		# data["private"] = [{lobby_id, jsonize_lobby(lobbies_copy[lobby_id])} for lobby_id in lobbies_copy if (lobby_id[1] == 'C')]
		return data

	async def generate_player_list(self):
		data = {'type' : 'player_list'}
		data['players'] = {}
		async with MatchMakingConsumer.matchmaking_lock:
			players_copy = copy.deepcopy(online_players)
		for player_id in players_copy:
			if players_copy[player_id]['status'] == PlayerStatus.NO_LOBBY:
				data['players'][player_id] = {'status': 'online', 'lobby_id' : None}
			elif players_copy[player_id]['status'] == PlayerStatus.IN_LOBBY and players_copy[player_id]['lobby_id'][1] == 'O':
				data['players'][player_id] = {'status' : 'in_lobby', 'lobby_id' : players_copy[player_id]['lobby_id']}
			elif players_copy[player_id]['status'] == PlayerStatus.IN_GAME and players_copy[player_id]['lobby_id'][2] == 'A':
				data['players'][player_id] = {'status' : 'in_game', 'lobby_id' :  players_copy[player_id]['lobby_id']}
		return data

	async def generate_invite_list(self):
		data = {'type': 'invite_list', 'players' : []}
		player_list = copy.deepcopy(online_players)
		data['players'] = [player_id for player_id in player_list if player_list[player_id]['status'] in (PlayerStatus.NO_LOBBY, PlayerStatus.IN_LOBBY) and player_id != self.username and player_list[player_id]['lobby_id'] != self._lobby_id]
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
