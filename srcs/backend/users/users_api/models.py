from django.db import models

# Create your models here.
class	User(models.Model):
	username = models.CharField(max_length=150)
	avatar = models.ImageField(upload_to="avatars/", blank=True)

	def __str__(self) -> str:
		return self.username

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
	
