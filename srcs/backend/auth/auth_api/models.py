from django.db import models
from django.contrib.auth.models import AbstractUser
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.utils.deconstruct import deconstructible
# Create your models here.

@deconstructible
class CustomValidator(UnicodeUsernameValidator):
	regex = r"^(?!042)[\w@+-]+\Z"
	message = "Enter a valid username. This value may contain only letters, " \
		"numbers, and @/+/-/_ characters. It must not start with 042."
	flags = 0

class	User(AbstractUser):

	def upload_to(instance, filename) -> str:
		return '{}.{}'.format(instance.username, filename.split('.')[-1])
	
	username_validator = CustomValidator()

	username = models.CharField(
		"username",
		max_length=150,
		unique=True,
		help_text="Required. 150 characters or fewer. Letters, digits and @/./+/-/_ only.",
		validators=[username_validator],
		error_messages={
			"unique": "A user with that username already exists.",
		},
		editable=False,
	)
	email = models.EmailField("email address", blank=True, null=True, unique=True)
	is_2fa_active = models.BooleanField("is 2fa activated", default=False)
	totp_secret = models.CharField(max_length=32, blank=True, null=True)

	def __str__(self) -> str:
		return self.username
