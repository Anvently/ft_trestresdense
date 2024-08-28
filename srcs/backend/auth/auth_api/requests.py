import requests
from django.contrib.auth.models import User
from django.conf import settings
from rest_framework.exceptions import APIException
from rest_framework import status

class StatusException(APIException):
	status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
	default_detail = 'We were not able to propagate your action to other services. Action {0} was not performed.'
	default_code = 'error'

	def __init__(self, action_id:str = "", res_status=None, res_content=None):
		code = self.default_code
		self.detail = self.default_detail.format(action_id)
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
		response = requests.post('http://users_api:8001/edit-users/?format=json',
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
		response = requests.delete('http://users_api:8001/edit-users/{0}/?format=json'.format(username),
						headers={
								'Host': 'localhost',
								'Authorization': 'Bearer {0}'.format(settings.API_TOKEN.decode('ASCII'))
								}
							)
	except:
		raise StatusException("deleting_user")
	if response == None or (response.status_code != 204 and response.status_code != 404):
		raise StatusException("deleting_user", response.status_code, response.content)
	return True
