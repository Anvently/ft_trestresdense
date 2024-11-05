from django.shortcuts import render
from adrf.views import APIView
from rest_framework import status
from rest_framework.response import Response
from rest_framework.parsers import JSONParser
from matchmaking.lobby import Lobby, lobbies
from matchmaking.authentication import ApiJWTAuthentication, IsApiAuthenticatedAs
from matchmaking.tournament import tournaments
from matchmaking.lobby import SimpleMatchLobby, TournamentInitialLobby
import copy
from matchmaking.consumers import MatchMakingConsumer

class PostResultView(APIView):
	parser_classes = [JSONParser,]
	authentication_classes = [ApiJWTAuthentication]
	permission_classes = [IsApiAuthenticatedAs("pong")]

	async def post(self, request):
		lobby_id = request.data.get('lobby_id', None)
		if lobby_id in lobbies:
			await lobbies[lobby_id].handle_results(request.data)
			from matchmaking.consumers import MatchMakingConsumer
			await MatchMakingConsumer.static_general_update()
			return Response(status=status.HTTP_200_OK)
		else:
			return Response({f'no associated lobby exists for lobby {lobby_id}'},
				   status=status.HTTP_400_BAD_REQUEST)


class PostBotLobbyView(APIView):
	parser_classes = [JSONParser,]
	authentication_classes = [ApiJWTAuthentication]
	permission_classes = [IsApiAuthenticatedAs("matchmaking")]


	async def post(self, request):
		data = {}
		data['game_type'] = request.data.get('game_type', 'pong2d')
		lobby_type = request.data.get('lobby_type', 'simple_match')
		data['hostname'] = '!API'
		data['nbr_players'] = request.data.get('nbr_bot', 2)
		data['public'] = False
		data['allow_spectators'] = True
		data['settings'] = {'lives' : request.data.get('lives', 5) }
		try:
				new_lobby = SimpleMatchLobby(copy.deepcopy(data))
		except KeyError as e:
			return Response({f'Wrong settings'}, status=status.HTTP_400_BAD_REQUEST)
		except TypeError as e:
			return Response({f'Wrong settings'}, status=status.HTTP_400_BAD_REQUEST)
		lobbies[new_lobby.id] = new_lobby
		for _ in range(0, data['nbr_players']-1):
			lobbies[new_lobby.id].add_bot()
		await MatchMakingConsumer.static_general_update()
		return Response(status=status.HTTP_201_CREATED)




class HealthCheckView(APIView):
	async def get(self, request):
		return Response(status=200)
