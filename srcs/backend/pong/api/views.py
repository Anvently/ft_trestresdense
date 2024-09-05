from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework import status
from rest_framework.response import Response
from rest_framework.parsers import JSONParser
from api.serializers import GameSerializer, LobbyResultSerializer, ScoreSerializer
from pong_server.authentication import ApiJWTAuthentication, IsApiAuthenticatedAs

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



# Create your views here.
