import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
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


# async def startup():
#     # Démarrer les tâches d'initialisation
#     await PongLobby2D.lobbys_list["10"].game_loop()
#     # Ajoutez d'autres tâches si nécessaire

# # Assurez-vous que la fonction startup est exécutée dans la boucle d'événements ASGI
# loop = asyncio.get_event_loop()
# loop.create_task(startup())

# async def start_tasks():
# 	await asyncio.create_task(lobbys_list["10"].check_game_start())
# # # 
# loop = asyncio.get_event_loop()
# lobbys_list["10"].loop = loop.create_task(lobbys_list["10"].game_loop())
# asyncio.run(start_tasks())

