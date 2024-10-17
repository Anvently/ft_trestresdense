from auth_api.models import User
from rest_framework import serializers
from auth_api.requests import delete_user, post_new_user

class UserInfosSerializer(serializers.ModelSerializer):
	
	url_avatar = serializers.URLField(max_length=300, allow_blank=True, write_only=True, required=False)
	display_name = serializers.CharField(max_length=30, allow_blank=True, required=False)
	password = serializers.CharField(max_length=30, write_only=True, required=True)
	is_2fa_active = serializers.BooleanField(required=False)
	username = serializers.CharField(required=True)
	email = serializers.CharField(required=False)

	class Meta:
		model = User
		fields = ['email', 'username', 'url_avatar', 'display_name', 'password', 'is_2fa_active', 'totp_secret']
		# username = serializers.CharField
		# email = serializers.EmailField()
		# password = serializers.CharField()
	
	def __init__(self, *args, **kwargs):
		super().__init__(*args, **kwargs)
		if self.context['request'].method == 'PATCH':
			self.fields['username'].read_only = True

	def validate_username(self, value):
		if User.objects.filter(username=value).exists():
			raise serializers.ValidationError({"username": "This username is already taken."})
		return value
	
	def validate_email(self, value):
		if User.objects.filter(email=value).exclude(id=self.context['request'].user.id).exists():
			raise serializers.ValidationError({"email": "An account with this email already exists."})
		return value

	def create(self, validated_data):
		user = User(
			username = validated_data["username"]
		)
		if 'email' in validated_data:
			user.email = validated_data["email"]
		user.set_password(validated_data["password"])
		post_new_user(validated_data["username"], validated_data.get("url_avatar"),
				validated_data.get("display_name", validated_data["username"]))
		user.save()
		return user
	
	def update(self, instance, validated_data):
		if 'email' in validated_data:
			instance.email = validated_data["email"]
		if 'password' in validated_data:
			instance.set_password(validated_data["password"])
		if 'is_2fa_active' in validated_data:
			if validated_data['is_2fa_active'] == False:
				instance.totp_secret = ""
			elif instance.is_2fa_active == False:
				instance.totp_secret = "pouet_pouet"
			instance.is_2fa_active = validated_data['is_2fa_active']
		instance.save()
		return instance
	
