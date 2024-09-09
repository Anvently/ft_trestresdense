from typing import List, Dict, Any
import time
import math
import asyncio
from channels.layers import get_channel_layer
from django.http.request import HttpRequest
import requests
from typing import List, Dict, Any, Tuple
import json
from django.conf import settings
import traceback


# Constants
PADDLE_LENGTH = 0.16
PADDLE_THICKNESS = 0.01
PLAYER_SPEED = 0.02

BALL_RADIUS = 0.015
BALL_SERVICE_SPEED = 0.005
BALL_SPEED = 0.01
MAX_SPEED = 0.025		#must be less than 2*BALL_RADIUS + PADDLE_THICKNESS to avoid the ball passing through

WEST = 0
EAST = 1
NORTH = 2
SOUTH = 3

START_POS = [{"x": PADDLE_THICKNESS / 2, 'y': 0.5, 'width': PADDLE_THICKNESS, 'height': PADDLE_LENGTH},
			 {"x": 1 - PADDLE_THICKNESS / 2, "y": 0.5,"width": PADDLE_THICKNESS,"height": PADDLE_LENGTH,},
			 {"x": 0.5, "y": PADDLE_THICKNESS / 2,"width": PADDLE_THICKNESS / 2,"height": PADDLE_LENGTH},
			 {"x": 0.5, "y":1 - PADDLE_THICKNESS / 2, "width": PADDLE_THICKNESS / 2,"height": PADDLE_LENGTH}
			 ]

BALL_START = {"x": 0.5, "y": 0.5, "r": BALL_RADIUS, "speed": {"x": 0, "y": 0}}


# test AI
ai_direction = EAST


class Player:
	def __init__(self, player_id, position, lives=0, type='wall'):
		self.type = type
		self.player_id = player_id
		self.position = position
		self.lives = lives
		self.coordinates = START_POS[position]
		self.has_joined = 0

