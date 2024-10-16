from django.shortcuts import render
from adrf.views import APIView
from rest_framework import status
from rest_framework.response import Response
from rest_framework.parsers import JSONParser
from matchmaking.lobby import Lobby, lobbies
from matchmaking.authentication import ApiJWTAuthentication, IsApiAuthenticatedAs
from matchmaking.tournament import tournaments

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
