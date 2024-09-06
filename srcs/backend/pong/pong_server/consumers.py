import json
import time
import jwt
import math
import asyncio
from django.conf import settings
from channels.generic.websocket import AsyncWebsocketConsumer, AsyncJsonWebsocketConsumer
from pong_server.authentication import verify_jwt
from pong_server.game import PongLobby, lobbys_list

def verify_jwt(token, is_ttl_based=False, ttl_key="exp"):
	data = jwt.decode(token, settings.RSA_PUBLIC_KEY, algorithms=["RS512"])
	if is_ttl_based:
		if data[ttl_key] < time.time():
			raise ValueError("Token expired")
	return data




class ChatConsumer(AsyncWebsocketConsumer):
	async def connect(self):

		self.room_name = self.scope['url_route']['kwargs']["room_name"]
		self.room_group_name = "chat_%s" % self.room_name
		if 'auth-token' in self.scope['cookies']:
			token = self.scope['cookies']['auth-token']
		else:
			await self.close(code=4001, reason="ayth requiered")
			print('no token')
			return
		await self.accept()
		try:
			self.data = verify_jwt(token)
			msg = "{user_name} has joined the chat".format(user_name = self.data['username'])
			print('auth success')
		except ValueError:
			await self.close(code=4001, reason="auth invalid")
			print('disco')
			return
		await self.channel_layer.group_send(
			self.room_group_name, {"type": "others_message", "message": msg, 'user': self.data['username']})
		await self.channel_layer.group_add(self.room_group_name, self.channel_name)

	async def disconnect(self, close_code):
		msg = "{user_name} has left the chat".format(user_name = self.data['username'])
		await self.channel_layer.group_send(
			self.room_group_name, {"type": "others_message", "message": msg, 'user': self.data['username']})
		await self.channel_layer.group_discard(self.room_group_name, self.channel_name)


	async def receive(self, text_data):
		text_data_json = json.loads(text_data)
		message = "{user_name} : {msg}".format(user_name = self.data['username'], msg = text_data_json['message'])

		# Echo the message back to all the chat members
		await self.channel_layer.group_send(
			self.room_group_name, {"type": "chat_message", "message": message}
		)

	# receive msg from chat
	async def chat_message(self, event):
		message = event['message']
		print('chat message !')
		await self.send(text_data=json.dumps({'message': message}))

	async def others_message(self, event):
		message = event['message']
		user = event['user']
		print('not to self')
		print(user)
		print(self.data['username'])
		if self.data['username'] == user:
			return
		await self.send(text_data=json.dumps({'message': message}))


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

