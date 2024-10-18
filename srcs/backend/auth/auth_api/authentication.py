from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import BasePermission
from auth_api.models import User

from auth_api.crypt import verify_jwt

class UserPermission(BasePermission):

	def has_permission(self, request, view):
		if view.action == 'list':
			return request.user.is_authenticated and request.user.is_admin
		elif view.action == 'create':
			return True
		elif view.action in ['retrieve', 'update', 'partial_update', 'destroy']:
			return request.user.is_authenticated
		else:
			print(view.action)
			return False
																								
	def has_object_permission(self, request, view, obj):
		# Deny actions on objects if the user is not authenticated
		if not request.user.is_authenticated:
			return False

		if view.action == 'retrieve':
			return obj == request.user or request.user.is_admin
		elif view.action in ['update', 'partial_update', 'destroy']:
			return obj == request.user or request.user.is_admin
		else:
			return False

class CookieJWTAuthentication(BaseAuthentication):
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
			raise AuthenticationFailed('No such user')
		return (user, None)
	
	def authenticate_header(self, request):
		return "cookie; cookie-name=auth-token"


class HeaderJWTAuthentication(BaseAuthentication):
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
	
