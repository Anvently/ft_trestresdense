from django.db import models
from django.utils.crypto import get_random_string
from typing import Any
from django.contrib.auth.models import User
from auth_api.serializers import UserInfosSerializer
from auth_api.requests import post_new_user
# Create your models here.

def	get_or_create_user(infos: dict[str, Any]) -> User:
	try:
		user = User.objects.get(username="%{0}".format(infos['username']))
		return user
	except:
		infos["password"]= get_random_string(length=36)
		serializer=UserInfosSerializer(data=infos)
		if not serializer.is_valid():
			return None
		serializer.validated_data["username"] = "%{0}".format(serializer.validated_data["username"])
		post_new_user(serializer.validated_data["username"], infos.get("url_avatar"), infos.get("display_name", infos["username"]))
		return serializer.save() 