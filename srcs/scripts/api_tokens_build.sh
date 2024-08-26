#!/bin/bash

# Fonction pour générer un token JWT signé en RS512
generate_jwt() {
  local api_name="$1"
  local private_key_path="$2"

  # Vérifier si les paramètres sont fournis
  if [ -z "$api_name" ] || [ -z "$private_key_path" ]; then
    echo "Usage: generate_jwt <API_NAME> <PRIVATE_KEY_PATH>"
    return 1
  fi

  # Vérifier si la clé privée existe
  if [ ! -f "$private_key_path" ]; then
    echo "Clé privée non trouvée: $private_key_path"
    return 1
  fi

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

# Si le script est exécuté directement avec des paramètres
if [ "$#" -eq 2 ]; then
  generate_jwt "$1" "$2"
else
  echo "Usage: $0 <API_NAME> <PRIVATE_KEY_PATH>"
  exit 1
fi

# Exemple d'utilisation de la fonction
# API_NAME="your_api_name" 
# PRIVATE_KEY_PATH="/path/to/your/private_key.pem"
# token=$(generate_jwt "$API_NAME" "$PRIVATE_KEY_PATH")
# echo "Generated JWT Token: $token"