import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter, ChannelNameRouter
from channels.auth import CookieMiddleware
from pong_server import routing


os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'pong_server.settings')

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": CookieMiddleware(
        URLRouter(
            routing.websocket_urlpatterns
        )
    ),
})

# from pong_server.consumers import lobbys_list
# from typing import List
# import asyncio

# game_queue: List[str] = []

# async def game_loop_monitor():
# 	while True:
# 		print("pouet")
# 		if game_queue:
# 			game_id = game_queue.pop()
# 			if game_id in lobbys_list:
# 				await lobbys_list[game_id].start_game_loop()
# 		await asyncio.sleep(0.5)

