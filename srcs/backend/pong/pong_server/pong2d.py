
import time
import math
import random
import asyncio
from pong_server.game import PongLobby, Player
from django.http.request import HttpRequest
import requests
from typing import List, Dict, Any, Tuple
import json
from django.conf import settings
import traceback

# Constants
PADDLE_LENGTH = 0.16
PADDLE_THICKNESS = 0.05
PLAYER_SPEED = 0.016

BALL_RADIUS = 0.015
BALL_SERVICE_SPEED = 0.005
BALL_SPEED = 0.01
MAX_SPEED = 0.04		#must be less than 2*BALL_RADIUS + PADDLE_THICKNESS to avoid the ball passing through

WEST = 0
EAST = 1
NORTH = 2
SOUTH = 3


START_POS = [{"x": -0.5 - PADDLE_THICKNESS / 2, 'y': 0, 'width': PADDLE_THICKNESS, 'height': PADDLE_LENGTH},
			 {"x": 0.5 + PADDLE_THICKNESS / 2, "y": 0,"width": PADDLE_THICKNESS,"height": PADDLE_LENGTH,},
			 {"x": 0, "y": 0.5 + PADDLE_THICKNESS / 2, "width": PADDLE_LENGTH,"height": PADDLE_THICKNESS},
			 {"x": 0, "y": -0.5 - PADDLE_THICKNESS / 2,"width": PADDLE_LENGTH,"height": PADDLE_THICKNESS},
			 ]

BALL_START = {"x": 0, "y": 0, "r": BALL_RADIUS, "speed": {"x": 0, "y": 0}, "last_hit": -1}

class Player2D(Player):

	def __init__(self, player_id, side, lives=0, type='wall'):
		super().__init__(player_id, side, lives)
		print("player constructor")
		self.type = type
		self.destination = 0
		self.coordinates = START_POS[side]


	def AI_behavior(self, ballX, ballY, ballSpeedX, ballSpeedY) -> str:
		if int(time.time()) != self.last_time:
			self.calculate_destination(ballX, ballY, ballSpeedX, ballSpeedY)
			self.last_time = int(time.time())

		if self.side == WEST or self.side == EAST:
			position = self.coordinates["y"]
			if self.destination < position - PLAYER_SPEED:
				return "down"
			elif self.destination > position + PLAYER_SPEED:
				return "up"
		else:
			position = self.coordinates["x"]
			if self.destination < position - PLAYER_SPEED:
				return "up"
			elif self.destination > position + PLAYER_SPEED:
				return "down"
		return ""
	
	def calculate_destination(self, ballX, ballY, ballSpeedX, ballSpeedY):
		self.destination = 0
		if self.side == WEST and ballSpeedX < 0 or self.side == EAST and ballSpeedX > 0 or self.side == NORTH and ballSpeedY > 0 or self.side == SOUTH and ballSpeedY < 0:
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
			if not -0.5 + BALL_RADIUS < fpos_x < 0.5 - BALL_RADIUS:
				if self.side == WEST or self.side == EAST:
					return fpos_y
				else:
					fspeed_x *= -1 
			if not -0.5 + BALL_RADIUS < fpos_y < 0.5 - BALL_RADIUS:
				if self.side == NORTH or self.side == SOUTH:
					return fpos_x
				else:
					fspeed_y *= -1 



