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

PADDLE_MAX_X = [-0.8, 1.2]
PADDLE_MIN_X = [-1.2, 0.8]
PADDLE_MAX_Y = [1, 1,]
PADDLE_MIN_Y = [-1, -1]
PADDLE_LEFT_DIR = [-1, 1]

PADDLE_LENGTH = 0.1
PADDLE_THICKNESS = 0.02
PLAYER_SPEED = 0.01

BALL_RADIUS = 0.013
MIN_SPEED = 0.02
MAX_SPEED = 0.04		#must be less than BALL_RADIUS + PADDLE_THICKNESS to avoid the ball passing through

PADDLE_REBOUND_ANGLE = (math.pi / 180) * 35
PLAYING_FIELD_RADIUS = 2.5 #centered on the middle of the table (0,0)
REBOUND_LINE_X = 0.4

WEST = 0
EAST = 1

START_POS = [{"x": -TABLE_LENGHT / 2 + PADDLE_THICKNESS / 2, "y": 0, "angle": math.pi, 'width': PADDLE_THICKNESS, 'height': PADDLE_LENGTH},
			{"x": TABLE_LENGHT / 2 - PADDLE_THICKNESS / 2, "y": 0, "angle": 0,"width": PADDLE_THICKNESS,"height": PADDLE_LENGTH,},
			]

BALL_START = {"x": 0, "y": 0, "r": BALL_RADIUS, "speed": {"x": 0, "y": 0}, "last_hit": {"x": 0, "y": 0}, "is_out": False}


class Player3D:
	def __init__(self, player_id, side):
		self.player_id = player_id
		self.side = side
		self.points = 0
		self.coordinates = START_POS[side]
		self.has_joined = 0

		# AI specific variables
		self.last_time = int(time.time())
		self.destination = {"x": 0, "y": 0}

	def AI_behavior(self, ballX, ballY, ballSpeedX, ballSpeedY) -> str:
		if int(time.time()) != self.last_time:
			self.calculate_destination(ballX, ballY, ballSpeedX, ballSpeedY)
			self.last_time = int(time.time())
		
		position = self.coordinates["y"]
		if self.destination["y"] < position - PLAYER_SPEED:
			if self.side == WEST:
				return "right"
			else:
				return "left"
		elif self.destination["y"] > position + PLAYER_SPEED:
			if self.side == WEST:
				return "left"
			else:
				return "right"
		return ""
	
	def calculate_destination(self, ballX, ballY, ballSpeedX, ballSpeedY):
		self.destination["x"] = 0
		self.destination["y"] = 0
		if self.side == WEST and ballSpeedX < 0 or self.side == EAST and ballSpeedX > 0:
			self.destination["y"] = self.calculate_impact(ballX, ballY, ballSpeedX, ballSpeedY)
		print(f"player {self.side} new destination : {self.destination}")
		

	def calculate_impact(self, ballX, ballY, ballSpeedX, ballSpeedY):
		fpos_x = ballX
		fpos_y = ballY
		fspeed_x = ballSpeedX
		fspeed_y = ballSpeedY

		while True:
			fpos_x += fspeed_x
			fpos_y += fspeed_y
			if self.side == WEST and fpos_x <= self.coordinates["x"]:
				return fpos_y
			elif self.side == EAST and fpos_x >= self.coordinates["x"]:
				return fpos_y


