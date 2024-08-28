from typing import Any, Iterable
from django.db import models
from django.contrib.auth import models as user_models
from django.urls import reverse

# Create your models here.
class	User(user_models.AbstractUser):

	def upload_to(instance, filename) -> str:
		return '{}.{}'.format(instance.username, filename.split('.')[-1])

	uploaded_avatar = models.ImageField(upload_to=upload_to, blank=True, default="__default__.png")
	external_avatar = models.URLField(blank=True)
	api_name: str = None

	def __str__(self) -> str:
		return self.username
	
	def get_avatar_url(self) -> str:
		if self.uploaded_avatar:
			if self.uploaded_avatar.name != "__default__.png" or not self.external_avatar:
				return "/avatars/{}".format(self.uploaded_avatar.name)
		return self.external_avatar
	
	def delete(self):
		if self.uploaded_avatar.name != "__default__.png":
			self.uploaded_avatar.delete()
		return super().delete()
	
	def save(self, *args, **kwargs) -> None:
		try:
			this = User.objects.get(id=self.id)
			if this.uploaded_avatar:
				if ((this.uploaded_avatar != self.uploaded_avatar or this.username != self.username)
					and this.uploaded_avatar.name != "__default__.png"):
					this.uploaded_avatar.delete(save=False)
			if not self.uploaded_avatar:
					self.uploaded_avatar = "__default__.png"
		except: pass
		return super(User, self).save(*args, **kwargs)
		

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
	
