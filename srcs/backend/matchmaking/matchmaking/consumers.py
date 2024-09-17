import json
import time
import asyncio
from django.conf import settings
from channels.generic.websocket import AsyncJsonWebsocketConsumer
import jwt
from typing import List, Dict, Set, Tuple, Any
import uuid
import base64
from matchmaking.lobby import Lobby
import enum
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



async def jsonize_lobby(lobby : Lobby):
	lobby_data = {}
	lobby_data['game_type'] = lobby.game_type
	if not lobby.started:
		lobby_data['name'] = lobby.lobby_name
		lobby_data['host'] = lobby.hostname
		lobby_data['slots'] = f"{len(lobby.players)}/{lobby.player_num}"

async def jsonize_player(player_id):
	player_data = {}
	if player_id in MatchMakingConsumer.in_game_players:
		if MatchMakingConsumer.in_game_players[player_id]["lobby_id"][0] == 'C':
			return None


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

online_players : Dict[str, Dict[str, Any]] = {}

class PlayerStatus(enum):
	NO_LOBBY = 0
	IN_LOBBY = 1
	IN_GAME = 2
	IN_TURNAMENT_LOBBY = 3

class MatchMakingConsumer(AsyncJsonWebsocketConsumer):

	matchmaking_group = 'main_group'
	matchmaking_lock = asyncio.Lock()
	# list all the players online to handle invitations
	# list all available lobbies to send to front
	

	def __init(self, *args, **kwargs):

		self.username = None
		self._is_host = False
		self._lobby_id = None
		self._tournament_id = None
		self._is_valid = False
		self.status = 0
		super().__init__(*args, **kwargs)


	def _auth_client(self) -> bool:
		if "cookies" in self.scope and "auth-token" in self.scope["cookies"]:
			token = self.scope["cookies"]["auth-token"]
			try:
				data = verify_jwt(token, True)
				self.username = data['username']
			except:
				self.scope['error'] = 'token verification failed'
				self.scope['error_code'] = 4002
			return True
		else:
			self.scope['error'] = "auth token not provided"
			self.scope['error_code'] = 4001
		return False

	async def _is_valid_client(self):
		if MatchMakingConsumer.DISABLE_AUTH:
			return True
		if not self._auth_client():
			return False
		async with MatchMakingConsumer.matchmaking_lock:
			if self.username in online_players and online_players[self.username]["status"] < 2:
				return False
		return True

	def check_infos(self):
		if self.username in online_players:
			self.status = online_players[self.username]['status']
			self._lobby_id = self.status = online_players[self.username]['lobby_id']
			self._tournament_id = self.status = online_players[self.username]['tournament_id']
		else:
			online_players[self.username] = {'status': 0, 'lobby_id': None, 'tournament_id': None}


	async def connect(self):
		await self.accept()
		if await self.is_valid_client():
			self._is_valid = True
			await self.channel_layer.group_add(MatchMakingConsumer.matchmaking_group, self.channel_name)
			async with MatchMakingConsumer.matchmaking_lock:
				self.check_infos()
		else:
			await self._send_error(self.scope['error'], self.scope['error_code'], True)

	async def disconnect(self, code):
		async with MatchMakingConsumer.matchmaking_lock:
			if self.status == 0:
				del online_players[self.username]
			elif self.status == 1:
				if self._is_host == 1:
					await self.lobby_cancel(self._lobby_id)
				else:
					MatchMakingConsumer.lobbies[self._lobby_id].remove_player(self.username)
				await self.channel_layer.group_discard(self._lobby_id, self.channel_name)
		await self.channel_layer.group_send(MatchMakingConsumer.matchmaking_group, {"type": "player_disconnected", "player_id": self.username})
		await self.channel_layer.group_discard(MatchMakingConsumer.matchmaking_group, self.channel_name)


	async def receive_json(self, content, **kwargs):
		# perform some basic checks ?
		try:
			await self.dispatch(content)
		except ValueError as e:
			await self.send_json({'type': 'error', 'data':f'Invalid type: {e}'})






	# send methods
######################################################################

	async def _send_error(self, msg: str=None, code:int=4001, close=False):
		await self.send_json({'type': 'error', 'data': msg})
		if close:
			await self.close(code, msg)


	async def lobby_canceled(self, content):
		if self.status!= 1:
			return
		if not self._is_host:
			await self.send_json(content)
		await self.channel_layer.group_discard(self._lobby_id, self.channel_name)
		self._is_in_lobby = False
		self._is_host = False


	async def join_lobby(self, content):
		if self._is_in_lobby:
			if self._is_host:
				await self.lobby_cancel(self._lobby_id)
			else:
				await self.leave_lobby(self._lobby_id)



	async def leave_lobby(self, content):
		pass

	async def create_lobby(self, content):
		pass

	async def be_invited(self, content):
		pass


	async def front_update(self, content):
		if self.tournament_id:
			await self.send_json({"type": "in_tournament"})
			return
		if self.is_in_game:
			await self.send_json({"type": "in_game"})
			return
		await self.send_json(content)



##########################################################################3

	#hosting lobby related func
	#####################################################
	async def lobby_cancel(self, lobby_id):
		await self.channel_layer.group_send(lobby_id, {'type': 'lobby_canceled'})
		if lobby_id in MatchMakingConsumer.lobbies:
			del MatchMakingConsumer.lobbies[lobby_id]

	####################################################3



	async def generate_update(self):
		data = {"games_to_join" : {}, "games_to_obs": {}, "tournaments_to-join": {},  "online_players": {}, }
		async with MatchMakingConsumer.matchmaking_lock:
			for lobby in MatchMakingConsumer.lobbies:
				if lobby[0] == 'O' and not MatchMakingConsumer.lobbies[lobby].started:
					data["games_to_join"][lobby] = {}

