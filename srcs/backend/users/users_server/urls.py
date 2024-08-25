"""
URL configuration for users_server project.

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
from django.urls import path, include

from users_api.views import UserViewSet, LobbyViewSet, ScoreViewSet
from rest_framework.routers import SimpleRouter
from rest_framework_nested.routers import NestedSimpleRouter
from rest_framework.authtoken import views

router = SimpleRouter()
router.register(r'users', UserViewSet, basename='users')
router.register(r'lobbys', LobbyViewSet, basename='lobbys')
nested_router = NestedSimpleRouter(router, r'users', lookup='user')
nested_router.register(r'scores', ScoreViewSet, basename='user_scores')

# urlpatterns = router.urls

urlpatterns = [
    path('', include(router.urls)),
	path('', include(nested_router.urls)),
    path('admin/', admin.site.urls),
]
