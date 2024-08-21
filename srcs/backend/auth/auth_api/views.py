from django.contrib.auth.models import User
from rest_framework.views import APIView
from rest_framework.response import Response
from auth_api.serializers import UserSerializer

class UserView(APIView):
	def get(self, request):
		users = User.objects.all()
		serializer = UserSerializer(users, many=True)
		return Response(serializer.data)


# class UserViewSet(viewsets.ModelViewSet):
#	queryset = User.objects.all().order_by('-date_joined')
#	serializer_class = UserSerializer
#	permission_classes = [permissions.IsAuthenticated]

# Create your views here.
