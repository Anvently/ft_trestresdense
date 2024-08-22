# syntax=docker/dockerfile:1
FROM python:3 AS django_base
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
WORKDIR /code
COPY requirements.txt /code/
RUN pip3 install -r requirements.txt

FROM django_base AS django_restapi
RUN pip3 install -U  djangorestframework djangorestframework-simplejwt[crypto]
	
FROM django_base AS django_websocketapi
RUN pip3 install -U 'channels[daphne]'
