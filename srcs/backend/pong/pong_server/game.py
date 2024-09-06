from typing import List, Dict, Any
import time
import asyncio
from channels.layers import get_channel_layer
from django.http.request import HttpRequest
import requests
from typing import List, Dict, Any, Tuple
import json
from django.conf import settings

# TO DO
# 	-> when to start the loop ?
# 	-> get_data function
# 	-> compute function
# 	-> send_result function
# 	-> reset coordinates function

# Constants
PADDLE_LENGTH = 0.16
PADDLE_THICKNESS = 0.01
PLAYER_SPEED = 0.02

BALL_RADIUS = 0.015
BALL_SPEED = 0.005
MAX_SPEED = 0.03

WEST = 0
EAST = 1
NORTH = 2
SOUTH = 3

START_POS = [{"x": PADDLE_THICKNESS / 2, 'y': 0.5, 'width': PADDLE_THICKNESS, 'height': PADDLE_LENGTH},
			 {"x": 1 - PADDLE_THICKNESS / 2, "y": 0.5,"width": PADDLE_THICKNESS,"height": PADDLE_LENGTH,},
			 {"x": 0.5, "y": PADDLE_THICKNESS / 2,"width": PADDLE_THICKNESS / 2,"height": PADDLE_LENGTH},
			 {"x": 0.5, "y":1 - PADDLE_THICKNESS / 2, "width": PADDLE_THICKNESS / 2,"height": PADDLE_LENGTH}
			 ]

BALL_START = {"x": 0.5, "y": 0.5, "r": BALL_RADIUS, "speed": {"x": BALL_SPEED, "y": 0.002}}

class Player:
	def __init__(self, player_id, position, lives=0, player_type='wall'):
		self.type = player_type
		self.player_id = player_id
		self.position = position
		self.lives = lives
		self.coordinates = START_POS[position]
		self.has_joined = 0