class PongLobby3D:
	service_direction = -1
	service_count = 0
	is_service = True

	def __init__(self, lobby_id: str, players_list: List[str],  tournId=None, settings: Dict[str, Any] = {}) -> None:
		self.settings = settings
		self.lobby_id = lobby_id
		self.player_num = len(players_list)
		if tournId:
			self.tournId = tournId
		self.ball = None
		self.players: List[Player3D] = []
		self.match_id_pos = {}
		for i in range(2):
			self.players.append(Player3D(players_list[i], i))
			self.match_id_pos[players_list[i]] = i
		self.ball = BALL_START
		self.gameState = 0
		self.mut_lock = asyncio.Lock()
		self.loop = None
		self.waiting_for = self.player_num
		self.winner = None

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
		print(f"{player_id} joined the game (waiting for : {self.waiting_for})")
		if not self.loop:
			await self.start_game_loop()
		return True

	def player_leave(self, player_id: str):
		""" Template of player_list: ["user1", "user1_guest"] """
		self.waiting_for += 1
		print(f"{player_id} left the game (waiting for : {self.waiting_for})")

	def send_result(self):
		pass
		# API call to send result to matchmaking
			# -> gameState == 3 match was played -> get stats in self and send them
			# -> gameState == 0 game was canceled
		# should the matchmaking delete the PongLobby3D upon receiving the result ?

	""" 
	add end game
	refuse input for eliminated players

	"""


	def player_input(self, player_id, input):
		if player_id not in self.match_id_pos:
			return
		side = self.match_id_pos[player_id]

		# SIDE VIEW CONTROLS
		# if input == "up":
		# 	self.players[side].coordinates['y'] = min(PADDLE_MAX_Y[side], self.players[side].coordinates['y'] + PLAYER_SPEED)
		# elif input == "down":
		# 	self.players[side].coordinates['y'] = max(PADDLE_MIN_Y[side], self.players[side].coordinates['y'] - PLAYER_SPEED)
		# elif input == "left":
		# 	self.players[side].coordinates['x'] = max(PADDLE_MIN_X[side], self.players[side].coordinates['x'] - PLAYER_SPEED)
		# elif input == "right":
		# 	self.players[side].coordinates['x'] = min(PADDLE_MAX_X[side], self.players[side].coordinates['x'] + PLAYER_SPEED)
		# self.set_paddle_angle()

		# POV VIEW CONTROLS
		if (input == "left" and side == WEST) or (input == "right" and side == EAST):
			self.players[side].coordinates['y'] = min(PADDLE_MAX_Y[side], self.players[side].coordinates['y'] + PLAYER_SPEED)
		elif (input == "right" and side == WEST) or (input == "left" and side == EAST):
			self.players[side].coordinates['y'] = max(PADDLE_MIN_Y[side], self.players[side].coordinates['y'] - PLAYER_SPEED)
		elif (input == "down" and side == WEST) or (input == "up" and side == EAST):
			self.players[side].coordinates['x'] = max(PADDLE_MIN_X[side], self.players[side].coordinates['x'] - PLAYER_SPEED)
		elif (input == "up" and side == WEST) or (input == "down" and side == EAST):
			self.players[side].coordinates['x'] = min(PADDLE_MAX_X[side], self.players[side].coordinates['x'] + PLAYER_SPEED)
		self.set_paddle_angle()


	async def	game_loop(self):
		try:
			loop_start = time.time()
			player_channel = get_channel_layer()
			# pregame : check that all players are present
			while time.time() - loop_start < 3600 and self.gameState == 0:
				await asyncio.sleep(0.016)
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
				await asyncio.sleep(0.016)
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
		self.check_missed_rebound()
		self.compute_AI()
		if self.check_winning_condition():
			self.gameState = 3
		return self.generate_JSON()

	def set_paddle_angle(self):
		self.players[WEST].coordinates["angle"] = -math.atan2(self.players[WEST].coordinates["y"], -self.players[WEST].coordinates["x"])
		self.players[EAST].coordinates["angle"] = -math.atan2(self.players[EAST].coordinates["y"], -self.players[EAST].coordinates["x"])

	def compute_AI(self):
		for i in range(self.player_num):
			if self.players[i].player_id.startswith("!AI"):
				input = self.players[i].AI_behavior(self.ball["x"], self.ball["y"], self.ball["speed"]["x"], self.ball["speed"]["y"])
				self.player_input(self.players[i].player_id, input)






	def move_ball(self):
		if not self.is_service:
			self.ball['x'] += self.ball["speed"]['x']
			self.ball['y'] += self.ball["speed"]['y']

	def	collision_logic(self):
		if self.ball["is_out"] == True:
			return
		if self.ball["x"] < PADDLE_MAX_X[0] + 0.1 and self.ball["last_hit"]["x"] >= 0: # -0.1 and + 0.1 si jamais la raquette est sur sa limite et un bout depasse du fait de l'angle de la raquette	
			direction = WEST
		elif self.ball["x"] > PADDLE_MIN_X[1] - 0.1 and self.ball["last_hit"]["x"] <= 0:
			direction = EAST
		else:
			return
		
		if check_collision((self.players[direction].coordinates["x"], self.players[direction].coordinates["y"]),
										self.players[direction].coordinates["width"],
										self.players[direction].coordinates["height"],
										self.players[direction].coordinates["angle"],
										(self.ball["x"],self.ball["y"]),
										self.ball["r"]):
			self.is_service = False
			# save the collision coordinates
			self.ball["last_hit"]["x"] = self.ball["x"]
			self.ball["last_hit"]["y"] = self.ball["y"]
			# bounce the ball
			self.collision_rebound()
			# change speed
			self.change_ball_speed()
		
	def	change_ball_speed(self):
		# set speed depending on the value of player.x when hitting
			# between 0 (close to the net) and 1 when far from the net
		acceleration = (abs(self.ball["last_hit"]["x"]) - PADDLE_MIN_X[1]) / (PADDLE_MAX_X[1] - PADDLE_MIN_X[1])

		speed = MIN_SPEED + (MAX_SPEED - MIN_SPEED) * acceleration

		current_speed = math.sqrt(self.ball["speed"]["x"]**2 + self.ball["speed"]["y"]**2)
		scale = speed / current_speed
		self.ball["speed"]["x"] *= scale
		self.ball["speed"]["y"] *= scale


	# def	change_ball_speed(self):
		# # normalize speed
		# speed = math.sqrt(self.ball["speed"]["x"]**2 + self.ball["speed"]["y"]**2)
		# # Accelerate the ball depending on how far from the net it has been hit
		# acceleration = abs(self.ball["last_hit"]["x"]) + 0.2 #between 0.8 and 1.4
		# new_speed = speed * acceleration
		# # check for boundaries
		# if new_speed < MIN_SPEED:
		# 	new_speed = MIN_SPEED
		# elif new_speed > MAX_SPEED:
		# 	new_speed = MAX_SPEED
		# # change ball speed
		# self.ball["speed"]["x"] *= new_speed / speed
		# self.ball["speed"]["y"] *= new_speed / speed

	# PADDLE ANGLE REFLECTION
	def collision_rebound(self):
		# check the concerned paddle
		if self.ball["last_hit"]["x"] < 0:
			direction = WEST
		else:
			direction = EAST

		ball_trajectory = ((self.ball["x"] + self.ball["speed"]["x"], self.ball["y"] + self.ball["speed"]["y"]), (self.ball["x"], self.ball["y"]))

		x1 = self.players[direction].coordinates["x"] - (self.players[direction].coordinates["height"] / 2) * math.sin(self.players[direction].coordinates["angle"])
		y1 = self.players[direction].coordinates["y"] - (self.players[direction].coordinates["height"] / 2) * math.cos(self.players[direction].coordinates["angle"])
		x2 = 2 * self.players[direction].coordinates["x"] - x1
		y2 = 2 * self.players[direction].coordinates["y"] - y1
		paddle_segment = ((x1, y1), (x2, y2))
		
		isIntersect, xInter, yInter = line_intersection(ball_trajectory, paddle_segment)

		relative_intersect = 0.5 - ((y2 - yInter) / (y2 - y1))
		bounce_angle = relative_intersect * (PADDLE_REBOUND_ANGLE)
		angle = self.players[direction].coordinates["angle"] + bounce_angle

		speed = math.sqrt(self.ball["speed"]["x"]**2 + self.ball["speed"]["y"]**2)
		self.ball["speed"]["x"] = speed * math.cos(angle)
		self.ball["speed"]["y"] = speed * math.sin(angle)


	def check_missed_rebound(self):
		if self.ball["speed"]["x"] > 0: #going east
			rebound_line = ((REBOUND_LINE_X, 5), (REBOUND_LINE_X, -5))
		else:
			rebound_line = ((-REBOUND_LINE_X, 5), (-REBOUND_LINE_X, -5))

		ball_trajectory = ((self.ball["x"], self.ball["y"]), (self.ball["x"] + self.ball["speed"]["x"], self.ball["y"] + self.ball["speed"]["y"]))
		isIntersect, interX, interY = line_intersection(rebound_line, ball_trajectory)

		print("is intersect = ", isIntersect)
		print("interX = ", interX)
		print("interY = ", interY)

		if isIntersect and not -0.5 < interY < 0.5:
			print ("ball is out")
			self.ball["is_out"] = True



	def check_goals(self):
		point_scored = False
		# if ball is out of bound
		if (self.ball["x"]**2 + self.ball["y"]**2) >  PLAYING_FIELD_RADIUS**2:
			# check last_hit x to know last player who touched the ball (attacking player)
			if self.ball["last_hit"]["x"] < 0:
				attacker = WEST
			else:
				attacker = EAST
			# if the ball crossed the rebound line on the table, on the defending player side
			if self.ball_rebound_on_table(not attacker):
				# point for attacking player
				self.players[attacker].points += 1
				point_scored = True
				print(f"{self.players[attacker].player_id} marked a point !")
			else:
				# point for defending player
				self.players[not attacker].points += 1
				point_scored = True
				print(f"{self.players[not attacker].player_id} marked a point !")
		# if point scored reset ball
		if point_scored == True:
			print(f"score is {self.players[WEST].points} to {self.players[EAST].points}")
			self.reset_ball()

	def check_winning_condition(self):
		if self.players[0].points >= 11 and self.players[0].points >= self.players[1].points + 2:
			print("Winner is :", self.players[0].player_id)
			return True
		elif self.players[1].points >= 11 and self.players[1].points >= self.players[0].points + 2:
			print("Winner is:", self.players[1].player_id)
			return True
		return False

	def ball_rebound_on_table(self, defender):
		rebound_line_x = REBOUND_LINE_X
		if defender == WEST:
			rebound_line_x = -REBOUND_LINE_X

		ball_trajectory = (((self.ball["x"] + self.ball["speed"]["x"]),(self.ball["y"] + self.ball["speed"]["y"])), ((self.ball["x"]),(self.ball["y"])))
		rebound_line = (((rebound_line_x),(0.5)), ((rebound_line_x),(-0.5)))

		isIntersect, xInter, yInter = line_intersection(ball_trajectory, rebound_line)

		if isIntersect and -0.5 < yInter < 0.5:
			return True
		return False

	def	reset_ball(self):
		self.is_service = True

		self.ball["last_hit"]['x'] = -REBOUND_LINE_X * self.service_direction
		self.ball["last_hit"]['y'] = 0

		self.ball['x'] =  (TABLE_LENGHT/2) * self.service_direction
		self.ball['y'] = 0

		self.ball["speed"]["x"] = MIN_SPEED * self.service_direction
		self.ball["speed"]["y"] = 0

		self.ball["is_out"] = False

		self.players[WEST].coordinates["x"] = -TABLE_LENGHT/2 - 0.1
		self.players[WEST].coordinates["y"] = 0
		self.players[EAST].coordinates["x"] = TABLE_LENGHT/2 + 0.1
		self.players[EAST].coordinates["y"] = 0

		# alternate every 2 services
		self.service_count += 1
		if self.service_count >= 2:
			self.service_count = 0
			self.service_direction *= -1


	def generate_JSON(self) -> Dict[str, Any]:
		json = {
			"type": "send_game_state",
			"ball_x": self.ball["x"],
			"ball_y": self.ball["y"],
			"ball_r": self.ball["r"],
			"ball_speed_x": self.ball["speed"]["x"],
			"ball_speed_y": self.ball["speed"]["y"],
			"ball_last_hit_x": self.ball["last_hit"]["x"],
			"ball_last_hit_y": self.ball["last_hit"]["y"],
			"ball_is_out": self.ball["is_out"],
			"is_service": self.is_service
		}

		for index in range(2):
			json[f"player{index}_id"] = self.players[index].player_id
			json[f"player{index}_points"] = self.players[index].points
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




