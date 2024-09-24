from auth_api.models import User
from rest_framework import serializers

class UserSerializer(serializers.HyperlinkedModelSerializer):
	class Meta:
		model = User
		fields = ['username', 'first_name', 'last_name', 'email', \
			'password', 'groups', 'is_staff', 'last_login', 'is_superuser']

class UserInfosSerializer(serializers.HyperlinkedModelSerializer):
	
	url_avatar = serializers.URLField(max_length=300, allow_blank=True, required=False)
	display_name = serializers.CharField(max_length=30, allow_blank=True, required=False)
	password = serializers.CharField(max_length=30, write_only=True, required=True)

	class Meta:
		model = User
		fields = ['email', 'username', 'url_avatar', 'display_name', 'password']
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
		if 'password' in validated_data:
			instance.set_password(validated_data["password"])
		instance.save()
		return instance
