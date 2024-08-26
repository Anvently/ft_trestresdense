#!/bin/bash

# Fonction pour générer un token JWT signé en RS512
generate_jwt() {
  local api_name="$1"
  local private_key_path="$2"

  # Générer l'en-tête et le payload
  local header=$(echo -n '{"alg":"RS512","typ":"jwt"}' | openssl base64 -e -A | tr '+/' '-_' | tr -d '=')
  local payload=$(echo -n "{\"api\":\"$api_name\",\"exp\":\"never\"}" | openssl base64 -e -A | tr '+/' '-_' | tr -d '=')

  # Combiner l'en-tête et le payload
  local unsigned_token="${header}.${payload}"

  # Signer le token avec la clé privée en utilisant RS512
  local signature=$(echo -n "$unsigned_token" | openssl dgst -sha512 -sign "$private_key_path" | openssl base64 -e -A | tr '+/' '-_' | tr -d '=')

  # Générer le token JWT complet
  local jwt_token="${unsigned_token}.${signature}"

  # Retourner le token
  echo "$jwt_token"
}

# Fonction principale pour traiter la liste des API et générer les fichiers correspondants
generate_tokens_for_apis() {
  local api_name_list="$1"
  local private_key_path="$2"
  local output_dir="$3"

  # Vérifier si le dossier de sortie existe, sinon le créer
  if [ ! -d "$output_dir" ]; then
    mkdir -p "$output_dir"
  fi

  # Séparer la liste des API par des virgules et traiter chaque API
  IFS=',' read -ra api_names <<< "$api_name_list"
  for api_name in "${api_names[@]}"; do
    local token=$(generate_jwt "$api_name" "$private_key_path")
    echo "$token" > "$output_dir/$api_name"
    echo "Token généré pour $api_name: $output_dir/$api_name"
  done
}

# Si le script est exécuté directement avec les paramètres nécessaires
if [ "$#" -eq 3 ]; then
  generate_tokens_for_apis "$1" "$2" "$3"
else
  echo "Usage: $0 <API_NAME_LIST> <PRIVATE_KEY_PATH> <OUTPUT_DIR>"
  exit 1
fi