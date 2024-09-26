#!/bin/bash

MATCHMAKING_TOKEN=$1

# Fonction d'enregistrement des utilisateurs
register() {
	local list=("$@")  # "$@" capture tous les arguments passés à la fonction sous forme de tableau

	# Boucle sur chaque élément de la liste
	for user in "${list[@]}"
	do
		# Envoie une requête POST avec curl pour enregistrer chaque utilisateur
		curl --insecure --request POST \
		--url https://localhost:8083/api/auth/register/ \
		--header 'Content-Type: multipart/form-data' \
		--form username="${user}" \
		--form password="${user}" \
		--form "url_avatar=https://robohash.org/${user}?set=set4&bgset=&size=80x80" \
		--form email="${user}@gmail.fr" \
		--form display_name="${user}"

		# Affiche le statut après chaque requête (optionnel)
		echo "Requête d'enregistrement envoyée pour : ${user}"
	done
}

# Fonction pour se connecter et ajouter des amis
login_add_friends() {
	local list=("$@")  # "$@" capture tous les arguments passés à la fonction sous forme de tableau

	# Boucle sur chaque élément de la liste
	for user in "${list[@]}"
	do
		# Connexion de l'utilisateur et récupération du token
		response=$(curl --insecure --request POST \
		--url https://localhost:8083/api/auth/login/ \
		--header 'Content-Type: application/json' \
		--data "{\"username\":\"${user}\", \"password\":\"${user}\"}")
		
		# Extraction du token avec jq
		token=$(echo "$response" | jq -r '.token')

		# Vérification que le token est bien récupéré
		if [[ -z "$token" ]]; then
			echo "Erreur de connexion pour : ${user}"
			continue
		fi

		# Création de la liste des amis
		friends_json=$(printf '%s\n' "${list[@]}" | jq -R . | jq -s .)

		# Ajout des amis avec la requête POST
		curl --insecure --request POST \
		--url https://localhost:8083/api/friends-update/ \
		--header 'Content-Type: application/json' \
		--cookie auth-token="${token}" \
		--data "{\"friends\": $friends_json}"

		# Affiche le statut après chaque requête (optionnel)
		echo "Liste d'amis mise à jour pour : ${user}"
	done
}

# Fonction pour générer un ID aléatoire pour le lobby
generate_lobby_id() {
  echo "$(tr -dc 'a-z0-9' </dev/urandom | head -c 8).$(tr -dc 'a-z0-9' </dev/urandom | head -c 6)"
}

# Fonction pour poster des résultats arbitraires
post_results() {
	local users=("$@")  # Liste des utilisateurs donnée en paramètre
	local num_scores=$(shuf -i 2-4 -n 1)  # Choisir aléatoirement entre 2 et 4 entrées
	local lobby_id=$(generate_lobby_id)  # ID aléatoire pour le lobby
	local lobby_name="${users[0]}'s lobby"  # Nom du lobby basé sur le premier utilisateur de la liste
	local game_name=$(shuf -e "Pong3D" "Pong2D" -n 1)  # Sélection aléatoire du nom du jeu

	# Génération du gagnant (un seul gagnant)
	local winner_index=$(shuf -i 0-$((num_scores - 1)) -n 1)

	# Construction du tableau des scores
	local scores_set="["

	for ((i=0; i<num_scores; i++)); do
		local username="${users[$((RANDOM % ${#users[@]}))]}"  # Sélection aléatoire d'un utilisateur
		local score=$(shuf -i 0-10 -n 1)  # Score aléatoire entre 0 et 10
		local has_win=false
		if [ $i -eq $winner_index ]; then
		has_win=true  # Cet utilisateur est le gagnant
		fi

		# Ajouter l'entrée au JSON des scores
		scores_set="$scores_set{
		\"username\": \"$username\",
		\"score\": $score,
		\"has_win\": $has_win
		}"

		# Ajouter une virgule entre les entrées sauf la dernière
		if [ $i -lt $((num_scores - 1)) ]; then
		scores_set="$scores_set,"
		fi
	done

	scores_set="$scores_set]"  # Fermer le tableau JSON

	# Construction du JSON final
	local json_payload="{
		\"lobby_id\": \"$lobby_id\",
		\"lobby_name\": \"$lobby_name\",
		\"game_name\": \"$game_name\",
		\"scores_set\": $scores_set
	}"

	# Envoi du JSON au serveur via une requête POST
	curl --request POST \
	--url http://localhost:8001/post-result/ \
	--header "Authorization: Bearer ${MATCHMAKING_TOKEN}" \
	--header 'Content-Type: application/json' \
	--data "$json_payload"

	# # Affichage du statut pour vérification (optionnel)
	# echo "Résultat posté pour le lobby : $lobby_name"
	# echo "$json_payload"  # Affichage du JSON généré pour inspection
}

# Liste des utilisateurs à enregistrer
user_list=("herve" "john" "user2" "foo" "laura" "chloe" "bar" "ashley" "npirad" "akro" "lmahe" "boris" "emma" "julie")

# Appel des fonctions
register "${user_list[@]}"
login_add_friends "${user_list[@]}"
for i in {1..30}; do
  post_results "${user_list[@]}"
done
