from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, mixins
from rest_framework import status
from rest_framework.response import Response
from users_api.serializers import UserSerializer

# Create your models here.
class UserViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin,
                  viewsets.GenericViewSet):

	serializer_class = UserSerializer
	queryset = User.objects.all()
	lookup_field = "username"
	pass

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