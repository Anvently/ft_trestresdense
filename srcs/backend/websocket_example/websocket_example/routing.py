from django.urls import re_path

from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/websocket_example/square/$', consumers.SquareConsumer.as_asgi()),
    # re_path(r'ws/websocket_example/(?P<room_name>\w+)/$', consumers.ChatConsumer.as_asgi()),
]

