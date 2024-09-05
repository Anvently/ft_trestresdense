from django.urls import re_path

from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/pong/square/$', consumers.SquareConsumer.as_asgi()),
	re_path(r'ws/pong/(?P<lobby_id>\w+(?:\.\d+)*)/$', consumers.PongConsumer.as_asgi()),
    # re_path(r'ws/pong/(?P<room_name>\w+)/$', consumers.ChatConsumer.as_asgi()),
]

