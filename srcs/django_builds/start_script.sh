./manage.py makemigrations
./manage.py migrate
export DJANGO_SUPERUSER_PASSWORD=admin
export DJANGO_SUPERUSER_USERNAME=admin
./manage.py createsuperuser --noinput 2> /dev/null
exec python3 manage.py runserver 0.0.0.0:${SERVER_PORT}