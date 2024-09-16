from typing import List, Dict, Any
import time
import math
import random
import asyncio
from channels.layers import get_channel_layer
from django.http.request import HttpRequest
import requests
from typing import List, Dict, Any, Tuple
import json
from django.conf import settings
import traceback
from pong_server.game_3d import PongLobby3D

# Constants
PADDLE_LENGTH = 0.16
PADDLE_THICKNESS = 0.02
PLAYER_SPEED = 0.016

BALL_RADIUS = 0.015
BALL_SERVICE_SPEED = 0.005
BALL_SPEED = 0.01
MAX_SPEED = 0.04		#must be less than 2*BALL_RADIUS + PADDLE_THICKNESS to avoid the ball passing through

WEST = 0
EAST = 1
NORTH = 2
SOUTH = 3

START_POS = [{"x": PADDLE_THICKNESS / 2, 'y': 0.5, 'width': PADDLE_THICKNESS, 'height': PADDLE_LENGTH},
			 {"x": 1 - PADDLE_THICKNESS / 2, "y": 0.5,"width": PADDLE_THICKNESS,"height": PADDLE_LENGTH,},
			 {"x": 0.5, "y": PADDLE_THICKNESS / 2,"width": PADDLE_LENGTH,"height": PADDLE_THICKNESS},
			 {"x": 0.5, "y":1 - PADDLE_THICKNESS / 2, "width": PADDLE_LENGTH,"height": PADDLE_THICKNESS}
			 ]

BALL_START = {"x": 0.5, "y": 0.5, "r": BALL_RADIUS, "speed": {"x": 0, "y": 0}}


# test AI
# ai_direction = EAST


class Player:
	def __init__(self, player_id, position, lives=0):
		self.player_id = player_id
		self.position = position
		self.lives = lives
		self.coordinates = START_POS[position]
		self.has_joined = 0
		# AI specific variables
		self.last_time = int(time.time())

	######### AI ##############
	def AI_behavior(self, ballX, ballY, ballSpeedX, ballSpeedY) -> str:
		raise Exception("Please override AI_behavior().")

	def calculate_destination(self, ballX, ballY, ballSpeedX, ballSpeedY):
		raise Exception("Please override calculate_destination().")

	def calculate_impact(self, ballX, ballY, ballSpeedX, ballSpeedY):
		raise Exception("Please override calculate_impact().")

class Player2D(Player):

	def __init__(self, player_id, position, lives=0, type='wall'):
		super().__init__(player_id, position, lives)
		self.type = type
		self.destination = 0.5

	def AI_behavior(self, ballX, ballY, ballSpeedX, ballSpeedY) -> str:
		if int(time.time()) != self.last_time:
			self.calculate_destination(ballX, ballY, ballSpeedX, ballSpeedY)
			self.last_time = int(time.time())
		
		if self.position == WEST or self.position == EAST:
			position = self.coordinates["y"]
		else:
			position = self.coordinates["x"]

		if self.position == WEST or self.position == EAST:
			position = self.coordinates["y"]
			if self.destination < position - PLAYER_SPEED:
				return "up"
			elif self.destination > position + PLAYER_SPEED:
				return "down"
		else:
			position = self.coordinates["x"]
			if self.destination < position - PLAYER_SPEED:
				return "up"
			elif self.destination > position + PLAYER_SPEED:
				return "down"
		return ""
	
	def calculate_destination(self, ballX, ballY, ballSpeedX, ballSpeedY):
		self.destination = 0.5
		if self.position == WEST and ballSpeedX < 0 or self.position == EAST and ballSpeedX > 0 or self.position == NORTH and ballSpeedY < 0 or self.position == SOUTH and ballSpeedY > 0:
			self.destination = self.calculate_impact(ballX, ballY, ballSpeedX, ballSpeedY)

		# make the ai hit the edges of the paddle
		# if self.destination < 0.5:
		# 	self.destination += (PADDLE_LENGTH / 2 ) * 0.9
		# else:
		# 	self.destination -= (PADDLE_LENGTH / 2 ) * 0.9
		rand = random.randint(0, 1)
		if rand:
			self.destination += (PADDLE_LENGTH / 2 ) * 0.9
		else:
			self.destination -= (PADDLE_LENGTH / 2 ) * 0.9

	def calculate_impact(self, ballX, ballY, ballSpeedX, ballSpeedY):
		fpos_x = ballX
		fpos_y = ballY
		fspeed_x = ballSpeedX
		fspeed_y = ballSpeedY

		while True:
			fpos_x += fspeed_x
			fpos_y += fspeed_y
			if not BALL_RADIUS < fpos_x < 1 - BALL_RADIUS:
				if self.position == WEST or self.position == EAST:
					return fpos_y
				else:
					fspeed_x *= -1 
			if not BALL_RADIUS < fpos_y < 1 - BALL_RADIUS:
				if self.position == NORTH or self.position == SOUTH:
					return fpos_x
				else:
					fspeed_y *= -1 

