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
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static

from users_api.views import UserViewSet, LobbyViewSet, ScoreViewSet,\
	AvatarView, ApiUserView, TurnamentViewSet, LobbyPostViewSet, MeUserView, \
	BatchUsersView, FriendsUpdateView
from rest_framework.routers import SimpleRouter
from rest_framework_nested.routers import NestedSimpleRouter
from rest_framework.authtoken import views

router = SimpleRouter()
router.register(r'users', UserViewSet, basename='users')
router.register(r'lobbys', LobbyViewSet, basename='lobbys')
router.register(r'tournaments', TurnamentViewSet, basename='turnaments')
nested_router = NestedSimpleRouter(router, r'users', lookup='user')
nested_router.register(r'scores', ScoreViewSet, basename='user_scores')
internal_router = SimpleRouter()
internal_router.register(r'edit-users', ApiUserView, basename='api_user_view')
internal_router.register(r'post-result', LobbyPostViewSet, basename='api_result_view')

# urlpatterns = router.urls

urlpatterns = [
    path('api/', include(router.urls)),
	path('api/', include(nested_router.urls)),
    path('admin/', admin.site.urls),
	re_path(r'^api/lobbys/(?P<lobby_id>[\w.-]+)/$', LobbyViewSet.as_view({'get': 'retrieve'}), name='lobby-detail'),
    path('api/lobbys/', LobbyViewSet.as_view({'get': 'list'}), name='lobby-list'),
	path('api/users/<username>/avatar/', AvatarView.as_view()),
	path('api/users-batch/', BatchUsersView.as_view()),
	path('api/friends-update/', FriendsUpdateView.as_view()),
	path('api/me/', MeUserView.as_view()),
	path('', include(internal_router.urls)),
]
