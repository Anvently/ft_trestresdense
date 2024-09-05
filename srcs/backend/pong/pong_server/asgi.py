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