class PongLobby:

	def __init__(self, lobby_id: str, players_list: List[str], settings: Dict[str, Any], tournId=None) -> None:
		self.lobby_id = lobby_id
		self.player_num = len(players_list)
		if tournId:
			self.tournId = tournId
		self.ball = None
		self.players: List[Player] = []
		self.match_id_pos = {}
		self.settings = settings
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
		if username in [Player.player_id for Player in self.players]:
			return True
		return False
	
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
		raise Exception("Please override send_result()")
		# API call to send result to matchmaking
			# -> gameState == 3 match was played -> get stats in self and send them
			# -> gameState == 0 game was canceled
		# should the matchmaking delete the PongLobby upon receiving the result ?

	def player_input(self, player_id, input):
		raise Exception("Please override player_input()")

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
																"message": "A Player failed to load"
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
		self.compute_AI()	### AI TEST ###
		if self.check_winning_condition():
			self.gameState = 3
		return self.generate_JSON()

	def compute_AI(self):
		for i in range(self.player_num):
			if self.players[i].player_id.startswith("!AI"):
				input = self.players[i].AI_behavior(self.ball["x"], self.ball["y"], self.ball["speed"]["x"], self.ball["speed"]["y"])
				self.player_input(self.players[i].player_id, input)

	def move_ball(self):
		raise Exception("Please override player_input()")

	def	collision_logic(self):
		raise Exception("Please override collision_logic()")

	def check_goals(self):
		raise Exception("Please override check_goals()")

	def	reset_ball(self):
		raise Exception("Please override reset_balls()")

	def check_winning_condition(self) -> bool:
		raise Exception("Please override check_winning_condition()")

	def generate_JSON(self) -> Dict[str, Any]:
		raise Exception("Please override generate_JSON()")

	def get_winner(self) -> str:
		for i in range(self.player_num):
			if self.players[i].type == 'Player':
				print(f"{self.players[i].player_id} won the game")
				return self.players[i].player_id
		return None


