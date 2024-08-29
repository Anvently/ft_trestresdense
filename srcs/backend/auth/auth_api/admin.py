from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from auth_api.models import User

# # Register your models here.
# UserAdmin.fieldsets = (
# 		(None, {"fields": ("username",)}),
# 		("Custom fields", {"fields": ("external_avatar", "uploaded_avatar", "display_name")}),
# 		(
# 			"Permissions",
# 			{
# 				"fields": (
# 					"is_active",
# 					"is_staff",
# 					"is_superuser",
# 				),
# 			},
# 		),
# 	)

admin.site.register(User, UserAdmin)