from typing import List, Dict, Any
import time
import asyncio


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
	def _init__(self, player_id, player_position, player_life):
		self.player_id = player_id
		self.player_position = player_position
		self.player_lifes = player_life
		self.player_coordinates = START_POS[player_position]

class PongLobby:

	# Constructor
	def __init__(self, lobby_id: str, players_list, lifes,  tournId=None) -> None:
		self.lobby_id = lobby_id
		self.player_num = len(players_list)
		if tournId:
			self.tournId = tournId
		self.ball = None
		self.sides = ["wall"] * 4
		self.players = dict()
		for i in range(len(players_list)):
			self.players[players_list[i]](Player(players_list[i], i, lifes))
			self.sides[i] = "player"
		self.ball = BALL_START
		self.gameState = 0
		self.mut_lock = asyncio.Lock()
		self.loop = asyncio.create_task(self.game_loop())
		self.waiting_for = self.player_num



	# # init variables
	# def init_game(self, game_id, player_list: List[str]):
	# 	# ball initialization
	# 	self.ball = {
	# 		"x": 0.5,
	# 		"y": 0.5,
	# 		"r": BALL_RADIUS,
	# 		"speed": {"x": BALL_SPEED, "y": 0.002}
	# 	}

	# 	# player initialization
	# 	for i in range(len(player_list)):
	# 		if i == WEST:
	# 			self.players[i] = {
	# 				"x": PADDLE_THICKNESS / 2,
	# 				"y": 0.5,
	# 				"width": PADDLE_THICKNESS,
	# 				"height": PADDLE_LENGTH,
	# 				"id": player_list[i],
	# 				"ready": 0,
	# 				"life": 3
	# 			}
	# 		elif i == EAST:
	# 			self.players[i] = {
	# 				"x": 1 - PADDLE_THICKNESS / 2,
	# 				"y": 0.5,
	# 				"width": PADDLE_THICKNESS,
	# 				"height": PADDLE_LENGTH,
	# 				"id": player_list[i],
	# 				"ready": 0,
	# 				"life": 3
	# 			}
	# 		elif i == NORTH:
	# 			self.players[i] = {
	# 				"x": 0.5,
	# 				"y": PADDLE_THICKNESS / 2,
	# 				"width": PADDLE_LENGTH,
	# 				"height": PADDLE_THICKNESS,
	# 				"id": player_list[i],
	# 				"ready": 0,
	# 				"life": 3
	# 			}
	# 		elif i == SOUTH:
	# 			self.players[i] = {
	# 				"x": 0.5,
	# 				"y": 1 - PADDLE_THICKNESS / 2,
	# 				"width": PADDLE_LENGTH,
	# 				"height": PADDLE_THICKNESS,
	# 				"id": player_list[i],
	# 				"ready": 0,
	# 				"life": 3
	# 			}
	# 		self.sides[i] = "player"

	def player_input(self, player_id, input):
		# get the player index from the player_id
		i = -1
		for index, player in players.items():
			if player["id"] == player_id:
				i = index
				break

		if input == "joined":
			self.player[i]["ready"] = 1

		elif input == "up":
			if i == EAST or i == WEST:
				self.player[i]["y"] = max(PADDLE_LENGTH / 2, self.player[i]["y"] - PLAYER_SPEED)
			else
				self.player[i]["x"] = max(PADDLE_LENGTH / 2, self.player[i]["x"] - PLAYER_SPEED)
		elif input == "down":
			if i == EAST or i == WEST:
				self.player[i]["y"] = min(1 - PADDLE_LENGTH / 2, self.player[i]["y"] + PLAYER_SPEED)
			else:
				self.player[i]["x"] = min(1 - PADDLE_LENGTH / 2, self.player[i]["x"] + PLAYER_SPEED)

	async def	game_loop(self):
		loop_start = time()

		# pregame : check that all players are present
		while time() - loop_start < 60 & self.gameState == 0:
			asyncio.sleep(0.5)
			async with self.mut_lock:
				if self.waiting_for == 0:
					self.gameState = 1
				

		# in case players coundlnt connect
		if gameState == 0:
			self.cancelGame()

		# countdown
			# game is about to start
		self.startingMessage()
		sleep(3)


		while gameState == 1:
			async with self.mut_lock:
				self.ball["x"] += self.ball["speed"]["x"]
				self.ball["y"] += self.ball["speed"]["y"]
				wall_collision()
				paddle_collision()
				check_points()
				if check_winning_condition() == 1:
					gameState == 0


		self.endingMessage()
		sleep(3)

	def get_state(self) -> Dict[str, Any]:
		return {
			'ball.x': self.ball["x"],
			'ball.y': self.ball["y"],
			'playerW.x': self.player[WEST]["x"],
			'playerW.y': self.player[WEST]["y"],
			'playerE.x': self.player[EAST]["x"],
			'playerE.y': self.player[EAST]["y"]
		}




	# game logic
	def check_points():
	 	#meh, pue un peu la merde dans le cas des buts marques tres pres du bord
		if ball["x"] < 0 and side[WEST] == "player":
			player[WEST]["life"] -= 1
		elif ball["x"] > 1 and side[EAST] == "player":
			player[EAST]["life"] -= 1
		elif ball["y"] < 0 and side[NORTH] == "player":
			player[NORTH]["life"] -= 1
		elif ball["y"] > 1 and side[SOUTH] == "player":
			player[SOUTH]["life"] -= 1

		# check for dead players
		for i in range(len(player_list)):
			if player[i]["life"] <= 0:
				side[i] == "wall"

	def check_winning_condition():
		alive = 0
		for i in range(len(player_list)):
			if player[i]["life"] > 0:
				alive += 1
		return alive <= 1


	# collision logic  ############
	def wall_collision():
		if self.side[NORTH] == "wall" and self.ball["y"] - BALL_RADIUS <= 0 and self.ball["speed"]["y"] < 0:
			self.ball["speed"]["y"] *= -1
		elif self.side[SOUTH] == "wall" and self.ball["y"] + BALL_RADIUS >= 1 and self.ball["speed"]["y"] > 0:
			self.ball["speed"]["y"] *= -1
		elif self.side[WEST] == "wall" and self.ball["x"] - BALL_RADIUS <= 0 and self.ball["speed"]["x"] < 0:
			self.ball["speed"]["x"] *= -1
		elif self.side[EAST] == "wall" and self.ball["x"] + BALL_RADIUS >= 1 and self.ball["speed"]["x"] > 0:
			self.ball["speed"]["x"] *= -1

	def paddle_collision():
		for direction in range(0, 4):
			if self.side[direction] == "player":
				if rectCircleCollision(self.player[i]["x"] - self.player[i]["width"] / 2,
										self.player[i]["y"] - self.player[i]["height"] / 2,
										self.player[i]["width"],
										self.player[i]["height"],
										self.ball["x"],
										self.ball["y"],
										self.ball["r"])
					paddle_rebound(direction)

	def paddle_rebound(direction)	# simple rebound
		if direction == WEST:
			self.ball["speed"]["x"] *= -1
		elif direction == EAST:
			self.ball["speed"]["x"] *= -1
		elif direction == NORTH:
			self.ball["speed"]["y"] *= -1
		elif direction == SOUTH:
			self.ball["speed"]["y"] *= -1

	def rectCircleCollision(rectX, rectY, width, height, circX, circY, radius):
		closestX = max(rectX, min(circX, rectX + width))
		closestY = max(rectY, min(circY, rectY + height))

		distanceX = circX - closestX
		distanceY = circY - closestY
		distanceSquared = distanceX**2 + distanceY**2

		return distanceSquared <= radius**2


lobbys_list : Dict[str, PongLobby] = []
