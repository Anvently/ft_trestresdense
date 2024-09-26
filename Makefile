TARGET		=	compose

DATA_DIR	= ./data/

DATA_DEPS	= $(DATA_DIR) $(DATA_DIR)db/ \
				$(DATA_DIR)keys/ssl/ssl.crt $(DATA_DIR)keys/ssl/ssl.key \
				$(DATA_DIR)keys/rsa/key.pem $(DATA_DIR)keys/rsa/pub.pem \
				$(DATA_DIR)logs/ \
				$(API_TOKENS_FILES)

space := $(empty) $(empty)
comma := ,

API_TOKENS			=	auth pong users matchmaking
API_TOKENS_PARAMS	=	$(subst $(space),$(comma),$(API_TOKENS))

API_TOKENS_FILES	=	$(addprefix $(DATA_DIR)keys/api-tokens/,$(API_TOKENS))

all: build compose

$(DATA_DIR)keys/ssl/ssl.crt:
	$(MAKE) gen_ssl

$(DATA_DIR)keys/ssl/ssl.key:
	$(MAKE) gen_ssl

$(DATA_DIR)keys/rsa/key.pem:
	$(MAKE) gen_rsa
$(DATA_DIR)keys/rsa/pub.pem:
	$(MAKE) gen_rsa

$(DATA_DIR)logs/:
	mkdir -p $(DATA_DIR)logs

$(API_TOKENS_FILES): $(DATA_DIR)keys/rsa/key.pem
	-mkdir -p $(DATA_DIR)keys/api-tokens/
	./srcs/scripts/api_tokens_build.sh $(API_TOKENS_PARAMS) $(DATA_DIR)keys/rsa/key.pem $(DATA_DIR)keys/api-tokens/

gen_ssl:
	-mkdir -p $(DATA_DIR)keys/ssl
	@openssl req -x509 -nodes -newkey rsa:4096 -keyout $(DATA_DIR)keys/ssl/ssl.key -out $(DATA_DIR)keys/ssl/ssl.crt -sha256 -days 365 \
		-subj="/CN=npirard"

gen_rsa:
	-mkdir -p $(DATA_DIR)keys/rsa
	openssl genpkey -out $(DATA_DIR)keys/rsa/key.pem -algorithm rsa -pkeyopt rsa_keygen_bits:2048
	openssl rsa -in $(DATA_DIR)keys/rsa/key.pem -out $(DATA_DIR)keys/rsa/pub.pem -pubout
	$(MAKE) $(API_TOKENS_FILES)
	# openssl rsa -in $(DATA_DIR)keys/rsa/key.pem -outform PEM -pubout -out $(DATA_DIR)keys/rsa/pub.pem
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
	docker run -v ./data:/$(DATA_DIR) -it --rm alpine rm "-rf" "/$(DATA_DIR)"

populate:
	./srcs/scripts/populate.sh $(shell cat ./data/keys/api-tokens/matchmaking)

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