class PongConsumer(AsyncJsonWebsocketConsumer):

	def __init__(self, *args, **kwargs):
		self.username = None
		self.lobby_id = None
		self.users = set()
		self.is_valid = False
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

	def	_is_valid_client(self) -> bool:
		self.lobby_id = self.scope['url_route']['kwargs']["lobby_id"]
		if PongLobby.check_lobby_id(self.lobby_id) == False:
			self.scope['error'] = "invalid lobby"
			self.scope['error_code'] = 4003
			return False
		if PongConsumer.DISABLE_AUTH:
			return True
		if not self._auth_client():
			return False
		if not lobbys_list[self.lobby_id].check_user(self.username):
			self.scope['error'] = "forbidden lobby"
			self.scope['error_code'] = 4004
			return False
		return True

	# ONLY FOR DEBUG, given username in sent content will be used
	DISABLE_AUTH = True
	
	async def connect(self):
		await self.accept()
		if self._is_valid_client():
			self.is_valid = True
			await self.channel_layer.group_add(self.lobby_id, self.channel_name)
		else:
			await self._send_error(self.scope['error'], self.scope['error_code'], True)
			print("Connection rejected because: {0}".format(self.scope['error']))
		await self.send_json({'type':'ping'})

	async def disconnect(self, close_code):
		if self.is_valid:
			for user in self.users:
				lobbys_list[self.lobby_id].player_leave(user)
			await self.channel_layer.group_send(
				self.lobby_id, {
					"type": "info_message",
					"data": "{users} left the game.".format(users=",".join(self.users))
				})
			await self.channel_layer.group_discard(self.lobby_id, self.channel_name)

	async def receive_json(self, content, **kwargs):
		if not "username" in content:
			await self._send_error('Missing username')
			return
		try:
			await self.dispatch(content)
		except ValueError as e:
			await self.send_json({'type':'error', 'data':f'Invalid type: {e}'})

	async def _send_error(self, msg: str = None, code: int = 4001, close = False):
		await self.send_json({'type':'error', 'data':msg})
		if close:
			await self.close(code, msg)

	# receive msg from chat
	async def join_game(self, content):
		if not PongConsumer.DISABLE_AUTH and content['username'].split('.')[0] != self.username:
			await self._send_error('You are not who you pretend to be')
			return
		if not await lobbys_list[self.lobby_id].player_join(content['username']):
			await self._send_error('Could not join the lobby.')
			return
		self.users.add(content['username'])
		await self.channel_layer.group_send(
			self.lobby_id, {"type": "info_message",
				"data": "{user} joined the game.".format(user=content['username'])}
		)

	async def error(self, content):
		await self._send_error(content['detail'], 4005, True)

	async def key_input(self, content):
		if content['username'] not in self.users:
			await self._send_error('Invalid username')
		lobbys_list[self.lobby_id].player_input(content['username'], content['input'])

	async def cancel(self, content):
		await self.send_json(content)
		await self.close(4000, "game cancelled")

	async def game_start(self, content):
		await self.send_json(content)

	async def game_finish(self, content):
		await self.send_json(content)
		await self.close(4000, "game finished")

	async def send_game_state(self, content):
		await self.send_json(content)

	async def info_message(self, content):
		await self.send_json(content)

# CONSTANTS (How to share them with script_pong.js ???)
PLAYER_HEIGHT = 0.16
PLAYER_WIDTH = 0.01
BALL_RADIUS = 0.015

PLAYER_SPEED = 0.02
BALL_SPEED = 0.005
MAX_SPEED = 0.03

