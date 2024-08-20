# syntax=docker/dockerfile:1
FROM python:3 AS django_base
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
WORKDIR /code
COPY requirements.txt /code/
RUN pip install -r requirements.txt

FROM django_base AS django_main
RUN python -m pip install -U 'channels[daphne]'
