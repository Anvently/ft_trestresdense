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
from abc import abstractmethod
import logging, threading
from asgiref.sync import sync_to_async

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

# START_POS = [{"x": -0.5 - PADDLE_THICKNESS / 2, 'y': 0, 'width': PADDLE_THICKNESS, 'height': PADDLE_LENGTH},
# 			 {"x": 0.5 + PADDLE_THICKNESS / 2, "y": 0,"width": PADDLE_THICKNESS,"height": PADDLE_LENGTH,},
# 			 {"x": 0, "y": -0.5 - PADDLE_THICKNESS / 2,"width": PADDLE_LENGTH,"height": PADDLE_THICKNESS},
# 			 {"x": 0, "y": 0.5 + PADDLE_THICKNESS / 2, "width": PADDLE_LENGTH,"height": PADDLE_THICKNESS}
# 			 ]

BALL_START = {"x": 0, "y": 0, "r": BALL_RADIUS, "speed": {"x": 0, "y": 0}}


class Player:
	def __init__(self, player_id, side, lives=0):
		self.player_id = player_id
		self.is_bot = self.player_id[0] == '!'
		self.side = side
		self.lives = lives
		# self.coordinates = START_POS[side]
		# self.coordinates = 0
		self.has_joined = 0
		# AI specific variables
		self.last_time = int(time.time())

	@abstractmethod
	def AI_behavior(self, ballX, ballY, ballSpeedX, ballSpeedY) -> str:
		pass

	@abstractmethod
	def calculate_destination(self, ballX, ballY, ballSpeedX, ballSpeedY):
		pass

	@abstractmethod
	def calculate_impact(self, ballX, ballY, ballSpeedX, ballSpeedY):
		pass

