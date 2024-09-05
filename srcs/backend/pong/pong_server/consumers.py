import json
import time
import jwt
import math
import asyncio
from django.conf import settings
from channels.generic.websocket import AsyncWebsocketConsumer

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

