"""
URL configuration for auth_server project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path
from rest_framework import routers
from auth_api.views import VerifyToken, LoginView, \
            RegisterView, UpdateView, DeleteView, SignIn42CallbackView, LogoutView

# router = routers.DefaultRouter()
# router.register(r'users', UserView)

urlpatterns = [
    path('admin/', admin.site.urls),
	# path('', UserView.as_view(), name='users'),
	# path("generate-token/", GenerateToken.as_view(), name="generate-token"),
    path("api/auth/verify-token/", VerifyToken.as_view(), name="verify-token"),
	path("api/auth/login/", LoginView.as_view(), name="login"),
	path("api/auth/register/", RegisterView.as_view(), name="register"),
	path("api/auth/update/", UpdateView.as_view(), name="update"),
	path("api/auth/delete/", DeleteView.as_view(), name="delete"),
	path("api/auth/logout/", LogoutView.as_view()),
	path("api/auth/42-api-callback", SignIn42CallbackView.as_view(), name="42-callback"),
]