class PongLobby:
	service_direction = 0

	def __init__(self, lobby_id: str, players_list: List[str], lifes,  tournId=None) -> None:
		self.lobby_id = lobby_id
		self.player_num = len(players_list)
		if tournId:
			self.tournId = tournId
		self.ball = None
		self.players: List[Player] = []
		self.match_id_pos = {}
		for i in range(len(players_list)):
			self.players.append(Player(players_list[i], i, lifes, 'player'))
			self.match_id_pos[players_list[i]] = i
		for i in range(self.player_num, 4):
			self.players.append(Player('!wall', i))
		self.ball = BALL_START
		self.gameState = 0
		self.mut_lock = asyncio.Lock()
		self.loop = None
		self.waiting_for = self.player_num
		self.winner = None

	def check_lobby_id(id:str) -> bool:
		if id in lobbys_list:
			return True
		return False

	def check_user(self, username:str):
		"""Check that the user belong to the lobby"""
		if username in [player.player_id for player in self.players]:
			return True
		return False

	# init variables
	def init_game(self):
		# ball initialization
		self.ball = {
			"x": 0.5,
			"y": 0.5,
			"r": BALL_RADIUS,
			"speed": {"x": 0, "y": 0}
		}

	async def start_game_loop(self):
		print("loop started")
		self.loop = asyncio.create_task(self.game_loop())

	async def stop_game_loop(self):
		if self.loop:
			self.loop.cancel()

	async def player_join(self, player_id: str) -> bool:
		""" Template of player_list: ["user1", "user1_guest"] """
		if not self.check_user(player_id):
			return False
		self.players[self.match_id_pos[player_id]].has_joined = 1
		self.waiting_for -= 1
		if not self.loop:
			await self.start_game_loop()
		return True

	def player_leave(self, player_id: str):
		""" Template of player_list: ["user1", "user1_guest"] """
		self.waiting_for += 1

	def send_result(self):
		pass
		# API call to send result to matchmaking
			# -> gameState == 3 match was played -> get stats in self and send them
			# -> gameState == 0 game was canceled
		# should the matchmaking delete the PongLobby upon receiving the result ?

	""" 
	 add end game
	 refuse input for eliminated players

	   """

	def player_input(self, player_id, input):
		position = self.match_id_pos[player_id]

		print(f"player id = {player_id}")

		if input == "up":
			if position == EAST or position == WEST:
				self.players[position].coordinates['y'] = max(PADDLE_LENGTH / 2, self.players[position].coordinates['y'] - PLAYER_SPEED)
			else:
				self.players[position].coordinates['x'] = max(PADDLE_LENGTH / 2, self.players[position].coordinates['x'] - PLAYER_SPEED)
		elif input == "down":
			if position == EAST or position == WEST:
				self.players[position].coordinates['y'] = min(1 - PADDLE_LENGTH / 2, self.players[position].coordinates['y'] + PLAYER_SPEED)
			else:
				self.players[position].coordinates['x'] = min(1 - PADDLE_LENGTH / 2, self.players[position].coordinates['x'] + PLAYER_SPEED)


	async def	game_loop(self):
		try:
			loop_start = time.time()
			player_channel = get_channel_layer()
			# pregame : check that all players are present
			while time.time() - loop_start < 3600 and self.gameState == 0:
				await asyncio.sleep(0.05)
				async with self.mut_lock:
					data = self.compute_game()
				await player_channel.group_send(self.lobby_id, data)
				if self.waiting_for == 0:
					self.gameState = 1
			if self.gameState == 0:
				await player_channel.group_send(self.lobby_id, {"type": "cancel",
																"message": "A player failed to load"
																})
				self.send_result()
				self.loop.cancel()
				return
			await player_channel.group_send(self.lobby_id, {"type": "game_start"})
			loop_start = time.time()
			print("game has started")
			while time.time() - loop_start < 3:
				await asyncio.sleep(0.05)
				async with self.mut_lock:
					data = self.compute_game()
				await player_channel.group_send(self.lobby_id, data)
			self.gameState = 2

			# play !
				# launch ball
			self.reset_ball()
			while self.gameState == 2:
				await asyncio.sleep(0.016)	# 0.16 -> 60Hz
				async with self.mut_lock:
					data = self.compute_game()
				await player_channel.group_send(self.lobby_id, data)
			await player_channel.group_send(
				self.lobby_id, {
					"type": "game_finish",
					"content": f"{self.get_winner()} has winned the game."
				}
			)
			self.send_result()
			# remove from list
		except Exception as e:
			print(e)
			await player_channel.group_send(self.lobby_id, {'type':'error', 'detail':'error in game loop'})
			traceback.print_exc()



	def	compute_game(self):
		self.move_ball()
		self.collision_logic()
		self.check_goals()
		self.check_eliminated_players()
		if self.check_winning_condition():
			self.gameState = 3

		#### AI TEST
		# self.AI_behavior()
		####
		return self.generate_JSON()


	def move_ball(self):
		self.ball['x'] += self.ball["speed"]['x']
		self.ball['y'] += self.ball["speed"]['y']

	def	collision_logic(self):
		self.wall_collision()
		self.paddle_collision()

	def wall_collision(self):
		if self.players[NORTH].type != "player" and self.ball['y'] - BALL_RADIUS <= 0 and self.ball["speed"]['y'] < 0:
			self.ball["speed"]['y'] *= -1
		elif self.players[SOUTH].type != "player" and self.ball['y'] + BALL_RADIUS >= 1 and self.ball["speed"]['y'] > 0:
			self.ball["speed"]['y'] *= -1
		elif self.players[WEST].type != "player" and self.ball['x'] - BALL_RADIUS <= 0 and self.ball["speed"]['x'] < 0:
			self.ball["speed"]['x'] *= -1
		elif self.players[EAST].type != "player" and self.ball['x'] + BALL_RADIUS >= 1 and self.ball["speed"]['x'] > 0:
			self.ball["speed"]['x'] *= -1

	def paddle_collision(self):
		for direction in range(0, self.player_num):
			if self.players[direction].type == "player":
				if self.rectCircleCollision(self.players[direction].coordinates['x'] - self.players[direction].coordinates['width'] / 2,
										self.players[direction].coordinates['y'] - self.players[direction].coordinates['height'] / 2,
										self.players[direction].coordinates['width'],
										self.players[direction].coordinates['height'],
										self.ball['x'],
										self.ball['y'],
										self.ball["r"]):
					self.paddle_rebound(direction)

	def paddle_rebound(self, direction):
		# calculate the relative intersect: correspond to the relative position of ball/paddle intersection on the paddle (between -0.5 and 0.5)
		if direction == WEST or direction == EAST:
			relative_intersect = 0.5 - ((self.players[direction].coordinates["y"] + self.players[direction].coordinates["height"] / 2) - self.ball["y"]) / self.players[direction].coordinates["height"]
		else:
			relative_intersect = 0.5 - ((self.players[direction].coordinates["x"] + self.players[direction].coordinates["width"] / 2) - self.ball["x"]) / self.players[direction].coordinates["width"]

		# calculate the bounce angle
		bounce_angle = relative_intersect * (math.pi / 2)

		# normalize the speed
		speed = math.sqrt(self.ball["speed"]["x"]**2 + self.ball["speed"]["y"]**2)

		# if ball was at service speed, set to normal speed
		if speed < BALL_SPEED:
			speed = BALL_SPEED
			# OPTIONNAL: accelerate each time the ball collides with a paddle
		if speed < MAX_SPEED:
			speed *= 1.1
		self.ball["speed"]["x"] = speed * math.cos(bounce_angle)
		self.ball["speed"]["y"] = speed * math.sin(bounce_angle)

		# reverse direction of ball
		if direction == EAST:
			self.ball["speed"]["x"] *= -1
		elif direction == SOUTH:
			self.ball["speed"]["y"] *= -1


	def rectCircleCollision(self, rectX, rectY, width, height, circX, circY, radius):
		closestX = max(rectX, min(circX, rectX + width))
		closestY = max(rectY, min(circY, rectY + height))

		distanceX = circX - closestX
		distanceY = circY - closestY
		distanceSquared = distanceX**2 + distanceY**2

		return distanceSquared <= radius**2

	def check_goals(self):
		#meh, pue un peu la merde dans le cas des buts marques tres pres du bord
		goal_scored = False
		if self.ball['x'] < 0 and self.players[WEST].type == "player":
			self.players[WEST].lives -= 1
			goal_scored = True
		elif self.ball['x'] > 1 and self.players[EAST].type == "player":
			self.players[EAST].lives -= 1
			goal_scored = True
		elif self.ball['y'] < 0 and self.players[NORTH].type == "player":
			self.players[NORTH].lives -= 1
			goal_scored = True
		elif self.ball['y'] > 1 and self.players[SOUTH].type == "player":
			self.players[SOUTH].lives -= 1
			goal_scored = True

		if goal_scored:
			self.reset_ball()

	def	reset_ball(self):
		self.ball['x'] = 0.5
		self.ball['y'] = 0.5
		self.ball["speed"]['x'] = 0
		self.ball["speed"]['y'] = 0

		# throw ball in service_direction
		if self.service_direction == WEST:
			self.ball["speed"]['x'] = -BALL_SERVICE_SPEED
		elif self.service_direction == EAST:
			self.ball["speed"]['x'] = BALL_SERVICE_SPEED
		elif self.service_direction == NORTH:
			self.ball["speed"]['y'] = -BALL_SERVICE_SPEED
		elif self.service_direction == SOUTH:
			self.ball["speed"]['y'] = BALL_SERVICE_SPEED
		# change service_direction
		self.update_service_direction()

	# change service direction to next live player
	def update_service_direction(self):
		self.service_direction += 1
		while True:
			if self.players[self.service_direction].type == "player":
				break
			self.service_direction +=1
			if self.service_direction > self.player_num:
				self.service_direction = 0


	def check_eliminated_players(self):
		for direction in range(0, self.player_num):
			if self.players[direction].lives == 0:
				self.players[direction].type = "eliminated_player"

	def check_winning_condition(self) -> bool:
		count = 0
		for direction in range(0, self.player_num):
			if self.players[direction].type == "player":
				count += 1
		return count == 1

	def generate_JSON(self) -> Dict[str, Any]:
		json = {
			'type': 'send_game_state',
			'number_of_players' : self.player_num,
			'ball_x': self.ball['x'],
			'ball_y': self.ball['y'],
			'ball_r': self.ball['r'],
			'ball_speed_x': self.ball["speed"]['x'],
			'ball_speed_y': self.ball["speed"]['y'],
		}

		for index in range(self.player_num):
			json[f"player{index}_type"] = self.players[index].type
			json[f"player{index}_lives"] = self.players[index].lives
			json[f"player{index}_x"] = self.players[index].coordinates['x']
			json[f"player{index}_y"] = self.players[index].coordinates['y']
			json[f"player{index}_width"] = self.players[index].coordinates['width']
			json[f"player{index}_height"] = self.players[index].coordinates['height']
		return json


	def get_winner(self) -> str:
		for i in range(self.player_num):
			if self.players[i].type == 'player':
				return self.players[i].player_id
		return None


	def post_result(self):
		data = Dict()
		data['game_id'] =  self.lobby_id
		if self.gameState == 0:
			data['status'] = 'canceled'
			data['winner'] = self.get_winner()
		else:
			data['status'] = 'terminated'
			data['winner'] = self.winner
		try:
			requests.post('http://matchmaking:8003/result/?format=json',
					data=json.dumps(data),
					headers = {
						'Host': 'localhost',
						'Authorization': "Bearer {0}".format(settings.API_TOKEN.decode('ASCII'))
						}
					)
		except Exception as e:
			pass
		self.stop_game_loop()










