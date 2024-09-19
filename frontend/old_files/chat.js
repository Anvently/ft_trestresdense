export function lancementChat (chatScreen, room_name)
{

	const roomName = room_name;
	console.log(roomName);
	const chatSocket = new WebSocket(
		'wss://'
		+ 'localhost:8083'
		+ '/ws/pong/'
	+ roomName
	+ '/'
);

chatSocket.onopen = function(e)
{
	chatScreen.style.display = "contents";
}

chatSocket.onmessage = function(e) {
	// if (chatScreen.style.display == "none")
	// 	chatScreen.style.display = "contents"
	const data = JSON.parse(e.data);
	document.querySelector('#chat-log').value += (data.message + '\n');
};

chatSocket.onclose = function(e) {
	console.error('Chat socket closed unexpectedly with code: %d', e.code);
	chatScreen.style.display = "none";

};

chatSocket.onerror = function(e){
	console.log(e);
}


document.querySelector('#chat-message-input').focus();
document.querySelector('#chat-message-input').onkeyup = function(e) {
	if (e.key === 'Enter') {  // enter, return
		document.querySelector('#chat-message-submit').click();
	}
};

document.querySelector('#chat-message-submit').onclick = function(e) {
	const messageInputDom = document.querySelector('#chat-message-input');
	const message = messageInputDom.value;
	chatSocket.send(JSON.stringify({
		'message': message
	}));
	messageInputDom.value = '';
};

};