class SquareConsumer(AsyncWebsocketConsumer):

	mut_lock = asyncio.Lock()
	game_group_name = "square_game"
	players = 0
	west_position = 0.5
	east_position = 0.5
	ball_pos_x = 0.5
	ball_pos_y = 0.5
	ball_speed_x = BALL_SPEED
	ball_speed_y = 0.0

	west_score = 0
	east_score = 0


	async def connect(self):
		async with self.mut_lock:
			if self.players == 2:
					self.close(code=4001, reason="too many players")
		await self.accept()
		await self.channel_layer.group_add(self.game_group_name, self.channel_name)
		async with self.mut_lock:
			SquareConsumer.players += 1
			print('total players %d', SquareConsumer.players)
		if SquareConsumer.players > 0:
			asyncio.create_task(self.move_loop())

	async def receive(self, text_data):
		text_data_json = json.loads(text_data)
		key_pressed = text_data_json["key_pressed"]
		async with self.mut_lock:
			if key_pressed == "west_player_up":
					SquareConsumer.west_position = max(PLAYER_HEIGHT / 2, self.west_position - PLAYER_SPEED)
			elif key_pressed == "west_player_down":
					SquareConsumer.west_position = min(1 - PLAYER_HEIGHT / 2, self.west_position + PLAYER_SPEED)
			elif key_pressed == "east_player_up":
					SquareConsumer.east_position = max(PLAYER_HEIGHT / 2, self.east_position - PLAYER_SPEED)
			elif key_pressed == "east_player_down":
					SquareConsumer.east_position = min(1 - PLAYER_HEIGHT / 2, self.east_position + PLAYER_SPEED)

	async def state_update(self, event):
		await self.send(
			text_data=json.dumps({
					"type": "stateUpdate",
					"west_player_pos": event["west_player_pos"],
					"east_player_pos": event['east_player_pos'],
					"ball_pos_x": event['ball_pos_x'],
					"ball_pos_y": event['ball_pos_y'],
					"west_score": event['west_score'],
					"east_score": event['east_score'],
			}
			)
		)

	async def disconnect(self, code):
			async with self.mut_lock:
				SquareConsumer.players -= 1
			await self.channel_layer.group_discard(self.game_group_name, self.channel_name)

	async def move_loop(self):
		while True:
			async with self.mut_lock:
				if SquareConsumer.players == 0:
					break
				
				# ball movement
				self.ball_pos_x += self.ball_speed_x
				self.ball_pos_y += self.ball_speed_y

				# wall collisions
				if self.ball_pos_y - BALL_RADIUS <= 0 and self.ball_speed_y < 0:
					self.ball_speed_y *= -1
				elif self.ball_pos_y + BALL_RADIUS >= 1 and self.ball_speed_y > 0:
					self.ball_speed_y *= -1

				# paddles collisions
					# west
				if rectCircleCollision(0, self.west_position - PLAYER_HEIGHT / 2, PLAYER_WIDTH, PLAYER_HEIGHT, self.ball_pos_x, self.ball_pos_y, BALL_RADIUS):
					relative_intersect = -(((self.west_position + PLAYER_HEIGHT / 2) - self.ball_pos_y) / (PLAYER_HEIGHT) - 0.5)
					bounce_angle = relative_intersect * (math.pi / 2)
					speed = math.sqrt(self.ball_speed_x**2 + self.ball_speed_y**2)
					if speed < MAX_SPEED: speed += 0.001 # accelerate
					self.ball_speed_x = speed * math.cos(bounce_angle)
					self.ball_speed_y = speed * math.sin(bounce_angle)

					# east
				if rectCircleCollision(1 - PLAYER_WIDTH, self.east_position - PLAYER_HEIGHT / 2, PLAYER_WIDTH, PLAYER_HEIGHT, self.ball_pos_x, self.ball_pos_y, BALL_RADIUS):
					relative_intersect = -(((self.east_position + PLAYER_HEIGHT / 2) - self.ball_pos_y) / (PLAYER_HEIGHT) - 0.5)
					bounce_angle = relative_intersect * (math.pi / 2)
					speed = math.sqrt(self.ball_speed_x**2 + self.ball_speed_y**2)
					if speed < MAX_SPEED: speed += 0.001 # accelerate
					self.ball_speed_x = -speed * math.cos(bounce_angle)
					self.ball_speed_y = speed * math.sin(bounce_angle)

				# point
				if self.ball_pos_x < -0.5:
					self.east_score += 1
					self.ball_pos_x = 0.2
					self.ball_pos_y = 0.5
					self.ball_speed_x = BALL_SPEED
					self.ball_speed_y = 0

				elif self.ball_pos_x > 1.5:
					self.west_score += 1
					self.ball_pos_x = 0.8
					self.ball_pos_y = 0.5
					self.ball_speed_x = -BALL_SPEED
					self.ball_speed_y = 0


			await self.channel_layer.group_send(self.game_group_name, {"type": "state_update",
																		"west_player_pos": SquareConsumer.west_position,
																		"east_player_pos": SquareConsumer.east_position,
																		"ball_pos_x": self.ball_pos_x,
																		"ball_pos_y": self.ball_pos_y,
																		"west_score": self.west_score,
																		"east_score": self.east_score,
																		})
			await asyncio.sleep(0.005)
			# print('again')
		print('All players left')


def rectCircleCollision(rectX, rectY, width, height, circX, circY, radius):
	closestX = max(rectX, min(circX, rectX + width))
	closestY = max(rectY, min(circY, rectY + height))

	distanceX = circX - closestX
	distanceY = circY - closestY
	distanceSquared = distanceX**2 + distanceY**2

	return distanceSquared <= radius**2

