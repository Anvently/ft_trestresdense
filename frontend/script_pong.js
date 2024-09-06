const 	containerCanva = /**  @type {HTMLCanvasElement} */  document.getElementById("container-canva");
var 	canvas = document.getElementById("canvas");
const 	usernameButt = document.getElementById("username-field");
const 	lobbyID = document.getElementById("lobby-id");
const 	loginBUTT = document.getElementById("submit-btn");
// const	wsRef = null;

// loginBUTT.addEventListener("click", e => {
//     e.preventDefault();
// });

const wsRef = new WebSocket(
	'wss://'
	+ 'localhost:8083'
	+ `/ws/pong/10/`
);



	canvas.width = containerCanva.clientWidth;
	canvas.height = containerCanva.clientHeight;
	
	// Constants
	const WEST = 0;
	const EAST = 1;
	const NORTH = 2;
	const SOUTH = 3;
	
	
	var players = [
	{type: "wall", lives: 0, x: 0, y: 0, width: 0, height: 0}
];
var ball = {x: 0.5, y: 0.5, r: 0, speedX: 0, speedY: 0};
var number_of_players;
var user_id;

window.onload = function() {
	// Afficher une fenêtre popup pour demander à l'utilisateur d'entrer une valeur
	user_id = prompt("Veuillez entrer une valeur :");

	// Afficher la valeur dans la console pour vérification
	console.log("Valeur saisie par l'utilisateur : " + user_id);

};

const wsRef = new WebSocket(
	'wss://'
	+ `${window.location.hostname}:8083`
	+ '/ws/pong/10/'
);



function draw()
{
	var context = canvas.getContext("2d");
	
	// draw field
	context.fillStyle = 'grey';
	context.fillRect(0, 0, canvas.width, canvas.height);

	// draw players
	for (var i = 0; i < number_of_players; i++)
	{
		// paddle color
		switch (i)
		{
			case (WEST):
				context.fillStyle = 'blue';
				break;
			case (EAST):
				context.fillStyle = 'red';
				break;
				case (NORTH):
				context.fillStyle = 'green';
				break;
				case (SOUTH):
					context.fillStyle = 'yellow';
					break;
		}
		// draw paddle
		context.fillRect((players[i].x - players[i].width / 2) * canvas.width,
						(players[i].y - players[i].height / 2) * canvas.height,
						players[i].width * canvas.width,
						players[i].height * canvas.height);
	}

	// draw ball
	context.beginPath(); // ???
	context.fillStyle = 'black';
	context.arc(ball.x * canvas.width,
		ball.y * canvas.height,
				ball.r * canvas.height,
				0,
				Math.PI * 2,
				false);
	context.fill();

}


wsRef.onmessage = function (e) {
	const msg = JSON.parse(e.data);
	if (msg.hasOwnProperty("type") === false)
		return
	else if (msg["type"] === "ping")
		wsRef.send(JSON.stringify({type: 'join_game', username: `${user_id}`}));
	else if (msg["type"] === "send_game_state") {
		number_of_players = parseInt(msg.number_of_players);
		ball.x = parseFloat(msg.ball_x);
		ball.y = parseFloat(msg.ball_y);
		ball.r = parseFloat(msg.ball_r);
		ball.speedX = parseFloat(msg.ball_speed_x);
		ball.speedY = parseFloat(msg.ball_speed_y);

		for (var i = 0; i < number_of_players; i++)
		{
			players[i] = {
						type: msg[`player${i}_type`],
						lives: msg[`player${i}_lives`],
						x: msg[`player${i}_x`],
						y: msg[`player${i}_y`],
						width: msg[`player${i}_width`],
						height: msg[`player${i}_height`]
					};
		}
	}
}

		// INPUT
		var pressKey = {
			key_up: false,
			key_down: false,
		};

window.addEventListener("keydown", e => {
	if (e.key === "ArrowUp") 
		pressKey.key_up = true;
	else if (e.key === "ArrowDown") 
		pressKey.key_down = true;
	
});

window.addEventListener("keyup", e => {
	if (e.key === "ArrowUp")
		pressKey.key_up = false;
	else if (e.key === "ArrowDown")
		pressKey.key_down = false;
});

setInterval(() => {
	if (pressKey.key_up === true)
		wsRef.send(JSON.stringify({type: 'key_input', username:user_id,  input: "up" }));
	if (pressKey.key_down === true)
		wsRef.send(JSON.stringify({type: 'key_input', username:user_id,  input: "down" }));

	draw();
}, 20);
