from django.contrib.auth.models import User
from rest_framework import serializers

class UserSerializer(serializers.HyperlinkedModelSerializer):
	class Meta:
		model = User
		fields = ['username', 'first_name', 'last_name', 'email', \
			'password', 'groups', 'is_staff', 'last_login', 'is_superuser']

class UserInfosSerializer(serializers.HyperlinkedModelSerializer):
	
	url_avatar = serializers.URLField(max_length=300, allow_blank=True, required=False)
	display_name = serializers.CharField(max_length=30, allow_blank=True, required=False)

	class Meta:
		model = User
		fields = ['username', 'password', 'email', 'url_avatar', 'display_name']
		# username = serializers.CharField
		# email = serializers.EmailField()
		# password = serializers.CharField()
		
	def create(self, validated_data):
		user = User(
			username = validated_data["username"]
		)
		if 'email' in validated_data:
			user.email = validated_data["email"]
		user.set_password(validated_data["password"])
		user.save()
		return user
	
	def update(self, instance, validated_data):
		if 'email' in validated_data:
			instance.email = validated_data["email"]
		instance.email = validated_data["email"]
		instance.set_password(validated_data["password"])
		instance.save()
		return instance
