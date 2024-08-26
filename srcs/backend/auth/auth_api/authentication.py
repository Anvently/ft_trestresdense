from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.contrib.auth.models import User

from auth_api.crypt import verify_jwt

class TTLBasedJWTAuthentication(BaseAuthentication):
    def authenticate(self, request):
        # token = request.headers.get("Authorization")
        token = request.COOKIES.get('auth-token')
        if not token:
            raise AuthenticationFailed("Auth token not provided")
        try:
            # token = token.removeprefix("Bearer ")
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


# class TTLBasedJWTAuthentication(BaseAuthentication):
#     def authenticate(self, request):
#         token = request.headers.get("Authorization")
#         if not token:
#             raise AuthenticationFailed("Auth token not provided")
#         try:
#             token = token.removeprefix("Bearer ")
#             data = verify_jwt(token, is_ttl_based=True)
#         except Exception as e:
#             raise AuthenticationFailed(f"Token verification failed: {e}")
#         try:
#             user = User.objects.get(username=data["username"])
#             request.jwt_data = data
#         except:
#             raise AuthenticationFailed('No such user')
#         return (user, None)
    
#     def authenticate_header(self, request):
#         return "Bearer"