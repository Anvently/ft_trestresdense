from django.db import models

# Create your models here.
class	UserInfos(models.Model):
	username = models.CharField(max_length=150)
	avatar = models.ImageField(upload_to="avatars/", blank=True)

class	GameResult(models.Model):
	id = models.IntegerField()
	# memb
