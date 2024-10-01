from typing import Any, Iterable
from django.db import models
from django.contrib.auth import models as user_models
from django.urls import reverse
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.utils import timezone

# Create your models here.
class	User(user_models.AbstractUser):

	def upload_to(instance, filename) -> str:
		return '{}.{}'.format(instance.username, filename.split('.')[-1])

	username = models.CharField(
        "Username",
        max_length = 150,
        unique = True,
        help_text = ("Required. 150 characters or fewer. Letters, and digits only."),
        # customize the above string as you want
        validators = [UnicodeUsernameValidator],
        error_messages = {
            'unique': ("A user with that username already exists."),
        },
    )
	uploaded_avatar = models.ImageField(upload_to=upload_to, blank=True, default="__default__.jpg")
	external_avatar = models.URLField(blank=True)
	display_name = models.CharField(max_length=30, default="DisplayName")
	last_visit = models.DateTimeField(blank=True, default=timezone.now)
	friends = models.ManyToManyField(
		'self',
		blank=True,
		related_name='friend_of',
		symmetrical=False
	)

	api_name: str = None

	def __str__(self) -> str:
		return self.username
	
	def get_avatar_url(self) -> str:
		if self.uploaded_avatar:
			if self.uploaded_avatar.name != "__default__.jpg" or not self.external_avatar:
				return "/avatars/{}".format(self.uploaded_avatar.name)
		return self.external_avatar
	
	def delete(self):
		if self.uploaded_avatar.name != "__default__.jpg":
			self.uploaded_avatar.delete()
		return super().delete()
	
	def save(self, *args, **kwargs) -> None:
		try:
			this = User.objects.get(id=self.id)
			if this.uploaded_avatar:
				if ((this.uploaded_avatar != self.uploaded_avatar or this.username != self.username)
					and this.uploaded_avatar.name != "__default__.jpg"):
					this.uploaded_avatar.delete(save=False)
			if not self.uploaded_avatar:
					self.uploaded_avatar = "__default__.jpg"
		except: pass
		return super(User, self).save(*args, **kwargs)
	
class	Tournament(models.Model):
	tournament_id = models.CharField(max_length=64, verbose_name="tournament unique id", unique=True)
	game_name = models.CharField(max_length=50)
	date = models.DateTimeField(auto_now_add=True, editable=False)
	number_players = models.SmallIntegerField()

	def __str__(self) -> str:
		return self.tournament_id.__str__()

class	Lobby(models.Model):
	""" 
	Ex :
	1598 => simple match, no tournament
	1598.0 => finale
	1598.1.0 => 1st semi-finale
	1598.1.1 => 2nde semi-finale
	1598.2.0 => 1st quarter
	...
	1598.2.3 => 4th quarter
	"""
	lobby_id = models.CharField(max_length=64, verbose_name="lobby unique id", unique=True)
	lobby_name = models.CharField(max_length=64, verbose_name="lobby_display_name", default="Unknown")
	game_name = models.CharField(max_length=50)
	date = models.DateTimeField(auto_now_add=True, editable=False)
	tournament = models.ForeignKey(
		Tournament,
		null=True,
		verbose_name="corresponding tournament",
		on_delete=models.CASCADE,
		related_name="lobbys_set"
	)

	def __str__(self) -> str:
		return self.lobby_id.__str__()

class	Score(models.Model):
	user = models.ForeignKey(
		User,
		null=True,
		verbose_name="corresponding user",
		on_delete=models.SET_NULL,
		related_name="scores_set"
	)
	lobby = models.ForeignKey(
		Lobby,
		verbose_name="corresponding lobby",
		on_delete=models.CASCADE,
		related_name="scores_set"
	)
	date = models.DateTimeField(auto_now_add=True, editable=False)
	score = models.IntegerField(default=0)
	has_win = models.BooleanField(default=False)

	def __str__(self) -> str:
		return self.lobby_id.__str__()
	
