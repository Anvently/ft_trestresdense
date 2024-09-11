import json
import time
import asyncio
from django.conf import settings
from channels.generic.websocket import AsyncJsonWebsocketConsumer
import jwt
from typing import List, Dict

def verify_jwt(token, is_ttl_based=False, ttl_key="exp"):
	data = jwt.decode(token, settings.RSA_PUBLIC_KEY, algorithms=["RS512"])
	if is_ttl_based:
		if data[ttl_key] < time.time():
			raise ValueError("Token expired")
	return data

def is_in_game(username):
	# check wether the client is already in a game/tournament
	pass


class Lobby():
	def __init__(self, hostname, player_num, lifes, ) -> None:


class MatchMakingConsumer(AsyncJsonWebsocketConsumer):

	matchmaking_group = 'main_group'
	matchmaking_lock = asyncio.Lock()
	# list all the players online to handle invitations
	online_players : List[str] = []
	# list all available lobbies to send to front
	public_lobbies: List[Lobby] = []
	private_lobbies: List[Lobby] = []
	# list all games being played to handle results
	active_games: List[Lobby] = []
	active_tournament : List




	def __init(self, *args, **kwargs):
		self.username = None
		self._is_in_lobby = False
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
			self.scope['error'] = 'User is already in a game'
			self.scope['error_code'] = 4005
			return (False)



	async def connect(self):
		await self.accept()
		if self.is_valid_client():
			self._is_valid = True
			await self.channel_layer.group_add(MatchMakingConsumer.matchmaking_group, self.channel_name)
			async with MatchMakingConsumer.matchmaking_lock:
				MatchMakingConsumer.online_players.append(self.username)
		else:
			await self._send_error(self.scope['error'], self.scope['error_code'], True)


	async def _send_error(self, msg: str=None, code:int=4001, close=False):
		await self.send_json({'type': 'error', 'data': msg})
		if close:
			await self.close(code, msg)