class PongLobby:

	def __init__(self, lobby_id: str, players_list: List[str], settings: Dict[str, Any], tournId=None) -> None:
		self.lobby_id = lobby_id
		self.player_num = len(players_list)
		if tournId:
			self.tournId = tournId
		else:
			self.tournId = None
		self.ball = None
		self.players: List[Player] = []
		self.match_id_pos = {}
		self.settings = settings
		self.ball = BALL_START
		self.gameState = 0
		self.mut_lock = asyncio.Lock()
		self.loop = None
		self.waiting_for = len(players_list)
		self.winner = None
		self.game_type = None
		self.counter = self.simple_call_counter()
		print(f"game {lobby_id} initialized, await players {players_list}")

	def check_game_start(self) -> bool:
		if self.waiting_for == 0:
			return True
		return False

	def check_user(self, username:str):
		"""Check that the user belong to the lobby"""
		if username in [Player.player_id for Player in self.players]:
			return True
		return False

	async def stop_game_loop(self):
		if self.loop:
			self.loop.cancel()

	async def start_game_loop(self):
		self.loop = await self.game_loop()


	def player_join(self, player_id: str) -> bool:
		""" Template of player_list: ["user1", "user1_guest"] """
		if not self.check_user(player_id):
			return False
		if self.players[self.match_id_pos[player_id]].has_joined:
			return True
		self.players[self.match_id_pos[player_id]].has_joined = True
		self.waiting_for -= 1
		print(f"player {player_id} joined, {self.waiting_for} remaining")
		return True

	def player_leave(self, player_id: str):
		""" Template of player_list: ["user1", "user1_guest"] """
		self.waiting_for += 1

	async def send_result(self):
		data = {}
		data['lobby_id'] =  self.lobby_id
		data['game_name'] = self.game_type
		if self.tournId:
			data['tournament_id'] = self.tournId
		if self.gameState == 0:
			data['status'] = 'canceled'
		else:
			data['status'] = 'terminated'
			data['scores_set'] = []
			for player in self.players:
				if (player.player_id != '!wall'):
					data['scores_set'].append({
						'username': player.player_id,
						'has_win': self.winner == player.player_id
					})
		try:
			response = await sync_to_async(requests.post)('http://matchmaking:8003/result/?format=json',
					data=json.dumps(data),
					headers = {
						'Host': 'localhost',
						'Content-type': 'application/json',
						'Authorization': "Bearer {0}".format(settings.API_TOKEN.decode('ASCII'))
						}
					)
			if response.status_code != 200:
				raise Exception(f"expected status 201 but got {response.status_code}")
		except Exception as e:
			logging.error(f"Failed to send results of lobby {self.lobby_id}: {e}")
		# API call to send result to matchmaking
			# -> gameState == 3 match was played -> get stats in self and send them
			# -> gameState == 0 game was canceled
		# should the matchmaking delete the PongLobby upon receiving the result ?

	@abstractmethod
	def player_input(self, player_id, input):
		pass

	def simple_call_counter(self):
		start_time = time.time()
		call_count = 0

		def count():
			nonlocal call_count, start_time
			current_time = time.time()
			call_count += 1

			if current_time - start_time >= 1:
				# print(f"Appels par seconde : {call_count}")
				call_count = 0
				start_time = current_time

		return count

	async def	game_loop(self):
		try:
			print(f"Lobby {self.lobby_id}: Game loop has started")
			loop_start = time.time()
			player_channel = get_channel_layer()
			# pregame : check that all players are present
			while time.time() - loop_start < 3600 and self.gameState == 0:
				await asyncio.sleep(0.016)
				data = self.compute_game()
				await player_channel.group_send(self.lobby_id, data)
				if self.waiting_for == 0:
					self.gameState = 1
			if self.gameState == 0:
				await player_channel.group_send(self.lobby_id, {"type": "cancel",
																"message": "A Player failed to load"
																})
				await self.send_result()
				self.loop.cancel()
				return
			await player_channel.group_send(self.lobby_id, {"type": "game_start"})
			loop_start = time.time()
			print("game will start in 3 sec")
			while time.time() - loop_start < 3:
				await asyncio.sleep(0.016)
				data = self.compute_game()
				await player_channel.group_send(self.lobby_id, data)
			self.gameState = 2
			# play !
				# launch ball
			self.reset_ball()
			print("game has started")
			while self.gameState == 2:
				await asyncio.sleep(0.016)	# 0.16 -> 60Hz
				self.counter()
				data = self.compute_game()
				await player_channel.group_send(self.lobby_id, data)
			await player_channel.group_send(
				self.lobby_id, {
					"type": "game_finish",
					"winner": self.winner
				}
			)
			await self.send_result()
			await player_channel.group_send(
				self.lobby_id, {
					"type": "leave_lobby"
				}
			)
			logging.info(f"Lobby {self.lobby_id}: Terminating game loop.")
		except Exception as e:
			logging.error(e)
			await player_channel.group_send(self.lobby_id, {'type':'error', 'detail':'error in game loop'})
			traceback.print_exc()

	def	compute_game(self):
		self.move_ball()
		self.collision_logic()
		self.check_goals()
		self.compute_AI()

		# if self.check_winning_condition():
		# 	self.gameState = 3
		# 	self.winner = self.get_winner()

		self.winner = self.check_winner()
		if self.winner:
			print(f"{self.winner} won the game")
			self.gameState = 3

		return self.generate_JSON()

	def compute_AI(self):
		for i in range(self.player_num):
			if self.players[i].player_id.startswith("!"):
				input = self.players[i].AI_behavior(self.ball["x"], self.ball["y"], self.ball["speed"]["x"], self.ball["speed"]["y"])
				self.player_input(self.players[i].player_id, input)

	@abstractmethod
	def move_ball(self):
		pass

	@abstractmethod
	def	collision_logic(self):
		pass

	@abstractmethod
	def check_goals(self):
		pass

	@abstractmethod
	def	reset_ball(self):
		pass

	@abstractmethod
	def check_winning_condition(self) -> bool:
		pass

	@abstractmethod
	def check_winner(self) -> str:
		pass

	@abstractmethod
	def generate_JSON(self) -> Dict[str, Any]:
		pass

	# def get_winner(self) -> str:
	# 	for i in range(self.player_num):
	# 		if self.players[i].is_bot:
	# 			print(f"{self.players[i].player_id} won the game")
	# 			self.winner = self.players[i].player_id
	# 			return self.winner
	# 	return None



