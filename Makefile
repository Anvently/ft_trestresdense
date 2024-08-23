TARGET		=	compose

DATA_DIR	= ./data/

DATA_DEPS	= $(DATA_DIR) $(DATA_DIR)db/ \
				data/keys/ssl/ssl.crt data/keys/ssl/ssl.key \
				data/keys/rsa/key.pem data/keys/rsa/pub.pem \
				data/logs/

all: build compose

data/keys/ssl/ssl.crt:
	$(MAKE) gen_ssl

data/keys/ssl/ssl.key:
	$(MAKE) gen_ssl

data/keys/rsa/key.pem:
	$(MAKE) gen_rsa
data/keys/rsa/pub.pem:
	$(MAKE) gen_rsa

data/logs/:
	mkdir -p data/logs

gen_ssl:
	-mkdir -p data/keys/ssl
	@openssl req -x509 -nodes -newkey rsa:4096 -keyout data/keys/ssl/ssl.key -out data/keys/ssl/ssl.crt -sha256 -days 365 \
		-subj="/CN=npirard"

gen_rsa:
	-mkdir -p data/keys/rsa
	openssl genpkey -out data/keys/rsa/key.pem -algorithm rsa -pkeyopt rsa_keygen_bits:2048
	openssl rsa -in data/keys/rsa/key.pem -out data/keys/rsa/pub.pem -pubout 
	# openssl rsa -in data/keys/rsa/key.pem -outform PEM -pubout -out data/keys/rsa/pub.pem
	# openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in keypair.pem -out pkcs8.key

gen_rsa2:
	ssh-keygen -f key.pub -e -m pem

compose: $(DATA_DEPS)
	docker compose up --remove-orphans

build: $(DATA_DEPS)
	docker compose build

$(DATA_DIR)db/:
	-mkdir $(DATA_DIR)db

$(DATA_DIR):
	-mkdir -p $(DATA_DIR)

root_rm:
	docker run -v ./data:/data/ -it --rm alpine rm "-rf" "/data/"

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
