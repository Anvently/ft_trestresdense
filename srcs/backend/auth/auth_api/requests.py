import requests
from django.conf import settings
from rest_framework.exceptions import APIException
from rest_framework import status
from django.http.request import HttpRequest
from typing import Any

class StatusException(APIException):
	status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
	default_detail = 'We were not able to propagate your action to other services. Action {0} was not performed.'
	default_code = 'error'

	def __init__(self, action_id:str = "", res_status=None, res_content=None, detail=None):
		code = self.default_code
		self.detail = self.default_detail.format(action_id)
		if detail:
			self.detail = self.detail + '\n' + detail
		if res_status:
			self.detail = self.detail + '\n' + 'Received status was: ' + str(res_status)
		if res_content:
			self.detail = self.detail + '\n' + 'Received content was: ' + str(res_content)

	def __str__(self):
		return str(self.detail)

def post_new_user(username: str, url_avatar: str = None, display_name: str = None) -> bool:
	data = {"username": username}
	data["display_name"] = display_name
	if url_avatar:
		data["url_avatar"] = url_avatar
	try:
		response = requests.post('http://users-api:8001/edit-users/?format=json',
						data=data,
						headers={
							'Host': 'localhost',
							'Authorization': 'Bearer {0}'.format(settings.API_TOKEN.decode('ASCII'))
							}
						)
	except:
		raise StatusException("adding_user")
	if response == None or response.status_code != 201:
		raise StatusException("adding_user", response.status_code, response.content)
	return True

def delete_user(username: str) -> bool:
	try:
		response = requests.delete('http://users-api:8001/edit-users/{0}/?format=json'.format(username),
						headers={
								'Host': 'localhost',
								'Authorization': 'Bearer {0}'.format(settings.API_TOKEN.decode('ASCII'))
								}
							)
	except:
		raise StatusException("deleting_user")
	if response == None or (response.status_code != 204):
		raise StatusException("deleting_user", response.status_code, response.content)
	return True

def obtain_oauth_token(request:HttpRequest, code:str) -> str:
	data = {
		'grant_type':'authorization_code',
		'client_id':settings.API42_UUID,
		'client_secret':settings.API42_SECRET,
		'code': code,
		'redirect_uri': f"https://{request.META['HTTP_HOST']}:8083/api/auth/42-api-callback"
	}
	try:
		response = requests.post("https://api.intra.42.fr/oauth/token",
						data=data,
						allow_redirects=False,
		)
		json_content = response.json()
	except:
		raise StatusException("obtain_auth_token_for_user")
	if response.status_code != 200 or not "access_token" in json_content:
		if json_content.get('error') == "invalid_client":
			raise StatusException("obtain_auth_token_for_user",
						response.status_code, json_content.get('error_description'))
		return None
	return json_content["access_token"]

def retrieve_user_infos(token:str) -> dict[str, Any]:
	try:
		response = requests.get("https://api.intra.42.fr/v2/me",
						headers={'Authorization': 'Bearer {0}'.format(token)})
	except:
		raise StatusException("retrieve_user_infos_from_42.", detail='Request could not be sent.')
	json_content = response.json()
	if response.status_code != 200:
		raise StatusException("retrieve_user_infos_from_42.",
						response.status_code, json_content.get('detail'), "Unexpected response given by 42 api.")
	try:
		infos = {
			'username': json_content['id'],
			'email': json_content['email'],
			'display_name': json_content['usual_full_name'],
			'url_avatar': json_content['image']['versions']['small']
		}
	except:
		return None
	return infos
