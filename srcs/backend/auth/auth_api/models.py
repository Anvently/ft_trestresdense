from django.db import models
from django.contrib.auth.models import AbstractUser
# Create your models here.

class	User(AbstractUser):

	def upload_to(instance, filename) -> str:
		return '{}.{}'.format(instance.username, filename.split('.')[-1])
	
	email = models.EmailField("email address", blank=True, unique=True)

	def __str__(self) -> str:
		return self.username
	
