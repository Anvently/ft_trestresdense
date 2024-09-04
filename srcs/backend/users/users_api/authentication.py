from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import BasePermission
from users_api.models import User
from typing import List
import time
import jwt

from django.conf import settings

def verify_jwt(token, is_ttl_based=False, ttl_key="exp"):
	data = jwt.decode(token, settings.RSA_PUBLIC_KEY, algorithms=["RS512"])
	if is_ttl_based:
		if data[ttl_key] < time.time():
			raise ValueError("Token expired")
	return data

class IsApiAuthentificated(BasePermission):

	restrict_api: List[str] = None

	def __init__(self):
		pass

	def has_permission(self, request, view):
		if not hasattr(request, 'api_name'):
			return False
		if self.restrict_api and request.api_name not in self.restrict_api:
			raise AuthenticationFailed("The provided token does not allow this action")
		elif request.api_name:
			return True
		return False

def IsApiAuthenticatedAs(required_api: List[str]):
	class CustomIsApiAuthenticated(IsApiAuthentificated):
		restrict_api = required_api

	return CustomIsApiAuthenticated

class ApiJWTAuthentication(BaseAuthentication):
	def authenticate(self, request):
		token = request.headers.get("Authorization")
		if not token:
			raise AuthenticationFailed("Token not provided")
		token = token.removeprefix("Bearer ")
		try:
			data = verify_jwt(token, is_ttl_based=False)
		except Exception as e:
			raise AuthenticationFailed(f"Token verification failed: {e}")
		if not "api" in data:
			raise AuthenticationFailed('Missing api claim')
		# if not data["api"] in settings.ALLOWED_APIS:
		# 	raise AuthenticationFailed('No such api is allowed')
		request.api_name = data["api"]
		return None
	
	def authenticate_header(self, request):
		return "Bearer"

class CookieUserJWTAuthentication(BaseAuthentication):
	def authenticate(self, request):
		# token = request.headers.get("Authorization")
		token = request.COOKIES.get('auth-token')
		if not token:
			return None
		try:
			# token = token.removeprefix("Bearer ")
			data = verify_jwt(token, is_ttl_based=True)
		except Exception as e:
			raise AuthenticationFailed(f"Token verification failed: {e}")
		try:
			user = User.objects.get(username=data["username"])
			request.jwt_data = data
		except:
			return None
		return (user, None)
	
	def authenticate_header(self, request):
		return "cookie; cookie-name=auth-token"


class HeaderUserJWTAuthentication(BaseAuthentication):
	def authenticate(self, request):
		token = request.headers.get("Authorization")
		if not token:
			return None
		try:
			token = token.removeprefix("Bearer ")
			data = verify_jwt(token, is_ttl_based=True)
		except Exception as e:
			raise AuthenticationFailed(f"Token verification failed: {e}")
		try:
			user = User.objects.get(username=data["username"])
			request.jwt_data = data
		except:
			raise AuthenticationFailed('No such user')
		return (user, None)
	
	def authenticate_header(self, request):
		return "Bearer"