from rest_framework import viewsets
from rest_framework import status, serializers
from rest_framework.views import APIView
from rest_framework import mixins
from rest_framework.permissions import IsAuthenticatedOrReadOnly, IsAuthenticated
from rest_framework.parsers import MultiPartParser, FileUploadParser
from rest_framework.response import Response
from users_api.models import User, Lobby, Score
from users_api.serializers import UserSerializer, LobbySerializer, ScoreSerializer, UserCreationSerializer
from users_api.authentication import CookieUserJWTAuthentication, HeaderUserJWTAuthentication, ApiJWTAuthentication, IsApiAuthenticatedAs
from django.http import HttpResponseRedirect

# Create your models here.
class UserViewSet(viewsets.GenericViewSet, mixins.UpdateModelMixin,
				mixins.RetrieveModelMixin, mixins.ListModelMixin):
	serializer_class = UserSerializer
	queryset = User.objects.all()
	lookup_field = "username"
	permission_classes = [IsAuthenticatedOrReadOnly]
	authentication_classes = [CookieUserJWTAuthentication, HeaderUserJWTAuthentication]


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
	permission_classes = [IsAuthenticatedOrReadOnly]
	authentication_classes = [CookieUserJWTAuthentication, HeaderUserJWTAuthentication]


	def	get(self, *args, **kargs):
		try:
			user = User.objects.get(username=kargs['username'])
		except:
			return Response({"No such user."}, status=status.HTTP_404_NOT_FOUND)
		return HttpResponseRedirect(user.get_avatar_url())
	
	# def post(self, *args, **kargs):
	# 	if self.request.user.username != kargs['username']:
	# 		return Response('You are not logged as {}'.format(kargs['username']), status=status.HTTP_403_FORBIDDEN)
	# 	serializer = AvatarUploadSerializer(data=self.request.data,instance=self.request.user)
	# 	if serializer.is_valid():
	# 		serializer.save()
	# 		return Response(self.request.user.get_avatar_url(), status=status.HTTP_200_OK)
	# 	return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ApiUserView(viewsets.GenericViewSet, mixins.CreateModelMixin, mixins.DestroyModelMixin):
	permission_classes = [IsApiAuthenticatedAs("auth"),]
	authentication_classes = [ApiJWTAuthentication,]
	lookup_field = "username"
	queryset = User.objects.all()
	serializer_class = UserCreationSerializer
