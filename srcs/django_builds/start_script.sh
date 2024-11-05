./manage.py makemigrations
./manage.py migrate

if [ -z "$PRODUCTION" ]; then
	export DJANGO_SUPERUSER_PASSWORD=admin
	export DJANGO_SUPERUSER_USERNAME=admin
	./manage.py createsuperuser --noinput 2> /dev/null
	exec python3 manage.py runserver 0.0.0.0:${SERVER_PORT}
else
	if [ "$SERVER_TYPE" = daphne ]; then
		exec daphne -v 0 -b 0.0.0.0 -p ${SERVER_PORT} ${APPLICATION_NAME}
	elif [ "$SERVER_TYPE" = gunicorn ]; then
		exec gunicorn ${APPLICATION_NAME} --bind 0.0.0.0:${SERVER_PORT}
	else
		echo >&2 "Warning: production variable defined but missing server type. Starting on development server."
		exec python3 manage.py runserver 0.0.0.0:${SERVER_PORT}
	fi
fi