class PongLobby2D(PongLobby):
	service_direction = 0
	
	def __init__(self, lobby_id: str, players_list: List[str], settings: Dict[str, Any], tournId=None) -> None:
		super().__init__(lobby_id, players_list, settings, tournId)
		for i in range(len(players_list)):
			self.players.append(Player2D(players_list[i], i, self.settings['lives'], 'Player'))
			self.match_id_pos[players_list[i]] = i
		for i in range(self.player_num, 4):
			self.players.append(Player('!wall', i))
		
			##### AI TEST
		# self.last_time = int(time.time())
		# self.destination = 0.5

	# init variables
	def init_game(self):
		# ball initialization
		self.ball = {
			"x": 0.5,
			"y": 0.5,
			"r": BALL_RADIUS,
			"speed": {"x": 0, "y": 0}
		}
	
	def player_input(self, player_id, input):
		position = self.match_id_pos[player_id]

		# check if sender is not alive
		if self.players[position].type != "Player":
			return

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

	def move_ball(self):
		self.ball['x'] += self.ball["speed"]['x']
		self.ball['y'] += self.ball["speed"]['y']

	def collision_logic(self):
		self.wall_collision()
		self.paddle_collision()

	def wall_collision(self):
		if self.players[NORTH].type != "Player" and self.ball['y'] - BALL_RADIUS <= 0 and self.ball["speed"]['y'] < 0:
			self.ball["speed"]['y'] *= -1
		elif self.players[SOUTH].type != "Player" and self.ball['y'] + BALL_RADIUS >= 1 and self.ball["speed"]['y'] > 0:
			self.ball["speed"]['y'] *= -1
		elif self.players[WEST].type != "Player" and self.ball['x'] - BALL_RADIUS <= 0 and self.ball["speed"]['x'] < 0:
			self.ball["speed"]['x'] *= -1
		elif self.players[EAST].type != "Player" and self.ball['x'] + BALL_RADIUS >= 1 and self.ball["speed"]['x'] > 0:
			self.ball["speed"]['x'] *= -1

	def paddle_collision(self):
		for direction in range(0, self.player_num):
			if self.players[direction].type == "Player":
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
			relative_intersect = 0.5 + ((self.players[direction].coordinates["x"] + self.players[direction].coordinates["width"] / 2) - self.ball["x"]) / self.players[direction].coordinates["width"]

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
		if self.ball['x'] < 0 and self.players[WEST].type == "Player":
			self.players[WEST].lives -= 1
			print(f"WEST lost a life, {self.players[WEST].lives} remaining")
			goal_scored = True
		elif self.ball['x'] > 1 and self.players[EAST].type == "Player":
			self.players[EAST].lives -= 1
			print(f"EAST lost a life, {self.players[EAST].lives} remaining")
			goal_scored = True
		elif self.ball['y'] < 0 and self.players[NORTH].type == "Player":
			self.players[NORTH].lives -= 1
			print(f"NORTH lost a life, {self.players[NORTH].lives} remaining")
			goal_scored = True
		elif self.ball['y'] > 1 and self.players[SOUTH].type == "Player":
			self.players[SOUTH].lives -= 1
			print(f"SOUTH lost a life, {self.players[SOUTH].lives} remaining")
			goal_scored = True

		if goal_scored:
			self.check_eliminated_players()
			self.reset_ball()

	def	reset_ball(self):
		self.ball['x'] = 0.5
		self.ball['y'] = 0.5
		speed = BALL_SERVICE_SPEED

		self.update_service_direction()

		if self.service_direction == WEST:
			angle_modifier = math.pi
		elif self.service_direction == EAST:
			angle_modifier = 0
		elif self.service_direction == NORTH:
			angle_modifier = 3 * math.pi / 2
		elif self.service_direction == SOUTH:
			angle_modifier = math.pi / 2

		# random service_angle between 15 and 75 degrees, centered on service direction
		service_angle = (random.randint(15, 75) * math.pi) / 180 - math.pi / 4 + angle_modifier
		self.ball["speed"]["x"] = speed * math.cos(service_angle)
		self.ball["speed"]["y"] = speed * math.sin(service_angle)

	def check_winning_condition(self) -> bool:
		count = 0
		for direction in range(0, self.player_num):
			if self.players[direction].type == "Player":
				count += 1
		return count == 1
	
	# change service direction to next live Player
	def update_service_direction(self):
		while True:
			self.service_direction +=1
			if self.service_direction >= self.player_num:
				self.service_direction = 0
			if self.players[self.service_direction].type == "Player":
				break

	def check_eliminated_players(self):
		for direction in range(0, self.player_num):
			if self.players[direction].lives == 0 and self.players[direction].type != "eliminated_player":
				# eliminate Player
				self.players[direction].type = "eliminated_player"
				self.players[direction].coordinates["x"] = 0
				self.players[direction].coordinates["y"] = 0
				self.players[direction].coordinates["width"] = 0
				self.players[direction].coordinates["height"] = 0
				print(f"Player {self.players[direction].player_id} has been eliminated")

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
			json[f"Player{index}_type"] = self.players[index].type
			json[f"Player{index}_lives"] = self.players[index].lives
			json[f"Player{index}_x"] = self.players[index].coordinates['x']
			json[f"Player{index}_y"] = self.players[index].coordinates['y']
			json[f"Player{index}_width"] = self.players[index].coordinates['width']
			json[f"Player{index}_height"] = self.players[index].coordinates['height']
		return json
	
	def send_result(self):
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

lobbys_list : Dict[str, Any] = dict()
lobbys_list["10"] = PongLobby(
	lobby_id="10",
	players_list=["P1", "P2"],
	lives=100,
	# players_list=["P1", "!AI1"],
	tournId=None
)
lobbys_list["11"] = PongLobby3D(
	lobby_id="11",
	players_list=["P1", "P2"],
	# players_list=["P1", "!AI1"],
	tournId=None
)


