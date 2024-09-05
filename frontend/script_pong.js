const containerCanva = /**  @type {HTMLCanvasElement} */  document.getElementById("container-canva");
var canvas = document.getElementById("canvas");

canvas.width = containerCanva.clientWidth;
canvas.height = containerCanva.clientHeight;

// CONST TO SHARE WITH THE BASKEND
const PLAYER_HEIGHT = 0.16;
const PLAYER_WIDTH = 0.01;
const BALL_RADIUS =0.015;

var game = {
	playerWest: {
		x: 0,
		y: 0.5,
		score: 0
	},
	playerEast: {
		x: 1 - PLAYER_WIDTH,
		y: 0.5,
		score: 0
	},
	ball: {
		x: 0.5,
		y: 0.5,
		r: BALL_RADIUS,
	}
}



const wsRef = new WebSocket(
	'wss://'
	+ 'localhost:8083'
	+ '/ws/pong/square/'
);

function draw()
{
	var context = canvas.getContext("2d");

	// draw field
	context.fillStyle = 'grey';
	context.fillRect(0, 0, canvas.width, canvas.height);

	// draw players
		// West
	context.fillStyle = 'blue';
	context.fillRect(game.playerWest.x * canvas.width,
					(game.playerWest.y - (PLAYER_HEIGHT / 2)) * canvas.height,
					PLAYER_WIDTH * canvas.width,
					PLAYER_HEIGHT * canvas.height);
		// East
	context.fillStyle = 'red';
	context.fillRect(game.playerEast.x * canvas.width,
					(game.playerEast.y - (PLAYER_HEIGHT / 2)) * canvas.height,
					PLAYER_WIDTH * canvas.width,
					PLAYER_HEIGHT * canvas.height);

	// draw ball
	context.beginPath(); // ???
	context.fillStyle = 'black';
	context.arc(game.ball.x * canvas.width,
				game.ball.y * canvas.height,
				game.ball.r * canvas.height,
				0,
				Math.PI * 2,
				false);
	context.fill()

}

wsRef.onmessage = function (e) {
	const msg = JSON.parse(e.data);
	if (msg.hasOwnProperty("west_player_pos"))
		game.playerWest.y = parseFloat(msg.west_player_pos);
	if (msg.hasOwnProperty("east_player_pos"))
		game.playerEast.y = parseFloat(msg.east_player_pos);
	if (msg.hasOwnProperty("ball_pos_x"))
		game.ball.x = parseFloat(msg.ball_pos_x);
		console.log("ball_pos_x ");
	if (msg.hasOwnProperty("ball_pos_y"))
		game.ball.y = parseFloat(msg.ball_pos_y);
		console.log("ball_pos_y ");
	if (msg.hasOwnProperty("west_score"))
		game.playerWest.score = parseFloat(msg.west_score);
	if (msg.hasOwnProperty("east_score"))
		game.playerEast.score = parseFloat(msg.east_score);
	draw();
}


// INPUT
var pressKey = {
	arrowup: false,
	arrowdown: false,
	key_w: false,
	key_s: false
};

window.addEventListener("keydown", e => {
	console.log(e.key);
	if (e.key === "ArrowUp") 
		pressKey.arrowup = true;
	else if (e.key === "ArrowDown") 
		pressKey.arrowdown = true;
	if (e.key.toLowerCase() === "w") 
		pressKey.key_w = true;
	else if (e.key.toLowerCase() === "s") 
		pressKey.key_s = true;
}
);

window.addEventListener("keyup", e => {
	console.log("keyup, ", e.key);
	if (e.key === "ArrowUp")
		pressKey.arrowup = false;
	else if (e.key === "ArrowDown")
		pressKey.arrowdown = false;
	if (e.key.toLowerCase() === "w")
		pressKey.key_w = false;
	else if (e.key.toLowerCase() == "s")
		pressKey.key_s = false;
}
);

setInterval(() => {
	if (pressKey.arrowup === true)
		wsRef.send(JSON.stringify({ key_pressed: "east_player_up" }));
	if (pressKey.arrowdown === true)
		wsRef.send(JSON.stringify({ key_pressed: "east_player_down" }));
	if (pressKey.key_w === true)
		wsRef.send(JSON.stringify({ key_pressed: "west_player_up" }));
	if (pressKey.key_s === true)
		wsRef.send(JSON.stringify({ key_pressed: "west_player_down" }));

	draw();
}, 20);
