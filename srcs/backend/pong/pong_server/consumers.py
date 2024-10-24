import json
import time
import jwt, logging
import math
import asyncio
from django.conf import settings
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.consumer import AsyncConsumer
from pong_server.authentication import verify_jwt
from pong_server.pong2d import PongLobby2D
from pong_server.pong3d import PongLobby3D
from pong_server.game import PongLobby
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from typing import Dict, Any, List

def verify_jwt(token, is_ttl_based=False, ttl_key="exp"):
	data = jwt.decode(token, settings.RSA_PUBLIC_KEY, algorithms=["RS512"])
	if is_ttl_based:
		if data[ttl_key] < time.time():
			raise ValueError("Token expired")
	return data

# {
# 	"npirard: up",
# 	"npirard_guest: down"
# }
# {
# 	"npirard" : "ready",
# 	"npirard_guest": "ready"
# }


"""

join_game => send lobby_infos
lobby_infos {
	players: [
		{username, display_name}, ...
	]
}

key_input => update pos from pongLobby

game_state {
	players: [{pos, nbr_life, status}, {...}, ...]
	ball: {pos}
}

Check when last consumer disconnect

"""

def check_lobby_id(id:str) -> bool:
		if id in lobbies_list:
			return True
		return False

class PongConsumer(AsyncJsonWebsocketConsumer):

	def __init__(self, *args, **kwargs):
		self.username = None
		self.lobby_id = None
		self.users = set()
		self.is_spectator = True
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
				return False
		# else: # Uncomment this block to forbid anonymous users to access game
		# 	self.scope['error'] = "auth token not provided"
		# 	self.scope['error_code'] = 4001
		# 	return False
		return True

	def	_is_valid_client(self) -> bool:
		self.lobby_id = self.scope['url_route']['kwargs']["lobby_id"]
		if check_lobby_id(self.lobby_id) == False:
			self.scope['error'] = "invalid lobby"
			self.scope['error_code'] = 4003
			return False
		if not self._auth_client():
			return False
		if self.username and lobbies_list[self.lobby_id].check_user_authentication(self.username):
			self.is_spectator = False
		elif self.DISABLE_AUTH:
			pass
		elif not lobbies_list[self.lobby_id].settings.get('allow_spectators', True):
				self.scope['error'] = "forbidden lobby"
				self.scope['error_code'] = 4004
				return False
		return True

	# ONLY FOR DEBUG, given username in sent content will be used
	DISABLE_AUTH = True

	async def connect(self):
		await self.accept()
		if self._is_valid_client():
			await self.channel_layer.group_add(self.lobby_id, self.channel_name)
		else:
			await self._send_error(self.scope['error'], self.scope['error_code'], True)
			print("Connection rejected because: {0}".format(self.scope['error']))
			return

		player_list = [player.player_id for player in lobbies_list[self.lobby_id].players]
		await self.send_json({'type':'ping', 'player_list': player_list})

	async def disconnect(self, close_code):
		if not self.is_spectator:
			for user in self.users:
				lobbies_list[self.lobby_id].player_leave(user)
			await self.channel_layer.group_send(
				self.lobby_id, {
					"type": "info_message",
					"data": "{users} left the game.".format(users=",".join(self.users))
				})
			print(f"user {self.username} disconnected")
			await self.channel_layer.group_discard(self.lobby_id, self.channel_name)

	async def receive_json(self, content, **kwargs):
		# if not "username" in content:
		# 	await self._send_error('Missing username')
		# 	return
		try:
			await self.dispatch(content)
		except ValueError as e:
			await self.send_json({'type':'error', 'data':f'Invalid type: {e}'})

	async def _send_error(self, msg: str = None, code: int = 4001, close = False):
		await self.send_json({'type':'error', 'data':msg})
		if close:
			await self.close(code, msg)

	async def join_game(self, content):
		if self.is_spectator:
			return
		if not PongConsumer.DISABLE_AUTH and content['username'].split('.')[0] != self.username:
			await self._send_error('You are not who you pretend to be')
			return
		if not lobbies_list[self.lobby_id].player_join(content['username']):
			await self._send_error('Could not join the lobby.')
			return
		self.users.add(content['username'])
		await self.channel_layer.group_send(
			self.lobby_id, {"type": "info_message",
				"data": "{user} joined the game.".format(user=content['username'])}
		)

	async def key_input(self, content):
		if content['username'] not in self.users:
			await self._send_error('Invalid username')
			return
		lobbies_list[self.lobby_id].player_input(content['username'], content['input'])

	async def cancel(self, content):
		await self.send_json(content)
		await self.close(4000, "game cancelled")

	async def game_start(self, content):
		await self.send_json(content)

	async def game_finish(self, content):
		await self.send_json(content)

	async def leave_lobby(self, content):
		await self.send_json(content)
		await self.close(4000, "game finished")

	async def send_game_state(self, content):
		await self.send_json(content)

	async def info_message(self, content):
		await self.send_json(content)

lobbies_list : Dict[str, PongLobby] = dict()



# from daphne.server import twisted_loop



# lobbies_list["11"] = PongLobby3D(
# 	lobby_id="11",
# 	# players_list=["P1", "P2"],
# 	# players_list=["!AI1", "!AI2"],
# 	players_list=["!AI0", "!AI1"],
# 	tournId=None,settings={'lives':11, 'nbr_players':2, 'allow_spectators':True},
# )


# for lobby_id in lobbies_list:
# 	if lobbies_list[lobby_id].check_game_start():
# 		print(f"Auto-starting {lobby_id}")
# 		twisted_loop.create_task(lobbies_list[lobby_id].start_game_loop())
