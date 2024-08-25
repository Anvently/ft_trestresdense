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

class TTLBasedJWTAuthentication(BaseAuthentication):
    def authenticate(self, request):
        token = request.headers.get("Authorization")
        if not token:
            raise AuthenticationFailed("Token not provided")
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
    