class PongLobby:
	def __init__(self, lobby_id: str, players_list: List[str], lifes,  tournId=None) -> None:
		self.lobby_id = lobby_id
		self.player_num = len(players_list)
		if tournId:
			self.tournId = tournId
		self.ball = None
		# self.players: List[Player] = List(4)
		self.players: List[Player] = [None] * 4
		self.match_id_pos = Dict()
		for i in range(len(players_list)):
			self.players[i] = Player(players_list[i], i, lifes, 'alive')
			self.match_id_pos[players_list[i]] = i
		for i in range(self.player_num, 4):
			self.players[i] = Player('!wall', i)
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

	def check_user(self, lobby_id:str, username:str):
		"""Check that the user belong to the lobby"""
		if username in self.match_id_pos:
			return True
		return False


	def new_game(game_id, player_list: List[str], settings: Dict[str, Any], turnament_id: str = None):
		if PongLobby.check_lobby_id(game_id):
			return
		lobbys_list[game_id] = PongLobby(game_id, player_list, settings['number_life'], turnament_id)

	# init variables
	def init_game(self):
		# ball initialization
		self.ball = {
			"x": 0.5,
			"y": 0.5,
			"r": BALL_RADIUS,
			"speed": {"x": BALL_SPEED, "y": 0.002}
		}

	async def start_game_loop(self):
		self.loop = asyncio.create_task(self.game_loop())

	async def stop_game_loop(self):
		if self.loop:
			self.loop.cancel()

	async def player_join(self, player_id: str) -> bool:
		""" Template of player_list: ["user1", "user1_guest"] """
		if not player_id in self.match_id_pos:
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



	def player_input(self, player_id, input):
		position = self.match_id_pos[player_id]

		if input == "up":
			if position == EAST or position == WEST:
				self.players[position].coordinates['y'] = max(PADDLE_LENGTH / 2, self.players[position].coordinates["y"] - PLAYER_SPEED)
			else:
				self.players[position].coordinates['x'] = max(PADDLE_LENGTH / 2, self.players[position].coordinates["x"] - PLAYER_SPEED)
		elif input == "down":
			if position == EAST or position == WEST:
				self.players[position].coordinates['y'] = min(1 - PADDLE_LENGTH / 2, self.players[position].coordinates["y"] + PLAYER_SPEED)
			else:
				self.players[position].coordinates['x'] = min(1 - PADDLE_LENGTH / 2, self.players[position].coordinates["x"] + PLAYER_SPEED)


	async def	game_loop(self):
		loop_start = time()
		player_channel = get_channel_layer()
		# pregame : check that all players are present
		while time() - loop_start < 60 & self.gameState == 0:
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

		# wait 3 before start
		loop_start = time()
		while time() - loop_start < 3:
			asyncio.sleep(0.05)
			async with self.mut_lock:
				data = self.compute_game()
			await player_channel.group_send(self.lobby_id, data)
		self.gameState = 2

		# play !
			# launch ball
		while self.gameState == 2:
			asyncio.sleep(0.05)
			async with self.mut_lock:
				data = self.compute_game()
			await player_channel.group_send(self.lobby_id, data)
		self.send_result()
		# remove from list


	# GAME LOGIC GOES HERE
	# IF GAME SHOULD END BECAUSE ONE PLAYER WON SET gameState to 3
	# return the coordinates in a JSON form
	def	compute_game(self):
		self.move_ball()
		self.collision_logic()
		self.check_goals()
		self.check_eliminated_players()
		if self.check_winning_condition():
			self.gameState = 3

		return self.generate_JSON()


	def move_ball(self):
		self.ball["x"] += self.ball["speed"]["x"]
		self.ball["y"] += self.ball["speed"]["y"]

	def	collision_logic(self):
		self.wall_collision()
		self.paddle_collision()

	def wall_collision(self):
		if self.player[NORTH]["player_type"] != "player" and self.ball["y"] - BALL_RADIUS <= 0 and self.ball["speed"]["y"] < 0:
			self.ball["speed"]["y"] *= -1
		elif self.player[SOUTH]["player_type"] != "player" and self.ball["y"] + BALL_RADIUS >= 1 and self.ball["speed"]["y"] > 0:
			self.ball["speed"]["y"] *= -1
		elif self.player[WEST]["player_type"] != "player" and self.ball["x"] - BALL_RADIUS <= 0 and self.ball["speed"]["x"] < 0:
			self.ball["speed"]["x"] *= -1
		elif self.player[EAST]["player_type"] != "player" and self.ball["x"] + BALL_RADIUS >= 1 and self.ball["speed"]["x"] > 0:
			self.ball["speed"]["x"] *= -1

	def paddle_collision(self):
		for direction in range(0, self.player_num):
			if self.player[direction]["player_type"] == "player":
				if rectCircleCollision(self.player[direction]["x"] - self.player[direction]["width"] / 2,
										self.player[direction]["y"] - self.player[direction]["height"] / 2,
										self.player[direction]["width"],
										self.player[direction]["height"],
										self.ball["x"],
										self.ball["y"],
										self.ball["r"])
					paddle_rebound(direction)

	def paddle_rebound(self, direction):
		if direction == WEST or direction == EAST:
			self.ball["speed"]["x"] *= -1
		elif direction == NORTH or direction == SOUTH:
			self.ball["speed"]["y"] *= -1

	def rectCircleCollision(rectX, rectY, width, height, circX, circY, radius):
		closestX = max(rectX, min(circX, rectX + width))
		closestY = max(rectY, min(circY, rectY + height))

		distanceX = circX - closestX
		distanceY = circY - closestY
		distanceSquared = distanceX**2 + distanceY**2

		return distanceSquared <= radius**2

	def check_goals(self)
	 	#meh, pue un peu la merde dans le cas des buts marques tres pres du bord
		goal_scored = False
		if self.ball["x"] < 0 and self.player[WEST]["player_type"] == "player":
			self.player[WEST]["live"] -= 1
			goal_scored = True
		elif self.ball["x"] > 1 and self.player[EAST]["player_type"] == "player":
			self.player[EAST]["live"] -= 1
			goal_scored = True
		elif self.ball["y"] < 0 and self.player[NORTH]["player_type"] == "player":
			self.player[NORTH]["live"] -= 1
			goal_scored = True
		elif self.ball["y"] > 1 and self.player[SOUTH]["player_type"] == "player":
			self.player[SOUTH]["live"] -= 1
			goal_scored = True

		if goal_scored:
			self.reset_ball()

	def	reset_ball():
		self.ball["x"] = 0.5
		self.ball["y"] = 0.5
		self.ball["speed"]["x"] = 0.005
		self.ball["speed"]["y"] = 0.002	# a modifier par la suite selon le perdant OU faire tourner le service


	def check_eliminated_players(self)
		for direction in range(0, self.player_num):
			if self.player[direction]["live"] == 0
				self.player["player_type"] = "eliminated_player"

	def check_winning_condition(self)
		count = 0
		for direction in range(0, self.player_num):
			if self.player[direction]["player_type"] == "player"
				count += 1
		return count <= 1


	def generate_JSON(self) -> Dict[str, Any]:
		return {
			'ball.x': self.ball["x"],
			'ball.y': self.ball["y"],
			'playerW.x': self.player[WEST]["x"],
			'playerW.y': self.player[WEST]["y"],
			'playerE.x': self.player[EAST]["x"],
			'playerE.y': self.player[EAST]["y"]
		}





	# game logic
# 	def check_points():
# 	 	#meh, pue un peu la merde dans le cas des buts marques tres pres du bord
# 		if ball["x"] < 0 and side[WEST] == "player":
# 			player[WEST]["life"] -= 1
# 		elif ball["x"] > 1 and side[EAST] == "player":
# 			player[EAST]["life"] -= 1
# 		elif ball["y"] < 0 and side[NORTH] == "player":
# 			player[NORTH]["life"] -= 1
# 		elif ball["y"] > 1 and side[SOUTH] == "player":
# 			player[SOUTH]["life"] -= 1

		# check for dead players
		for i in range(len(player_list)):
			if player[i]["life"] <= 0:
				side[i] == "wall"
	# # game logic
	# def check_points()
	#  	#meh, pue un peu la merde dans le cas des buts marques tres pres du bord
	# 	if ball["x"] < 0 and side[WEST] == "player":
	# 		player[WEST]["life"] -= 1
	# 	elif ball["x"] > 1 and side[EAST] == "player":
	# 		player[EAST]["life"] -= 1
	# 	elif ball["y"] < 0 and side[NORTH] == "player":
	# 		player[NORTH]["life"] -= 1
	# 	elif ball["y"] > 1 and side[SOUTH] == "player":
	# 		player[SOUTH]["life"] -= 1

	# 	# check for dead players
	# 	for i in range(len(player_list)):
	# 		if player[i]["life"] <= 0:
	# 			side[i] == "wall"

