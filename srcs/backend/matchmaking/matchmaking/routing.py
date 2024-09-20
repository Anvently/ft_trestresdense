from django.urls import re_path

from . import consumers

websocket_urlpatterns = [
	re_path(r'ws/matchmaking/(?P<username>[\w-]+)/$', consumers.MatchMakingConsumer.as_asgi()),
]
