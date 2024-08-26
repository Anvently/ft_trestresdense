import time

import jwt

from django.conf import settings

def generate_jwt_token(
    payload, ttl_based=False, expire_after=settings.RSA_KEY_EXPIRATION, ttl_key="exp"
):
	payload["iss"] = settings.ISSUER_URL
	if ttl_based:
		payload[ttl_key] = time.time() + expire_after
	return jwt.encode(payload, settings.RSA_PRIVATE_KEY, algorithm="RS512")


def verify_jwt(token, is_ttl_based=False, ttl_key="exp"):
	data = jwt.decode(token, settings.RSA_PUBLIC_KEY, algorithms=["RS512"])
	if is_ttl_based:
		if data[ttl_key] < time.time():
			raise ValueError("Token expired")
	return data