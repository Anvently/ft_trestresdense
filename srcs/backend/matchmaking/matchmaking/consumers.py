import json
import time
import asyncio
from django.conf import settings
from channels.generic.websocket import AsyncJsonWebsocketConsumer
import jwt
from typing import List, Dict, Set, Tuple
import uuid
import base64

def verify_jwt(token, is_ttl_based=False, ttl_key="exp"):
	data = jwt.decode(token, settings.RSA_PUBLIC_KEY, algorithms=["RS512"])
	if is_ttl_based:
		if data[ttl_key] < time.time():
			raise ValueError("Token expired")
	return data

def generate_id(public: bool):
	u = uuid.uuid4()
	short_u = base64.urlsafe_b64encode(u.bytes).rstrip(b'=').decode('ascii')
	if public:
		short_u = 'O' + short_u
	else:
		short_u = 'C' + short_u
	if short_u not in MatchMakingConsumer.public_lobbies and short_u not in MatchMakingConsumer.private_lobbies:
		return short_u
	else:
		return generate_id()

def is_in_game(username):
	# check wether the client is already in a game/tournament
	# maybe allow client to connect but limit its actions ?
	if username in MatchMakingConsumer.in_game_players:
		return True
	else:
		return False


class Lobby():
	def __init__(self, hostname, name, player_num=2, lifes=3, public=True ) -> None:
		self.hostname = hostname
		self.player_num = player_num
		self.lifes = lifes
		self.lobby_name = name
		self.id = generate_id()
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


# QUESTION: est ce que on lance une boucle qui envoie une mise a jour du matchmking toutes les x secondes ou
# chaque action d'un client est transmise a tous pour adapter le front en temps reel
# cas 1 => moins de messages, il faut mettre en place une boucle
# cas 2 => bcp de messages, bcp de fonctions, plus simple

""" 
Status:
	- waiting for a lobby
	- in lobby => turnament or not
	- in game
 """

class MatchMakingConsumer(AsyncJsonWebsocketConsumer):

	matchmaking_group = 'main_group'
	matchmaking_lock = asyncio.Lock()
	# list all the players online to handle invitations
	online_players : dict[str, Tuple[int, str, str]] = {}
	in_game_players : set[str] = set()
	# list all available lobbies to send to front
	lobbies: dict[str, Lobby] = {}
	




	def __init(self, *args, **kwargs):

		self.username = None
		self._is_in_lobby = False
		self._is_host = False
		self._lobby_id = None
		self._is_valid = False
		self._is_in_game = False
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

	def _is_valid_client(self):
		if MatchMakingConsumer.DISABLE_AUTH:
			return True
		if not self._auth_client():
			return False
		# if _is_already_connected(): => Does it make sense ?
			# return False
		if is_in_game(self.username):
			self._is_in_game = True
			return (False)



	async def connect(self):
		await self.accept()
		if self.is_valid_client():
			self._is_valid = True
			await self.channel_layer.group_add(MatchMakingConsumer.matchmaking_group, self.channel_name)
			async with MatchMakingConsumer.matchmaking_lock:
				if self.username in MatchMakingConsumer.online_players:
					MatchMakingConsumer.online_players[self.username] += 1
				else:
					MatchMakingConsumer.online_players[self.username] = 1
		else:
			await self._send_error(self.scope['error'], self.scope['error_code'], True)

	async def disconnect(self, code):
		async with MatchMakingConsumer.matchmaking_lock:
			if self.username in MatchMakingConsumer.online_players:
				MatchMakingConsumer.online_players[self.username] -= 1
				if MatchMakingConsumer.online_players[self.username] >= 1:
					return
				else:
					del MatchMakingConsumer.online_players[self.username]
			if self._is_in_lobby:
				if self._is_host == 1:
					await self.lobby_cancel(self._lobby_id)
				else:
					MatchMakingConsumer.lobbies[self._lobby_id].remove_player(self.username)
				await self.channel_layer.group_discard(self._lobby_id, self.channel_name)
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
		if not self._is_in_lobby:
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





##########################################################################3

	#hosting lobby related func
	#####################################################
	async def lobby_cancel(self, lobby_id):
		await self.channel_layer.group_send(lobby_id, {'type': 'lobby_canceled'})
		if lobby_id in MatchMakingConsumer.lobbies:
			del MatchMakingConsumer.lobbies[lobby_id]

	####################################################3
