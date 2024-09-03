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



class SquareConsumer(AsyncWebsocketConsumer):

     mut_lock = asyncio.Lock()
     game_group_name = "square_game"
     players = 0
     left_position = 0
     right_position = 0

     async def connect(self):
          async with self.mut_lock:
               if self.players == 2:
                    self.close(code=4001, reason="too many players")
          await self.accept()
          await self.channel_layer.group_add(self.game_group_name, self.channel_name)
          async with self.mut_lock:
               SquareConsumer.players += 1
               print('total players %d', SquareConsumer.players)
          if SquareConsumer.players > 0:
               asyncio.create_task(self.move_loop())

     async def receive(self, text_data):
          text_data_json = json.loads(text_data)
          key_pressed = text_data_json["key_pressed"]
          print("key_pressed: %s", key_pressed)
          async with self.mut_lock:
               if key_pressed == "p1_up":
                    SquareConsumer.left_position = max(-50, self.left_position - 1)
               elif key_pressed == "p1_down":
                    SquareConsumer.left_position = min(40, self.left_position + 1)
               elif key_pressed == "p2_up":
                    SquareConsumer.right_position = max(-50, self.right_position - 1)
               elif key_pressed == "p2_down":
                    SquareConsumer.right_position = min(40, self.right_position + 1)

     async def state_update(self, event):

          await self.send(
               text_data=json.dumps({
                    "type": "stateUpdate",
                    "p1_pos": event["p1_pos"],
                    "p2_pos": event['p2_pos'],
               }
               )
          )

     async def disconnect(self, code):
            async with self.mut_lock:
                 SquareConsumer.players -= 1
            await self.channel_layer.group_discard(self.game_group_name, self.channel_name)

     async def move_loop(self):
          while True:
               async with self.mut_lock:
                    if SquareConsumer.players == 0:
                         break
                    left_pos = SquareConsumer.left_position
                    right_pos = SquareConsumer.right_position
               await self.channel_layer.group_send(self.game_group_name, {"type": "state_update",
                                                                           "p1_pos": left_pos,
                                                                           "p2_pos": right_pos,
                                                                           })
               await asyncio.sleep(0.02)
               # print('again')
          print('All players left')

