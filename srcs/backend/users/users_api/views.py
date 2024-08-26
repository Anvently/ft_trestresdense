from rest_framework import viewsets
from rest_framework import status, serializers
from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework.parsers import MultiPartParser, FileUploadParser
from rest_framework.response import Response
from users_api.models import User, Lobby, Score
from users_api.serializers import UserSerializer, LobbySerializer, ScoreSerializer
from users_api.authentication import CookieUserJWTAuthentication, HeaderUserJWTAuthentication, ApiJWTAuthentication
from django.http import HttpResponseRedirect

# Create your models here.
class UserViewSet(viewsets.ReadOnlyModelViewSet):
	serializer_class = UserSerializer
	queryset = User.objects.all()
	lookup_field = "username"

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
	
class AvatarView(APIView):
	parser_classes = [FileUploadParser, MultiPartParser]
	permission_classes = [IsAuthenticatedOrReadOnly]
	authentication_classes = [CookieUserJWTAuthentication, HeaderUserJWTAuthentication]
	serializer = serializers.ImageField

	def	get(self, username):
		try:
			user = User.objects.get(username=username)
		except:
			return Response({"No such user."}, status=status.HTTP_404_NOT_FOUND)
		return HttpResponseRedirect(user.get_avatar_url())
	


