from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from auth_api.serializers import UserSerializer, UserInfosSerializer
from auth_api.authentication import CookieJWTAuthentication, HeaderJWTAuthentication
from auth_api.crypt import generate_jwt_token
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
		request.user.delete()
		return Response(status=status.HTTP_204_NO_CONTENT)

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
			data = {"username": user.username, "exp": time.time() + 15 * 60}
			token = generate_jwt_token(data, ttl_based=True)
		except Exception as e:
			return Response(
				{"error": f"Failed to generate token: {e}"}, status=status.HTTP_400_BAD_REQUEST
			)
		response = Response({"token":token}, status=status.HTTP_200_OK)
		response.set_cookie('auth-token', token, expires=data["exp"])
		return response

class VerifyToken(APIView):
	authentication_classes = [CookieJWTAuthentication, HeaderJWTAuthentication]

	def get(self, request):
		return Response({"message": "Token verified", "data": request.jwt_data}, status=status.HTTP_200_OK)

