import json
import time
import jwt
import asyncio
from django.conf import settings
from channels.generic.websocket import AsyncWebsocketConsumer

def verify_jwt(token, is_ttl_based=False, ttl_key="exp"):
	data = jwt.decode(token, settings.RSA_PUBLIC_KEY, algorithms=["RS512"])
	if is_ttl_based:
		if data[ttl_key] < time.time():
			raise ValueError("Token expired")
	return data




class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Accept the WebSocket connection
        print(self.scope)
        if 'auth-token' in self.scope['cookies']:
              token = self.scope['cookies']['auth-token']
        else:
            await self.close()
            return
        await self.accept()
        try:
              self.data = verify_jwt(token)
        except ValueError:
              await self.close(close_code=2)
              return
        msg = "Hello {user_name}, how can I help you?".format(user_name = self.data['username'])
        await self.send(json.dumps({
           'message': msg
		}))


    async def disconnect(self, close_code):
        # Handle WebSocket disconnection
        pass

    async def receive(self, text_data):
        text_data_json = json.loads(text_data)
        message = "{user_name} : {msg}".format(user_name = self.data['username'], msg = text_data_json['message'])

        # Echo the message back to the client
        await self.send(text_data=json.dumps({
            'message': message
        }))
