python ./initialize.py

# Démarrer le serveur Django
exec gunicorn pong_server.wsgi:application --bind 0.0.0.0:8002 --capture-output --enable-stdio-inheritance --reload