from django.contrib.auth import logout
from rest_framework import status
from rest_framework.views import APIView
from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.parsers import JSONParser, MultiPartParser
from django.conf import settings
from auth_api.serializers import UserInfosSerializer
from auth_api.authentication import CookieJWTAuthentication, HeaderJWTAuthentication, UserPermission
from auth_api.crypt import generate_jwt_token, generate_2fa_token, verify_2fa_token, verify_totp_token
from django.core.cache import cache
from auth_api.models import User
from auth_api.requests import delete_user, post_new_user, obtain_oauth_token, retrieve_user_infos
from auth_api.requests import post_new_user
from django.utils.crypto import get_random_string
from django.http import HttpResponseRedirect
from typing import Any

import time

def	get_or_create_user(infos: dict[str, Any], request) -> User:
	try:
		user = User.objects.get(username="042{0}".format(infos['username']))
		return user
	except:
		infos["password"]= get_random_string(length=30)
		serializer=UserInfosSerializer(data=infos, request=request)
		if not serializer.is_valid():	
			return None
		serializer.validated_data["username"] = "042{0}".format(infos["username"])
		return serializer.save()

class UserViewSet(viewsets.GenericViewSet, mixins.RetrieveModelMixin, mixins.UpdateModelMixin,
				mixins.DestroyModelMixin, mixins.CreateModelMixin):
	permission_classes = [UserPermission]
	authentication_classes = [CookieJWTAuthentication, HeaderJWTAuthentication]
	parser_classes = [JSONParser, MultiPartParser,]
	serializer_class = UserInfosSerializer
	
	def get_object(self):
		return self.request.user

	def destroy(self, request, *args, **kwargs):
		delete_user(request.user.username)
		request.user.delete()
		logout(request)
		response = Response(status=status.HTTP_204_NO_CONTENT)
		response.delete_cookie('auth-token')
		return response

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
		if user.is_2fa_active:
			token = generate_2fa_token(user)
			response = Response({'message': "2fa required. A token valid for 15min was transmitted in a cookie."}, status= status.HTTP_202_ACCEPTED)
			response.set_cookie('2fa-token', token, max_age=900, httponly=True)
		else:
			try:
				data = {"username": user.username}
				token = generate_jwt_token(data, ttl_based=True)
				response = Response({'token': token}, status= status.HTTP_200_OK)
				response.set_cookie('auth-token', token, expires=time.time() + settings.RSA_KEY_EXPIRATION)
			except Exception as e:
				return Response(
					{"error": f"Failed to generate token: {e}"}, status=status.HTTP_400_BAD_REQUEST
				)
		return response
	
class TwoFactorAuthView(APIView):
	def post(self, request):
		two_factor_code = request.data.get('code')
		two_factor_token = request.COOKIES.get('2fa_token')
		
		if not two_factor_token:
			return Response({"error": "No 2FA token found"}, status=status.HTTP_400_BAD_REQUEST)
		
		user_id = verify_2fa_token(two_factor_token)
		if not user_id:
			return Response({"error": "Invalid or expired 2FA token"}, status=status.HTTP_401_UNAUTHORIZED)
		
		try:
			user=User.objects.get(id=user_id)
		except:
			return Response({"error": "The given 2FA token doesn't match any user."}, status=status.HTTP_401_UNAUTHORIZED)

		if user.is_2fa_active == False:
			return Response({"error": "2FA is not needed for this user."}, status=status.HTTP_400_BAD_REQUEST)

		if verify_totp_token(user.totp_secret, two_factor_code):
			cache.delete(f"2fa_token_{two_factor_token}")
			try:
				data = {"username": user.username}
				token = generate_jwt_token(data, ttl_based=True)
				response = Response({'token': token}, status= status.HTTP_200_OK)
				response.set_cookie('auth-token', token, expires=time.time() + settings.RSA_KEY_EXPIRATION)
				response.delete_cookie('2fa_token')
				return response
			except Exception as e:
				return Response(
					{"error": f"Failed to generate token: {e}"}, status=status.HTTP_400_BAD_REQUEST
				)
		else:
			return Response({"error": "Invalid 2FA code"}, status=status.HTTP_401_UNAUTHORIZED)

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
		user = get_or_create_user(infos, request)
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
		response = HttpResponseRedirect(f'https://{request.META["HTTP_HOST"]}:8083/')
		# response = Response({"token":token}, status=status.HTTP_200_OK)
		response.set_cookie('auth-token', token, expires=time.time() + settings.RSA_KEY_EXPIRATION)
		return response
		# return Response(token.content, status=status.HTTP_200_OK)
