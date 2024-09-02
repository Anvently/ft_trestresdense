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

        self.room_name = self.scope['url_route']['kwargs']["room_name"]
        self.room_group_name = "chat_%s" % self.room_name
        if 'auth-token' in self.scope['cookies']:
              token = self.scope['cookies']['auth-token']
        else:
            await self.close(code=4001, reason="ayth requiered")
            print('no token')
            return
        await self.accept()
        try:
            self.data = verify_jwt(token)
            msg = "{user_name} has joined the chat".format(user_name = self.data['username'])
            print('auth success')
        except ValueError:
            await self.close(code=4001, reason="auth invalid")
            print('disco')
            return
        await self.channel_layer.group_send(
             self.room_group_name, {"type": "others_message", "message": msg, 'user': self.data['username']})
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)

    async def disconnect(self, close_code):
        msg = "{user_name} has left the chat".format(user_name = self.data['username'])
        await self.channel_layer.group_send(
             self.room_group_name, {"type": "others_message", "message": msg, 'user': self.data['username']})
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)


    async def receive(self, text_data):
        text_data_json = json.loads(text_data)
        message = "{user_name} : {msg}".format(user_name = self.data['username'], msg = text_data_json['message'])

        # Echo the message back to all the chat members
        await self.channel_layer.group_send(
             self.room_group_name, {"type": "chat_message", "message": message}
        )

    # receive msg from chat
    async def chat_message(self, event):
         message = event['message']
         print('chat message !')
         await self.send(text_data=json.dumps({'message': message}))

    async def others_message(self, event):
         message = event['message']
         user = event['user']
         print('not to self')
         print(user)
         print(self.data['username'])
         if self.data['username'] == user:
              return
         await self.send(text_data=json.dumps({'message': message}))
