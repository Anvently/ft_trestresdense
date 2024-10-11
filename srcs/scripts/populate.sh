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
	local host="${users[$((RANDOM % ${#users[@]}))]}"  # Sélection aléatoire d'un utilisateur
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
		\"host\": \"$host\",
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

#!/bin/bash

send_tournament_results() {
  local USERS=("${@:2}")  # On prend tous les paramètres à partir du 2ème
  local NUM_USERS=$1
  local GAME_NAME="pong2d"
 
  # Génération d'un tournament_id aléatoire
  local TOURNAMENT_ID=$(openssl rand -hex 12)
  
  # Sélection aléatoire d'un utilisateur pour nommer le tournoi
  local HOST="${USERS[$((RANDOM % ${#USERS[@]}))]}"
  local TOURNAMENT_NAME="${HOST} tournament"
  
  # Fonction pour envoyer les résultats d'un match
  send_match_result() {
    local lobby_id=$1
    local player1=$2
    local player2=$3
    local lobby_name=$4
    local score1=$((RANDOM % 10))
    local score2=$((RANDOM % 10))
    
    if [[ $score1 -gt $score2 ]]; then
      winner=$player1
      loser=$player2
      win_score=$score1
      lose_score=$score2
    else
      winner=$player2
      loser=$player1
      win_score=$score2
      lose_score=$score1
    fi

	local json_data="{
    \"lobby_id\": \"${lobby_id}\",
    \"lobby_name\": \"${lobby_name}\",
    \"host\": \"${HOST}\",
	\"game_name\": \"${GAME_NAME}\",
    \"tournament_id\": \"${TOURNAMENT_ID}\",
	\"tournament_name\": \"${TOURNAMENT_NAME}\",
	\"tournament_nbr_players\": ${NUM_USERS},
    \"scores_set\": [
      {
        \"username\": \"${winner}\",
        \"score\": ${win_score},
        \"has_win\": true
      },
      {
        \"username\": \"${loser}\",
        \"score\": ${lose_score},
        \"has_win\": false
      }
    ]
  }"

    # Envoi de la requête POST via curl
    curl --request POST \
      --url http://localhost:8001/post-result/ \
      --header "Authorization: Bearer ${MATCHMAKING_TOKEN}" \
      --header 'Content-Type: application/json' \
      --data "$json_data" > /dev/null

    echo "$winner"  # Retourne le nom du gagnant
  }

  # Déroulement du tournoi en fonction du nombre de joueurs
  if [[ $NUM_USERS -eq 2 ]]; then
    # Finale directe
    send_match_result "${TOURNAMENT_ID}.0" "${USERS[0]}" "${USERS[1]}" "${TOURNAMENT_NAME} final"
    
  elif [[ $NUM_USERS -eq 4 ]]; then
    # Demi-finales
    winner1=$(send_match_result "${TOURNAMENT_ID}.1.0" "${USERS[0]}" "${USERS[1]}" "${TOURNAMENT_NAME} 1st semi")
    winner2=$(send_match_result "${TOURNAMENT_ID}.1.1" "${USERS[2]}" "${USERS[3]}" "${TOURNAMENT_NAME} 2nd semi")

    # Finale
    send_match_result "${TOURNAMENT_ID}.0" "$winner1" "$winner2" "${TOURNAMENT_NAME} final"
    
  elif [[ $NUM_USERS -eq 8 ]]; then
    # Quarts de finale
    winner1=$(send_match_result "${TOURNAMENT_ID}.2.0" "${USERS[0]}" "${USERS[1]}" "${TOURNAMENT_NAME} 1st quarter")
    winner2=$(send_match_result "${TOURNAMENT_ID}.2.1" "${USERS[2]}" "${USERS[3]}" "${TOURNAMENT_NAME} 2nd quarter")
    winner3=$(send_match_result "${TOURNAMENT_ID}.2.2" "${USERS[4]}" "${USERS[5]}" "${TOURNAMENT_NAME} 3rd quarter")
    winner4=$(send_match_result "${TOURNAMENT_ID}.2.3" "${USERS[6]}" "${USERS[7]}" "${TOURNAMENT_NAME} 4th quarter")

    # Demi-finales
    winner_semi1=$(send_match_result "${TOURNAMENT_ID}.1.0" "$winner1" "$winner2" "${TOURNAMENT_NAME} 1st semi")
    winner_semi2=$(send_match_result "${TOURNAMENT_ID}.1.1" "$winner3" "$winner4" "${TOURNAMENT_NAME} 2nd semi")

    # Finale
    send_match_result "${TOURNAMENT_ID}.0" "$winner_semi1" "$winner_semi2" "${TOURNAMENT_NAME} final"
  else
    echo "Le nombre de joueurs doit être 2, 4 ou 8."
    return 1
  fi
}




# Liste des utilisateurs à enregistrer
user_list=("herve" "john" "user2" "foo" "laura" "chloe" "bar" "ashley" "npirad" "akro" "lmahe" "boris" "emma" "julie")

# Appel des fonctions
register "${user_list[@]}"
login_add_friends "${user_list[@]}"
# for i in {1..30}; do
#   post_results "${user_list[@]}"
# done

# Sélection aléatoire d'un nombre fixe d'utilisateurs (par exemple, 4 utilisateurs)
select_random_users() {
  local user_count=$1
  shuf -n "$user_count" -e "${user_list[@]}"
}

random_users=($(select_random_users 8))
send_tournament_results 8 "${random_users[@]}"

# Exécuter la fonction pour un tournoi à 4 joueurs aléatoirement choisis
random_users=($(select_random_users 4))
send_tournament_results 4 "${random_users[@]}"

random_users=($(select_random_users 2))
send_tournament_results 2 "${random_users[@]}"


