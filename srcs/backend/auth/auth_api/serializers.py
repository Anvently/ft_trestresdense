from django.contrib.auth.models import User
from rest_framework import serializers

class UserSerializer(serializers.HyperlinkedModelSerializer):
	class Meta:
		model = User
		fields = ['username', 'first_name', 'last_name', 'email', \
			'password', 'groups', 'is_staff', 'last_login', 'is_superuser']

class UserInfosSerializer(serializers.HyperlinkedModelSerializer):
	class Meta:
		model = User
		fields = ['username', 'password', 'email']
		# username = serializers.CharField
		# email = serializers.EmailField()
		# password = serializers.CharField()
		
	def create(self, validated_data):
		user = User(
			username = validated_data["username"],
			email = validated_data["email"],
		)
		user.set_password(validated_data["password"])
		user.save()
		return user
	
	def update(self, instance, validated_data):
		instance.email = validated_data["email"]
		instance.set_password(validated_data["password"])
		instance.save()
		return instance
