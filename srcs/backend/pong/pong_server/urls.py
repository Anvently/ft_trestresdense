"""
URL configuration for pong project.

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
from api.views import PostGameView, RetrieveLobbyView, ListLobbyView, CancelLobbyView, PlayerConcedeView, HealthCheckView

urlpatterns = [
    path('admin/', admin.site.urls),
	path('init-game/', PostGameView.as_view()),
	path('lobby/<lobby_id>',RetrieveLobbyView.as_view()),
	path('lobbies/', ListLobbyView.as_view()),
	path('delete-lobby/<lobby_id>',CancelLobbyView.as_view()),
	path('player-concede/<lobby_id>/<player_id>', PlayerConcedeView.as_view()),
	path('health/', HealthCheckView.as_view(), name='health-check'),
]
