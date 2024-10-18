import time
import jwt
import hmac
import hashlib
import time
import struct
import base64
import secrets
from datetime import timedelta
from django.core.cache import cache
from django.utils import timezone

from django.conf import settings

def generate_jwt_token(
    payload, ttl_based=False, expire_after=settings.RSA_KEY_EXPIRATION, ttl_key="exp"
):
	payload["iss"] = settings.ISSUER_URL
	# payload["exp"] = time.time() + expire_after
	if ttl_based:
		payload[ttl_key] = time.time() + expire_after
	return jwt.encode(payload, settings.RSA_PRIVATE_KEY, algorithm="RS512")


def verify_jwt(token, is_ttl_based=False, ttl_key="exp"):
	data = jwt.decode(token, settings.RSA_PUBLIC_KEY, algorithms=["RS512"])
	if is_ttl_based:
		if data[ttl_key] < time.time():
			raise ValueError("Token expired")
	return data

def generate_2fa_token(user):
	"""
	Génère un token 2FA unique pour l'utilisateur.
	"""
	token = secrets.token_hex(16)  # Génère un token hexadécimal de 32 caractères
	expiration = timezone.now() + timedelta(minutes=15)
	
	# Stocke le token et son expiration dans le cache
	cache_key = f"2fa_token_{token}"
	cache.set(cache_key, {
		'user_id': user.id,
		'expiration': expiration
	}, timeout=900)  # 15 minutes en secondes
	
	return token

def verify_2fa_token(token):
	"""
	Vérifie si le token 2FA est valide et non expiré.
	Retourne le pk du user associe si le token est valide, sinon None.
	"""
	cache_key = f"2fa_token_{token}"
	token_data = cache.get(cache_key)
	
	if token_data is None:
		return None
	
	if timezone.now() > token_data['expiration']:
		cache.delete(cache_key)
		return None
	
	return(token_data['user_id'])

def generate_totp_secret():
	return base64.b32encode(secrets.token_bytes(10)).decode()

def get_totp_token(secret, time_step=30, digits=6):
	t = int(time.time() // time_step)
	msg = struct.pack(">Q", t)
	h = hmac.new(base64.b32decode(secret), msg, hashlib.sha1).digest()
	o = h[19] & 15
	token = struct.unpack('>I', h[o:o+4])[0] & 0x7fffffff
	return str(token)[-digits:].zfill(digits)

def verify_totp_token(secret, token, time_step=30, digits=6):
	return get_totp_token(secret, time_step, digits) == token