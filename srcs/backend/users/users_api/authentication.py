from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.contrib.auth.models import User
import time
import jwt

from django.conf import settings

def verify_jwt(token, is_ttl_based=False, ttl_key="exp"):
	data = jwt.decode(token, settings.RSA_PUBLIC_KEY, algorithms=["RS512"])
	if is_ttl_based:
		if data[ttl_key] < time.time():
			raise ValueError("Token expired")
	return data

class ApiJWTAuthentication(BaseAuthentication):
	def authenticate(self, request):
		token = request.headers.get("Authorization")
		try:
			if not token:
				raise AuthenticationFailed("Token not provided")
			token = token.removeprefix("Bearer ")
			data = verify_jwt(token, is_ttl_based=True)
			if not "api" in data:
				raise AuthenticationFailed('Missing api claim')
			if not data["api"] in settings.ALLOWED_APIS:
				raise AuthenticationFailed('No such api is allowed')
		except Exception as e:
				raise AuthenticationFailed(f"Token verification failed: {e}")
		return None
