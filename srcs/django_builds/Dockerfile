# syntax=docker/dockerfile:1
FROM python:3.11.2 AS django_base
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
WORKDIR /code
COPY ./requirements.txt /code/
RUN pip3 install -r requirements.txt
RUN apt-get install curl
COPY ./start_script.sh /etc/init.d/start_script.sh
RUN chmod 777 /etc/init.d/start_script.sh
CMD ["sh", "/etc/init.d/start_script.sh" ]

FROM django_base AS django_restapi
RUN pip3 install -U  djangorestframework pyjwt[crypto]

FROM django_restapi AS django_authapi
RUN pip3 install -U requests

FROM django_restapi AS django_usersapi
RUN pip3 install -U Pillow drf-nested-routers

FROM django_authapi AS django_websocketapi
RUN pip3 install -U 'channels[daphne]'
RUN pip3 install -U channels-redis
RUN pip3 install -U pottery

FROM django_websocketapi AS django_pongapi
RUN pip3 install -U adrf
