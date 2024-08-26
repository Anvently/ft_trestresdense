from typing import Any
from django.db import models
from django.urls import reverse

# Create your models here.
class	User(models.Model):
	username = models.CharField(max_length=150)
	uploaded_avatar = models.ImageField(upload_to="", blank=True, default="__default__.png")
	external_avatar = models.URLField(blank=True)

	def __str__(self) -> str:
		return self.username
	
	def get_avatar_url(self) -> str:
		if self.uploaded_avatar:
			return self.uploaded_avatar.url
		return self.external_avatar
	
	def delete(self):
		self.uploaded_avatar.delete()
		return super().delete()

class	Lobby(models.Model):
	lobby_id = models.BigIntegerField(verbose_name="lobby unique id")
	game_name = models.CharField(max_length=50)

	def __str__(self) -> str:
		return self.lobby_id.__str__()

class	Score(models.Model):
	user = models.ForeignKey(
		User,
		null=True,
		verbose_name="corresponding user",
		on_delete=models.SET_NULL,
		related_name="scores_set")
	lobby = models.ForeignKey(
		Lobby,
		verbose_name="corresponding lobby",
		on_delete=models.CASCADE,
		related_name="scores_set"
	)
	score = models.IntegerField(default=0)
	has_win = models.BooleanField(default=False)

	def __str__(self) -> str:
		return self.lobby_id.__str__()
	
