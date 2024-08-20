TARGET		=	compose

DATA_DIR	= ./data/

DATA_DEPS	= $(DATA_DIR) $(DATA_DIR)/db/ srcs/nginx/ssl.crt srcs/nginx/ssl.key srcs/nginx/logs/

all: build compose

srcs/nginx/ssl.crt:
	$(MAKE) gen_ssl

srcs/nginx/ssl.key:
	$(MAKE) gen_ssl

srcs/nginx/logs/:
	mkdir srcs/nginx/logs

gen_ssl:
	@openssl req -x509 -nodes -newkey rsa:4096 -keyout srcs/nginx/ssl.key -out srcs/nginx/ssl.crt -sha256 -days 365 \
		-subj="/CN=npirard"

compose: $(DATA_DEPS)
	docker compose up

build: $(DATA_DEPS)
	docker compose build

$(DATA_DIR)/db:
	mkdir -f $(DATA_DIR)/db

$(DATA_DIR):
	mkdir -f $(DATA_DIR)

stop:
	docker compose down

# nginx_it:
# 	docker exec -it nginx_c /bin/sh

clean:
	-docker stop $(shell docker ps -qa)
	-docker rm $(shell docker ps -qa)
	-docker rmi -f $(shell docker images -qa)
	-docker volume rm $(shell docker volume ls -q)
	-docker network rm $(shell docker network ls -q) 2>/dev/null

fclean: clean
	rm -rf $(DATA_DEPS)

re: fclean all