################## AI WIP ##################

# loop
	# every seconds, check ball position and speed
		# if ball is coming towards the AI
			# find the position of impact
				# paddle destination = position of impact
		# else
			# paddle destination = center

	# move paddle towards destination


	last_time = int(time.time())
	destination = 0.5

	def AI_behavior(self):
		if int(time.time()) != self.last_time:
			print("NEW TIME !")
			self.destination = self.calculate_destination()
			self.last_time = int(time.time())
		if self.destination:
			self.move_paddle()


	def calculate_impact(self):
		fpos_x = self.ball["x"]
		fpos_y = self.ball["y"]
		fspeed_x = self.ball["speed"]["x"]
		fspeed_y = self.ball["speed"]["y"]

		while True:
			print("calculate impact loop")
			while BALL_RADIUS < fpos_x < 1 - BALL_RADIUS and BALL_RADIUS < fpos_y < 1 - BALL_RADIUS:
				fpos_x += fspeed_x
				fpos_y += fspeed_y
				if fpos_x < BALL_RADIUS or fpos_x > 1 - BALL_RADIUS:
					if ai_direction == WEST or ai_direction == EAST:
						return fpos_x
					else:
						fspeed_x *= -1 
				if fpos_y < BALL_RADIUS or fpos_y > 1 - BALL_RADIUS:
					if ai_direction == NORTH or ai_direction == SOUTH:
						return fpos_y
					else:
						fspeed_y *= -1 

	def calculate_destination(self):
		self.destination = 0.5
		if ai_direction == WEST and self.ball["speed"]["x"] < 0 or ai_direction == EAST and self.ball["speed"]["x"] > 0 or ai_direction == NORTH and self.ball["speed"]["y"] < 0 or ai_direction == SOUTH and self.ball["speed"]["y"] > 0:
			self.destination = self.calculate_impact()
		print(f"AI -> calculate destination : {self.destination}")

	# move ai player towards destination
	def move_paddle(self):
		if ai_direction == WEST or ai_direction == EAST:
			position = self.players[ai_direction].coordinates["y"] - self.players[ai_direction].coordinates["height"] / 2
			if self.destination < position:
				self.player_input("user1", "up")
			else:
				self.player_input("user1", "down")
		else:
			position = self.players[ai_direction].coordinates["x"] - self.players[ai_direction].coordinates["width"] / 2
			if self.destination < position:
				self.player_input("user1", "up")
			else:
				self.player_input("user1", "down")



lobbys_list : Dict[str, PongLobby] = dict()
lobbys_list["10"] = PongLobby(
	lobby_id="10",
	players_list=["admin", "user1"],
	lifes=100,
	tournId=None
)