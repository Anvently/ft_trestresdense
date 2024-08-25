from rest_framework import viewsets
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from users_api.models import User, Lobby, Score
from users_api.serializers import UserSerializer, LobbySerializer, ScoreSerializer

# Create your models here.
class UserViewSet(viewsets.ReadOnlyModelViewSet):
	serializer_class = UserSerializer
	queryset = User.objects.all()
	lookup_field = "username"
	pass

class LobbyViewSet(viewsets.ReadOnlyModelViewSet):
	serializer_class = LobbySerializer
	lookup_field = "lobby_id"
	queryset = Lobby.objects.all()

class ScoreViewSet(viewsets.ReadOnlyModelViewSet):
	serializer_class = ScoreSerializer
	lookup_field = "lobby__lobby_id"

	def get_queryset(self):
		return Score.objects.filter(user__username=self.kwargs['user_username'])
	
	def get_serializer(self, *args, **kwargs):
		return super().get_serializer(*args, **kwargs, fields = ['lobby', 'score', 'has_win'])
	