##################################################### COLLISION

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


########### LINE INTERSECT

def line_intersection(line1, line2):
	xdiff = (line1[0][0] - line1[1][0], line2[0][0] - line2[1][0])
	ydiff = (line1[0][1] - line1[1][1], line2[0][1] - line2[1][1])

	def det(a, b):
		return a[0] * b[1] - a[1] * b[0]

	div = det(xdiff, ydiff)
	if div == 0:
		return False, 0, 0

	d = (det(*line1), det(*line2))
	x = det(d, xdiff) / div
	y = det(d, ydiff) / div
	return True, x, y


def segments_intersect(p1, q1, p2, q2):
	def cross_product(o, a, b):
		return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

	def is_point_on_segment(p, seg_start, seg_end):
		return min(seg_start[0], seg_end[0]) <= p[0] <= max(seg_start[0], seg_end[0]) and \
			min(seg_start[1], seg_end[1]) <= p[1] <= max(seg_start[1], seg_end[1])

	o1 = cross_product(p1, q1, p2)
	o2 = cross_product(p1, q1, q2)
	o3 = cross_product(p2, q2, p1)
	o4 = cross_product(p2, q2, q1)

	if o1 * o2 < 0 and o3 * o4 < 0:
		return True
	# p1, q1 and p2 are collinear and p2 lies on segment p1q1
	if o1 == 0 and is_point_on_segment(p2, p1, q1):
		return True
	# p1, q1 and q2 are collinear and q2 lies on segment p1q1
	if o2 == 0 and is_point_on_segment(q2, p1, q1):
		return True
	# p2, q2 and p1 are collinear and p1 lies on segment p2q2
	if o3 == 0 and is_point_on_segment(p1, p2, q2):
		return True
	# p2, q2 and q1 are collinear and q1 lies on segment p2q2
	if o4 == 0 and is_point_on_segment(q1, p2, q2):
		return True
	# If none of the cases
	return False


