from django.contrib.auth import logout
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.conf import settings
from auth_api.serializers import UserSerializer, UserInfosSerializer
from auth_api.authentication import CookieJWTAuthentication, HeaderJWTAuthentication
from auth_api.crypt import generate_jwt_token
from auth_api.models import User
from auth_api.requests import delete_user, post_new_user, obtain_oauth_token, retrieve_user_infos
from auth_api.requests import post_new_user
from django.utils.crypto import get_random_string
from typing import Any

import time

def	get_or_create_user(infos: dict[str, Any]) -> User:
	try:
		user = User.objects.get(username="%{0}".format(infos['username']))
		return user
	except:
		infos["password"]= get_random_string(length=36)
		serializer=UserInfosSerializer(data=infos)
		if not serializer.is_valid():
			return None
		serializer.validated_data["username"] = "%{0}".format(serializer.validated_data["username"])
		post_new_user(serializer.validated_data["username"], infos.get("url_avatar"), infos.get("display_name", infos["username"]))
		return serializer.save() 

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
		delete_user(request.user.username)
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
		post_new_user(request.data["username"], request.data.get("url_avatar"),
				request.data.get("display_name", request.data["username"]))
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

class LogoutView(APIView):

	def get(self, request):
		logout(request)
		response = Response(status=status.HTTP_204_NO_CONTENT)
		response.delete_cookie('auth-token')
		return response

class VerifyToken(APIView):
	authentication_classes = [HeaderJWTAuthentication, CookieJWTAuthentication]
	permission_classes = [IsAuthenticated]

	def get(self, request):
		return Response({"message": "Token verified", "data": request.jwt_data}, status=status.HTTP_200_OK)


class SignIn42CallbackView(APIView):
	# authentication_classes = [Api]

	def get(self, request):
		code = request.GET.get('code')
		
		if code == None:
			return Response({'error':"invaid_request",
							'error_description':"Missing authorization code. Make sure to connect via appropriate URL.",
							'url':'https://api.intra.42.fr/oauth/authorize?client_id=u-s4t2ud-7b58cca1aa55dd25c0845e50d85160e19d51224f609b8d441d4b6281473ba7ee&redirect_uri=https%3A%2F%2Flocalhost%3A8083%2Fapi%2Fauth%2F42-api-callback&response_type=code'},
						status=status.HTTP_400_BAD_REQUEST)
		token = obtain_oauth_token(request, code)
		if not token:
			return Response({'error':"invalid_grant",
							'error_description':"The provided grant code was not accepted by the authorization server."},
						status=status.HTTP_400_BAD_REQUEST)
		infos = retrieve_user_infos(token)
		if not infos:
			return Response({'error':'invalid_infos',
							'error_description': "User infos were received from 42 api but some information were missing."},
						status=status.HTTP_503_SERVICE_UNAVAILABLE)
		user = get_or_create_user(infos)
		if not user:
			return Response({'error':'register_failed',
							'error_description':'We failed to register a new user with the provided informations.'},
						status=status.HTTP_500_INTERNAL_SERVER_ERROR)
		try:
			data = {"username": user.username}
			token = generate_jwt_token(data, ttl_based=True)
		except Exception as e:
			return Response(
				{"error": f"Failed to generate token: {e}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
			)
		response = Response({"token":token}, status=status.HTTP_200_OK)
		response.set_cookie('auth-token', token, expires=time.time() + settings.RSA_KEY_EXPIRATION)
		return response
		# return Response(token.content, status=status.HTTP_200_OK)
