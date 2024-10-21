from adrf.views import APIView
from rest_framework import status
from rest_framework.response import Response
from rest_framework.parsers import JSONParser
from api.serializers import GameSerializer, LobbyResultSerializer, ScoreSerializer
from pong_server.authentication import ApiJWTAuthentication, IsApiAuthenticatedAs
from pong_server.game import PongLobby
from pong_server.consumers import lobbies_list
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from daphne.server import twisted_loop

class PostGameView(APIView):
	parser_classes = [JSONParser,]
	authentication_classes = [ApiJWTAuthentication,]
	permission_classes = [IsApiAuthenticatedAs("matchmaking")]

	async def post(self, request):
		serializer = GameSerializer(data=request.data)
		if not serializer.is_valid():
			return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
		serializer.save() #Init the game
		twisted_loop.create_task(lobbies_list[serializer.validated_data['game_id']].start_game_loop())
		return Response(serializer.validated_data, status=status.HTTP_201_CREATED)

class CancelLobbyView(APIView):
	authentication_classes = [ApiJWTAuthentication,]
	permission_classes = [IsApiAuthenticatedAs("matchmaking")]

	async def delete(self, request, lobby_id):
		print(f"canceling lobby {lobby_id}")
		if not lobby_id in lobbies_list:
			return Response({"Lobby not found"}, status=status.HTTP_404_NOT_FOUND)
		await lobbies_list[lobby_id].stop_game_loop()
		return Response(status=status.HTTP_204_NO_CONTENT)


class PlayerConcedeView(APIView):
	authentication_classes = [ApiJWTAuthentication,]
	permission_classes = [IsApiAuthenticatedAs("matchmaking")]


	async def post(self, request, lobby_id, player_id):
		print(f"player {player_id} has left game {lobby_id}")
		if not lobby_id in lobbies_list:
			return Response({"Lobby not found"}, status=status.HTTP_404_NOT_FOUND)
		# todo : deny target player input and set its lives to 0
		return Response(status=status.HTTP_201_CREATED)




class RetrieveLobbyView(APIView):

	async def get(self, request, lobby_id):
		if not PongLobby.check_lobby_id(lobby_id):
			return Response({'lobby not found.'}, status=status.HTTP_404_NOT_FOUND)
		serializer = GameSerializer()
		return (Response(serializer.to_representation(lobbies_list[lobby_id]), status=status.HTTP_200_OK))

class ListLobbyView(APIView):

	async def get(self, request):
		serializer = GameSerializer(lobbies_list.values(), many=True)
		return Response(serializer.data)

