from typing import List, Dict, Any

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

class PongLobby:

	# Constructor
	def __init__(self, lobby_id: str) -> None:
		self.lobby_id = lobby_id
		
	# init variables
	def init_game(game_id, player_list: List[str]):
		for i in range(0, 4):
			side[i] = "wall"
		
		# ball initialization
		ball.x = 0.5
		ball.y = 0.5
		ball.r = BALL_RADIUS
		ball.speed.x = BALL_SPEED
		ball.speed.y = 0.002

		# player initialization
		for i in len(player_list):
			if i == WEST:
				player[i].x = PADDLE_THICKNESS / 2
				player[i].y = 0.5
				player[i].width = PADDLE_THICKNESS
				player[i].height = PADDLE_LENGTH
			elif i == EAST:
				player[i].x = 1 - PADDLE_THICKNESS / 2
				player[i].y = 0.5
				player[i].width = PADDLE_THICKNESS
				player[i].height = PADDLE_LENGTH
			elif i == NORTH:
				player[i].x = 0.5
				player[i].y = PADDLE_THICKNESS / 2
				player[i].width = PADDLE_LENGTH
				player[i].height = PADDLE_THICKNESS
			elif i == SOUTH:
				player[i].x = 0.5
				player[i].y = 1 - PADDLE_THICKNESS / 2
				player[i].width = PADDLE_LENGTH
				player[i].height = PADDLE_THICKNESS
			# player[i].lives = number_life
			player[i].id = player_list[i]
			side[i] = "player"

	def player_input(self, player_id, input):
		# get the player index from the player_id somehow
			# i = player_id
		# interpret player input
		if input == "joined":
			pass
		if input == "ready":
			pass
		elif input == "up":
			if i == EAST or i == WEST:
				self.player[i].y = max(PADDLE_LENGTH / 2, self.player[i].y - PLAYER_SPEED)
			else
				self.player[i].x = max(PADDLE_LENGTH / 2, self.player[i].x - PLAYER_SPEED)
		elif input == "down":
			if i == EAST or i == WEST:
				self.player[i].y = min(1 - PADDLE_LENGTH / 2, self.player[i].y + PLAYER_SPEED)
			else
				self.player[i].x = min(1 - PADDLE_LENGTH / 2, self.player[i].x + PLAYER_SPEED)

	async def	move_loop(self):
		while True:
			async with self.mut_lock:
				# if end game:
					# break
				# move ball
				self.ball.x += self.ball.speed.x
				self.ball.y += self.ball.speed.y
				# manage collision
				wall_collision()
				paddle_collision()
				# check for point


	def get_state(self) -> Dict[str, Any]:
		return {
			'ball.x': self.ball.x,
			'ball.y': self.ball.y,
			'playerW.x': self.player[WEST].x,
			'playerW.y': self.player[WEST].y,
			'playerE.x': self.player[EAST].x,
			'playerE.y': self.player[EAST].y
		}
	




	# collision logic  ############
	def wall_collision()
		if self.side[NORTH] == "wall" and self.ball.y - BALL_RADIUS <= 0 and self.ball.speed.y < 0:
			self.ball.speed.y *= -1
		elif self.side[SOUTH] == "wall" and self.ball.y + BALL_RADIUS >= 1 and self.ball.speed.y > 0:
			self.ball.speed.y *= -1
		elif self.side[WEST] == "wall" and self.ball.x - BALL_RADIUS <= 0 and self.ball.speed.x < 0:
			self.ball.speed.x *= -1
		elif self.side[EAST] == "wall" and self.ball.x + BALL_RADIUS >= 1 and self.ball.speed.x > 0:
			self.ball.speed.x *= -1

	def paddle_collision()
		for direction in range(0, 4):
			if self.side[direction] == "player":
				if rectCircleCollision(self.player[i].x - self.player[i].width / 2,
										self.player[i].y - self.player[i].height / 2,
										self.player[i].width,
										self.player[i].height,
										self.ball.x,
										self.ball.y,
										self.ball.r)
					paddle_rebound(direction)
	
	def paddle_rebound(direction)	# simple rebound
		if direction == WEST:
			self.ball.speed.x *= -1
		elif direction == EAST:
			self.ball.speed.x *= -1
		elif direction == NORTH:
			self.ball.speed.y *= -1
		elif direction == SOUTH:
			self.ball.speed.y *= -1

	def rectCircleCollision(rectX, rectY, width, height, circX, circY, radius):
		closestX = max(rectX, min(circX, rectX + width))
		closestY = max(rectY, min(circY, rectY + height))

		distanceX = circX - closestX
		distanceY = circY - closestY
		distanceSquared = distanceX**2 + distanceY**2

		return distanceSquared <= radius**2




lobbys_list : Dict[str, PongLobby] = []
		

	# game_id
	# number_players
	# player_list
	# 	"user1"
	# 	"user2"
	# settings
	# 	number_life


