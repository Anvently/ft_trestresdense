from django.contrib.auth.models import User
from django.contrib.auth import logout
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from auth_api.serializers import UserSerializer, UserInfosSerializer
from auth_api.authentication import CookieJWTAuthentication, HeaderJWTAuthentication
from auth_api.crypt import generate_jwt_token
from django.conf import settings
from auth_api.requests import delete_user, post_new_user
import time

class UserView(APIView):

	permission_classes = [IsAuthenticated]
	authentication_classes = [CookieJWTAuthentication, HeaderJWTAuthentication]

	def get(self, request):
		users = User.objects.all()
		serializer = UserSerializer(users, many=True)
		return Response(serializer.data)
	
class DeleteView(APIView):

	permission_classes = [IsAuthenticated]
	authentication_classes = [CookieJWTAuthentication, HeaderJWTAuthentication]

	def delete(self, request):
		delete_user(request.user)
		request.user.delete()
		logout(request)
		response = Response(status=status.HTTP_204_NO_CONTENT)
		response.delete_cookie('auth-token')
		return response

class UpdateView(APIView):

	permission_classes = [IsAuthenticated]
	authentication_classes = [CookieJWTAuthentication, HeaderJWTAuthentication]

	def post(self, request):
		serializer = UserInfosSerializer(data=request.data, instance=request.user)
		if not serializer.is_valid():
			return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
		serializer.save()
		return Response(serializer.data, status=status.HTTP_200_OK)

class RegisterView(APIView):
	 
	def post(self, request):
		serializer = UserInfosSerializer(data=request.data)
		if not serializer.is_valid():
			return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
		post_new_user(request.data["username"],
				(request.data["url_avatar"] if "url_avatar" in request.data else None),
				(request.data["display_name"] if "display_name" in request.data else request.data["username"]))
		serializer.save()
		return Response(serializer.data, status=status.HTTP_201_CREATED)

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

	def post(self, request):
		
		try:
			user = User.objects.get(username=request.data["username"])
		except:
			return Response({"Invalid username."}, status=status.HTTP_400_BAD_REQUEST)
		if not "password" in request.data:
			return Response({"Missing password."}, status=status.HTTP_400_BAD_REQUEST)
		if user.check_password(request.data["password"]) == False:
			return Response({"Invalid credentials."}, status=status.HTTP_400_BAD_REQUEST)
		try:
			data = {"username": user.username}
			token = generate_jwt_token(data, ttl_based=True)
		except Exception as e:
			return Response(
				{"error": f"Failed to generate token: {e}"}, status=status.HTTP_400_BAD_REQUEST
			)
		response = Response({"token":token}, status=status.HTTP_200_OK)
		response.set_cookie('auth-token', token, expires=time.time() + settings.RSA_KEY_EXPIRATION)
		return response

class VerifyToken(APIView):
	authentication_classes = [CookieJWTAuthentication, HeaderJWTAuthentication]

	def get(self, request):
		return Response({"message": "Token verified", "data": request.jwt_data}, status=status.HTTP_200_OK)

