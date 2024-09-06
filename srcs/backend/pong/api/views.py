from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework import status
from rest_framework.response import Response
from rest_framework.parsers import JSONParser
from api.serializers import GameSerializer, LobbyResultSerializer, ScoreSerializer
from pong_server.authentication import ApiJWTAuthentication, IsApiAuthenticatedAs
from pong_server.game import lobbys_list, PongLobby

class PostGameView(APIView):
	parser_classes = [JSONParser,]
	authentication_classes = [ApiJWTAuthentication,]
	permission_classes = [IsApiAuthenticatedAs("matchmaking")]

	def post(self, request):
		print(request.data)
		serializer = GameSerializer(data=request.data)
		if not serializer.is_valid():
			return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
		serializer.save() #Init the game
		return Response(serializer.validated_data, status=status.HTTP_201_CREATED)

class RetrieveLobbyView(APIView):

	def get(self, request, lobby_id):
		if not PongLobby.check_lobby_id(lobby_id):
			return Response({'lobby not found.'}, status=status.HTTP_404_NOT_FOUND)
		serializer = GameSerializer()
		return (Response(serializer.serialize(lobbys_list[lobby_id]), status=status.HTTP_200_OK))

# Create your views here.