class PongLobby2D(PongLobby):
	service_direction = 0
	
	def __init__(self, lobby_id: str, players_list: List[str], settings: Dict[str, Any], tournId=None) -> None:
		super().__init__(lobby_id, players_list, settings, tournId)
		for i in range(len(players_list)):
			self.players.append(Player2D(players_list[i], i, self.settings['lives'], 'Player'))
			self.match_id_pos[players_list[i]] = i
		self.waiting_for = sum(1 for player in self.players if not player.is_bot)
		for i in range(self.player_num, 4):
			self.players.append(Player2D('!wall', i))
		self.game_type = 'pong2d'
		self.ball = BALL_START
			##### AI TEST

	# init variables
	# def init_game(self):
	# 	# ball initialization
	# 	self.ball = BALL_START
	
	def player_input(self, player_id, input):
		position = self.match_id_pos[player_id]

		# check if sender is not alive
		if self.players[position].type != "Player":
			return

		if input == "up":
			if position == EAST or position == WEST:
				self.players[position].coordinates['y'] = min(0.5 - PADDLE_LENGTH / 2, self.players[position].coordinates['y'] + PLAYER_SPEED)
			else:
				self.players[position].coordinates['x'] = max(-0.5 + PADDLE_LENGTH / 2, self.players[position].coordinates['x'] - PLAYER_SPEED)
		elif input == "down":
			if position == EAST or position == WEST:
				self.players[position].coordinates['y'] = max(-0.5 + PADDLE_LENGTH / 2, self.players[position].coordinates['y'] - PLAYER_SPEED)
			else:
				self.players[position].coordinates['x'] = min(0.5 - PADDLE_LENGTH / 2, self.players[position].coordinates['x'] + PLAYER_SPEED)


	def move_ball(self):
		self.ball['x'] += self.ball["speed"]['x']
		self.ball['y'] += self.ball["speed"]['y']

	def collision_logic(self):
		self.wall_collision()
		self.paddle_collision()

	def wall_collision(self):
		if self.ball["y"] <= 0 and abs(self.ball["y"]) >= abs(self.ball["x"]):
			ball_position = SOUTH
		elif self.ball["y"] > 0 and abs(self.ball["y"]) > abs(self.ball["x"]):
			ball_position = NORTH
		elif self.ball["x"] < 0 and abs(self.ball["y"]) < abs(self.ball["x"]):
			ball_position = WEST
		elif self.ball["x"] > 0 and abs(self.ball["y"]) < abs(self.ball["x"]):
			ball_position = EAST


		if ball_position == NORTH or ball_position == SOUTH:
			if not -0.5 + BALL_RADIUS < self.ball["y"] < 0.5 - BALL_RADIUS:
				if self.players[ball_position].type != "Player":
					self.ball["speed"]["y"] *= -1
				elif not -0.5 + BALL_RADIUS < self.ball["x"] < 0.5 - BALL_RADIUS:
					self.ball["speed"]["x"] *= -1
		else:
			if not -0.5 + BALL_RADIUS < self.ball["x"] < 0.5 - BALL_RADIUS:
				if self.players[ball_position].type != "Player":
					self.ball["speed"]["x"] *= -1
				elif not -0.5 + BALL_RADIUS < self.ball["y"] < 0.5 - BALL_RADIUS:
					self.ball["speed"]["y"] *= -1



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
					self.ball["last_hit"] = direction
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
		elif direction == NORTH:
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
		if self.ball['x'] < -1.2 and self.players[WEST].type == "Player":
			self.players[WEST].lives -= 1
			print(f"WEST lost a life, {self.players[WEST].lives} remaining")
			goal_scored = True
		elif self.ball['x'] > 1.2 and self.players[EAST].type == "Player":
			self.players[EAST].lives -= 1
			print(f"EAST lost a life, {self.players[EAST].lives} remaining")
			goal_scored = True
		elif self.ball['y'] > 1.2 and self.players[NORTH].type == "Player":
			self.players[NORTH].lives -= 1
			print(f"NORTH lost a life, {self.players[NORTH].lives} remaining")
			goal_scored = True
		elif self.ball['y'] < -1.2 and self.players[SOUTH].type == "Player":
			self.players[SOUTH].lives -= 1
			print(f"SOUTH lost a life, {self.players[SOUTH].lives} remaining")
			goal_scored = True

		if goal_scored:
			self.check_eliminated_players()
			self.reset_ball()

	def	reset_ball(self):
		self.ball['x'] = 0
		self.ball['y'] = 0
		speed = BALL_SERVICE_SPEED
		self.ball["last_hit"] = -1

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
			'ball_last_hit': self.ball["last_hit"]
		}

		for index in range(4):
			json[f"player{index}_type"] = self.players[index].type
			json[f"player{index}_lives"] = self.players[index].lives
			json[f"player{index}_x"] = self.players[index].coordinates['x']
			json[f"player{index}_y"] = self.players[index].coordinates['y']
			json[f"player{index}_width"] = self.players[index].coordinates['width']
			json[f"player{index}_height"] = self.players[index].coordinates['height']
		return json
	
