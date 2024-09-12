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



# Constants
TABLE_LENGHT = 9 / 5

PADDLE_MAX_X = [-0.2, 1.2]
PADDLE_MIN_X = [-1.2, 0.5]
PADDLE_MAX_Y = [1, 1,]
PADDLE_MIN_Y = [-1, -1]
PADDLE_LEFT_DIR = [-1, 1]

PADDLE_LENGTH = 0.16
PADDLE_THICKNESS = 0.02
PLAYER_SPEED = 0.016

BALL_RADIUS = 0.015
BALL_SERVICE_SPEED = 0.005
BALL_SPEED = 0.01
MAX_SPEED = 0.04		#must be less than 2*BALL_RADIUS + PADDLE_THICKNESS to avoid the ball passing through

WEST = 0
EAST = 1

START_POS = [{"x": -TABLE_LENGHT / 2 + PADDLE_THICKNESS / 2, "y": 0, "angle": math.pi, 'width': PADDLE_THICKNESS, 'height': PADDLE_LENGTH},
			{"x": TABLE_LENGHT / 2 - PADDLE_THICKNESS / 2, "y": 0, "angle": 0,"width": PADDLE_THICKNESS,"height": PADDLE_LENGTH,},
			]

BALL_START = {"x": 0, "y": 0, "r": BALL_RADIUS, "speed": {"x": 0, "y": 0}, "last_hit": 0}


# test AI
# ai_direction = EAST

