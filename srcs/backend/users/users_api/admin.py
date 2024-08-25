from django.contrib import admin
from users_api.models import User, Score, Lobby

# Register your models here.
admin.site.register(User)
admin.site.register(Lobby)
admin.site.register(Score)