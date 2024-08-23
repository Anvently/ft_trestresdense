from django.contrib.auth.models import User
from rest_framework import viewsets
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from users_api.serializers import UserSerializer, LoginSerializer
from users_api.authentication import TTLBasedJWTAuthentication
from users_api.crypt import generate_jwt_token
import time

# Create your models here.
class UserViewSet(viewsets.ModelViewSet):
	# renderer_classes = [JSONRenderer]
	permission_classes = [IsAuthenticated]
	authentication_classes = [TTLBasedJWTAuthentication]
	serializer_class = UserSerializer
	queryset = User.objects.all()
	lookup_field = "username"
	pass

class GenerateToken(APIView):

    def post(self, request):
        try:
            data = request.data
            token = generate_jwt_token(data, ttl_based=True)
        except Exception as e:
            return Response(
                {"error": f"Failed to generate token: {e}"}, status=status.HTTP_400_BAD_REQUEST
            )
        return Response({"token": token}, status=status.HTTP_200_OK)

class LoginView(APIView):

    serializer_classes = [LoginSerializer]
    def post(self, request):
        try:
            user = User.objects.get(username=request.data["username"])
        except:
            return Response({"Invalid username."}, status=status.HTTP_400_BAD_REQUEST)
        if user.check_password(request.data["password"]) == False:
            return Response({"Invalid credentials."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            data = {"username": user.username, "exp": time.time() + 15 * 60}
            token = generate_jwt_token(data, ttl_based=True)
        except Exception as e:
            return Response(
                {"error": f"Failed to generate token: {e}"}, status=status.HTTP_400_BAD_REQUEST
            )
        return Response({"token": token}, status=status.HTTP_200_OK)


class VerifyToken(APIView):
    authentication_classes = [TTLBasedJWTAuthentication]

    def get(self, request):
        return Response({"message": "Token verified", "data": request.jwt_data}, status=status.HTTP_200_OK)

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