class Player:
	def __init__(self, player_id, side, lives=0):
		self.player_id = player_id
		self.side = side
		self.lives = lives
		self.coordinates = START_POS[side]
		self.has_joined = 0

		# AI specific variables
		# self.last_time = int(time.time())
		# self.destination = 0

	######### AI ##############
	# def AI_behavior(self, ballX, ballY, ballSpeedX, ballSpeedY) -> str:
	# 	if int(time.time()) != self.last_time:
	# 		self.calculate_destination(ballX, ballY, ballSpeedX, ballSpeedY)
	# 		self.last_time = int(time.time())
		
	# 	position = self.coordinates["y"]
	# 	print(f"destination : {self.destination}")
	# 	print(f"position : {position}")

	# 	if self.destination < position - PLAYER_SPEED:
	# 		return "down"
	# 	elif self.destination > position + PLAYER_SPEED:
	# 		return "up"
	# 	return ""

	# def calculate_destination(self, ballX, ballY, ballSpeedX, ballSpeedY):
	# 	self.destination = 0
	# 	if self.position == WEST and ballSpeedX < 0 or self.position == EAST and ballSpeedX > 0:
	# 		self.destination = self.calculate_impact(ballX, ballY, ballSpeedX, ballSpeedY)

	# 	rand = random.randint(0, 1)
	# 	if rand:
	# 		self.destination += (PADDLE_LENGTH / 2 ) * 0.9
	# 	else:
	# 		self.destination -= (PADDLE_LENGTH / 2 ) * 0.9


	# def calculate_impact(self, ballX, ballY, ballSpeedX, ballSpeedY):
	# 	fpos_x = ballX
	# 	fpos_y = ballY
	# 	fspeed_x = ballSpeedX
	# 	fspeed_y = ballSpeedY

	# 	while True:
	# 		fpos_x += fspeed_x
	# 		fpos_y += fspeed_y
	# 		if not -TABLE_LENGHT / 2 + BALL_RADIUS < fpos_x < TABLE_LENGHT / 2 - BALL_RADIUS:
	# 			return fpos_y
	# 		if not -0.5 + BALL_RADIUS < fpos_y < 0.5 - BALL_RADIUS:
	# 			fspeed_y *= -1 

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
		for i in range(2):
			self.players.append(Player(players_list[i], i, lifes))
			self.match_id_pos[players_list[i]] = i
		self.ball = BALL_START
		self.gameState = 0
		self.mut_lock = asyncio.Lock()
		self.loop = None
		self.waiting_for = self.player_num
		self.winner = None

		##### AI TEST
		# self.last_time = int(time.time())
		# self.destination = 0.5

	def check_lobby_id(id:str) -> bool:
		if id in lobbys_list:
			return True
		return False

	def check_user(self, username:str):
		"""Check that the user belong to the lobby"""
		if username in [player.player_id for player in self.players]:
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
		side = self.match_id_pos[player_id]

		if input == "up":
			self.players[side].coordinates['y'] = min(PADDLE_MAX_Y[side], self.players[side].coordinates['y'] + PLAYER_SPEED)
		elif input == "down":
			self.players[side].coordinates['y'] = max(PADDLE_MIN_Y[side], self.players[side].coordinates['y'] - PLAYER_SPEED)
		elif input == "left":
			self.players[side].coordinates['x'] = max(PADDLE_MIN_X[side], self.players[side].coordinates['x'] - PLAYER_SPEED)
		elif input == "right":
			self.players[side].coordinates['x'] = min(PADDLE_MAX_X[side], self.players[side].coordinates['x'] + PLAYER_SPEED)
		self.set_paddle_angle()



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
		# self.compute_AI()	### AI TEST ###
		# if self.check_winning_condition():
			# self.gameState = 3
		return self.generate_JSON()

	def set_paddle_angle(self):
		self.players[WEST].coordinates["angle"] = -math.atan2(self.players[WEST].coordinates["y"], -self.players[WEST].coordinates["x"])
		self.players[EAST].coordinates["angle"] = -math.atan2(self.players[EAST].coordinates["y"], -self.players[EAST].coordinates["x"])

	# def compute_AI(self):
	# 	for i in range(self.player_num):
	# 		if self.players[i].player_id.startswith("!AI"):
	# 			input = self.players[i].AI_behavior(self.ball["x"], self.ball["y"], self.ball["speed"]["x"], self.ball["speed"]["y"])
	# 			self.player_input(self.players[i].player_id, input)

	def move_ball(self):
		self.ball['x'] += self.ball["speed"]['x']
		self.ball['y'] += self.ball["speed"]['y']

	def	collision_logic(self):
		for i in range(self.player_num):
			if check_collision((self.players[i].coordinates["x"], self.players[i].coordinates["y"]),
											self.players[i].coordinates["width"],
											self.players[i].coordinates["height"],
											self.players[i].coordinates["angle"],
											(self.ball["x"],self.ball["y"]),
											self.ball["r"]):
				print("collision detected")
				self.collision_rebound()

	def collision_rebound(self):
		direction = WEST
		if self.ball["x"] > 0:
			direction = EAST
		self.ball["speed"]["x"], self.ball["speed"]["y"] = self.reflect_vector((self.ball["speed"]["x"], self.ball["speed"]["y"]) , (math.cos(self.players[direction].coordinates["angle"]), math.sin(self.players[direction].coordinates["angle"])))

	def reflect_vector(self, vector, normal_vector):
		""" Reflect a vector over a normal vector. """
		dot_product = sum(v * n for v, n in zip(vector, normal_vector))
		reflected_vector = [v - 2 * dot_product * n for v, n in zip(vector, normal_vector)]
		return reflected_vector

	def check_goals(self):
		if not -3 < self.ball["x"] < 3 or not -2 < self.ball["y"] < 2:
			self.reset_ball()
			print("goal!")


	def	reset_ball(self):
		self.ball['x'] = 0
		self.ball['y'] = 0
		speed = BALL_SERVICE_SPEED

		if self.service_direction == WEST:
			angle_modifier = math.pi
		elif self.service_direction == EAST:
			angle_modifier = 0

		# random service_angle between 15 and 75 degrees, centered on service direction
		service_angle = (random.randint(15, 75) * math.pi) / 180 - math.pi / 4 + angle_modifier
		self.ball["speed"]["x"] = speed * math.cos(service_angle)
		self.ball["speed"]["y"] = speed * math.sin(service_angle)

		# change service direction to other player
		self.service_direction = not self.service_direction



	def generate_JSON(self) -> Dict[str, Any]:
		json = {
			"type": "send_game_state",
			"ball_x": self.ball["x"],
			"ball_y": self.ball["y"],
			"ball_r": self.ball["r"],
			"ball_speed_x": self.ball["speed"]["x"],
			"ball_speed_y": self.ball["speed"]["y"],
			"ball_last_hit": self.ball["last_hit"]
		}

		for index in range(2):
			json[f"player{index}_lives"] = self.players[index].lives
			json[f"player{index}_x"] = self.players[index].coordinates["x"]
			json[f"player{index}_y"] = self.players[index].coordinates["y"]
			json[f"player{index}_angle"] = (self.players[index].coordinates["angle"])
			json[f"player{index}_width"] = self.players[index].coordinates["width"]
			json[f"player{index}_height"] = self.players[index].coordinates["height"]

		return json

	def get_winner(self) -> str:
		for i in range(self.player_num):
			print(f"{self.players[i].player_id} won the game")
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





