from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, mixins
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.renderers import JSONRenderer
from rest_framework_simplejwt.authentication import JWTAuthentication
from users_api.serializers import UserSerializer
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.authtoken.models import Token

# Create your models here.
class UserViewSet(viewsets.ModelViewSet):
	# renderer_classes = [JSONRenderer]
	permission_classes = [IsAuthenticated]
	authentication_classes = [JWTAuthentication]
	serializer_class = UserSerializer
	queryset = User.objects.all()
	lookup_field = "username"
	pass

class CustomAuthToken(ObtainAuthToken):

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data,
                                           context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        token, created = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'user_id': user.pk,
            'email': user.email
        })

# # Create your models here.
# class UserViewSet(viewsets.ModelViewSet):

# 	# serializer_class = UserSerializer
# 	queryset = User.objects.all()

# 	def list(self, request):
# 		queryset = User.objects.all()
# 		serializer = UserSerializer(queryset, many=True)
# 		return Response(serializer.data)

# 	def retrieve(self, request, username=None):
# 		# lookup_field = "email"
# 		# user = User.objects.get(pk=username)
# 		queryset = User.objects.all()
# 		user = User.objects.filter(username=username).first()
# 		if user == None:
# 			return Response("No user found", status=status.HTTP_400_BAD_REQUEST)
# 		serializer = UserSerializer(user)
# 		return Response(serializer.data)