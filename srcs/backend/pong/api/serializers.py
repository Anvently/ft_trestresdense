from rest_framework import serializers
from pong_server.game import PongLobby
from pong_server.consumers import lobbys_list
from typing import Dict, List, Any

class GameSettingsSerializer(serializers.Serializer):

	number_life = serializers.IntegerField(min_value = 1)
	number_players = serializers.IntegerField(max_value = 4)

	def create(self, validated_data):
		""" Return game_settings object """
		pass

class GameSerializer(serializers.Serializer):

	game_id = serializers.CharField()
	turnament_id = serializers.CharField(allow_blank = True, required = False)
	player_list = serializers.ListField(child=serializers.CharField())
	settings = GameSettingsSerializer()

	def save(self):
		"""Append the game to the list of active games"""
		lobbys_list[self.validated_data['game_id']] = PongLobby(
			lobby_id=self.validated_data['game_id'],
			players_list=self.validated_data['player_list'],
			lifes=self.validated_data['settings']['number_life'],
			tournId=self.validated_data.get('turnament_id')
		)

	def validate(self, data):
		number_players = data['settings']['number_players']
		player_list = data['player_list']
		
		if PongLobby.check_lobby_id(data['game_id']):
			raise serializers.ValidationError(
				f"The given lobby_id {data['game_id']} already exists."
			)

		if len(player_list) != number_players:
			raise serializers.ValidationError(
				f"The number of players in settings ({number_players}) does not match the size of the player list ({len(player_list)})."
			)
		
		if number_players % 2:
			raise serializers.ValidationError(
				f"The number of players in settings ({number_players}) must be an even number."
			)
		return data

	def to_representation(self, obj: PongLobby):
		data = {
			'game_id': obj.lobby_id,
			'turnament_id': None,
			'player_list': [{
				'id': player.player_id,
				'position': player.position,
				'type': player.type,
				'lifes':player.lives
				} for player in obj.players],
			'settings': {
				'lifes': 'unknown'
			}
		}
		if hasattr(obj, 'tournId'):
			data['turnament_id'] = obj.tournId
		return data


class ScoreSerializer(serializers.Serializer):

	username = serializers.CharField()
	score = serializers.IntegerField()
	has_win = serializers.BooleanField()

class LobbyResultSerializer(serializers.Serializer):

	id = serializers.CharField()
	turnament_id = serializers.CharField(allow_blank=True, required=False)
	scores = serializers.ListField(child=ScoreSerializer())