lobbys_list : Dict[str, PongLobby] = dict()
lobbys_list["10"] = PongLobby(
	lobby_id="10",
	players_list=["P1", "P2"],
	# players_list=["!AI1", "!AI2"],
	lifes=100,
	tournId=None
)










##################################################### COLLISION
import math

def rotate_point(px, py, angle):
	""" Rotate a point around the origin by the given angle. """
	s = math.sin(angle)
	c = math.cos(angle)
	return px * c - py * s, px * s + py * c

def rectangle_vertices(center, width, height, angle):
	""" Get the vertices of the rectangle in its local coordinate system. """
	half_width = width / 2
	half_height = height / 2
	
	vertices = [
		(-half_width, -half_height),
		(half_width, -half_height),
		(half_width, half_height),
		(-half_width, half_height)
	]
	
	rotated_vertices = [rotate_point(x, y, angle) for x, y in vertices]
	return [(center[0] + x, center[1] + y) for x, y in rotated_vertices]

def point_in_rectangle(px, py, rect_vertices):
	""" Check if a point (px, py) is inside the given rectangle defined by its vertices. """
	def sign(x1, y1, x2, y2, x3, y3):
		return (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3)

	b1 = sign(px, py, rect_vertices[0][0], rect_vertices[0][1], rect_vertices[1][0], rect_vertices[1][1]) < 0.0
	b2 = sign(px, py, rect_vertices[1][0], rect_vertices[1][1], rect_vertices[2][0], rect_vertices[2][1]) < 0.0
	b3 = sign(px, py, rect_vertices[2][0], rect_vertices[2][1], rect_vertices[3][0], rect_vertices[3][1]) < 0.0
	b4 = sign(px, py, rect_vertices[3][0], rect_vertices[3][1], rect_vertices[0][0], rect_vertices[0][1]) < 0.0
	
	return b1 == b2 == b3 == b4

def point_circle_distance(px, py, cx, cy):
	""" Calculate the distance between a point (px, py) and a circle's center (cx, cy). """
	return math.sqrt((px - cx) ** 2 + (py - cy) ** 2)

def check_collision(rect_center, width, height, angle, circle_center, radius):
	rect_vertices = rectangle_vertices(rect_center, width, height, angle)
	cx, cy = circle_center

	# Check if circle's center is inside the rectangle
	if point_in_rectangle(cx, cy, rect_vertices):
		return True

	# Check distance from circle's center to the rectangle's edges
	for i in range(len(rect_vertices)):
		x1, y1 = rect_vertices[i]
		x2, y2 = rect_vertices[(i + 1) % len(rect_vertices)]
		
		# Compute the closest point on the edge from the circle's center
		dx = x2 - x1
		dy = y2 - y1
		t = max(0, min(1, ((cx - x1) * dx + (cy - y1) * dy) / (dx * dx + dy * dy)))
		closest_x = x1 + t * dx
		closest_y = y1 + t * dy
		
		if point_circle_distance(closest_x, closest_y, cx, cy) <= radius:
			return True

	return False