# 	def check_winning_condition():
# 		alive = 0
# 		for i in range(len(player_list)):
# 			if player[i]["life"] > 0:
# 				alive += 1
# 		return alive <= 1
# 	# def check_winning_condition()
# 	# 	alive = 0
# 	# 	for i in range(len(player_list)):
# 	# 		if player[i]["life"] > 0:
# 	# 			alive += 1
# 	# 	return alive <= 1


# 	# collision logic  ############
# 	def wall_collision():
# 		if self.side[NORTH] == "wall" and self.ball["y"] - BALL_RADIUS <= 0 and self.ball["speed"]["y"] < 0:
# 			self.ball["speed"]["y"] *= -1
# 		elif self.side[SOUTH] == "wall" and self.ball["y"] + BALL_RADIUS >= 1 and self.ball["speed"]["y"] > 0:
# 			self.ball["speed"]["y"] *= -1
# 		elif self.side[WEST] == "wall" and self.ball["x"] - BALL_RADIUS <= 0 and self.ball["speed"]["x"] < 0:
# 			self.ball["speed"]["x"] *= -1
# 		elif self.side[EAST] == "wall" and self.ball["x"] + BALL_RADIUS >= 1 and self.ball["speed"]["x"] > 0:
# 			self.ball["speed"]["x"] *= -1
# 	# # collision logic  ############
# 	# def wall_collision()
# 	# 	if self.side[NORTH] == "wall" and self.ball["y"] - BALL_RADIUS <= 0 and self.ball["speed"]["y"] < 0:
# 	# 		self.ball["speed"]["y"] *= -1
# 	# 	elif self.side[SOUTH] == "wall" and self.ball["y"] + BALL_RADIUS >= 1 and self.ball["speed"]["y"] > 0:
# 	# 		self.ball["speed"]["y"] *= -1
# 	# 	elif self.side[WEST] == "wall" and self.ball["x"] - BALL_RADIUS <= 0 and self.ball["speed"]["x"] < 0:
# 	# 		self.ball["speed"]["x"] *= -1
# 	# 	elif self.side[EAST] == "wall" and self.ball["x"] + BALL_RADIUS >= 1 and self.ball["speed"]["x"] > 0:
# 	# 		self.ball["speed"]["x"] *= -1

# 	def paddle_collision():
# 		for direction in range(0, 4):
# 			if self.side[direction] == "player":
# 				if rectCircleCollision(self.player[i]["x"] - self.player[i]["width"] / 2,
# 										self.player[i]["y"] - self.player[i]["height"] / 2,
# 										self.player[i]["width"],
# 										self.player[i]["height"],
# 										self.ball["x"],
# 										self.ball["y"],
# 										self.ball["r"])
# 					paddle_rebound(direction)

	def paddle_rebound(self, direction):	# simple rebound
		if direction == WEST:
			self.ball["speed"]["x"] *= -1
		elif direction == EAST:
			self.ball["speed"]["x"] *= -1
		elif direction == NORTH:
			self.ball["speed"]["y"] *= -1
		elif direction == SOUTH:
			self.ball["speed"]["y"] *= -1
	# def paddle_collision()
	# 	for direction in range(0, 4):
	# 		if self.side[direction] == "player":
	# 			if rectCircleCollision(self.player[i]["x"] - self.player[i]["width"] / 2,
	# 									self.player[i]["y"] - self.player[i]["height"] / 2,
	# 									self.player[i]["width"],
	# 									self.player[i]["height"],
	# 									self.ball["x"],
	# 									self.ball["y"],
	# 									self.ball["r"])
	# 				paddle_rebound(direction)

	# def paddle_rebound(direction)	# simple rebound
	# 	if direction == WEST:
	# 		self.ball["speed"]["x"] *= -1
	# 	elif direction == EAST:
	# 		self.ball["speed"]["x"] *= -1
	# 	elif direction == NORTH:
	# 		self.ball["speed"]["y"] *= -1
	# 	elif direction == SOUTH:
	# 		self.ball["speed"]["y"] *= -1

# 	# def rectCircleCollision(rectX, rectY, width, height, circX, circY, radius):
# 	# 	closestX = max(rectX, min(circX, rectX + width))
# 	# 	closestY = max(rectY, min(circY, rectY + height))

# 	# 	distanceX = circX - closestX
# 	# 	distanceY = circY - closestY
# 	# 	distanceSquared = distanceX**2 + distanceY**2

# 	# 	return distanceSquared <= radius**2

	def get_winner(self):
		for i in range(self.player_num):
			if self.players[i].has_joined == 1:
				return self.players[i].player_id


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
