const containerCanva = /**  @type {HTMLCanvasElement} */  document.getElementById("container-canva");
const canva = /**  @type {HTMLCanvasElement} */  document.getElementById("myCanvas");
const ctx = canva.getContext("2d");


var westPos = 0;
var eastPos = 0;
var padSize = 0.16; // percentage of the height size



canva.width = containerCanva.clientWidth;
canva.height = containerCanva.clientHeight;


const wsRef = new WebSocket(
	'wss://'
	+ 'localhost:8083'
	+ '/ws/pong/square/'
);

wsRef.onmessage = function (e) {
	const msg = JSON.parse(e.data);
	if (msg.hasOwnProperty("west_player_pos")) {
		westPos = parseFloat(msg.west_player_pos);
	}
	if (msg.hasOwnProperty("east_player_pos")) {
		eastPos = parseFloat(msg.east_player_pos);
	}
	draw();
}

function draw() {

	// const left_move = westPos * (canva.height / 100)
	// const right_move = eastPos * (canva.height / 100)

	// clear canvas
	ctx.clearRect(0, 0, canva.width, canva.height);

	// draw left pad
	ctx.fillRect(0, (westPos - (padSize / 2)) * canva.height, 0.01 * canva.width, padSize * canva.height);
	// draw right pad
	ctx.fillRect(0.99 * canva.width, (eastPos - (padSize / 2)) * canva.height, 0.01 * canva.width, padSize * canva.height);


	// ctx.fillRect(0, (canva.height / 2) + left_move, canva.width / 100, canva.height / 10);
	// ctx.fillRect((99 / 100) * canva.width, (canva.height / 2) + right_move, canva.width / 100, canva.height / 10);
	ctx.fill();
	ctx.save();
}



function resizeCanvas() {
	const container = canva.parentElement;
	const containerWidth = containerCanva.clientWidth;
	const containerHeight = containerCanva.clientHeight;

	canva.width = containerWidth;
	canva.height = containerHeight;
}

// Call resizeCanvas on page load
resizeCanvas();
draw();


// Optional: Recalculate size on window resize
window.addEventListener('resize', e => {
	resizeCanvas();
	draw();
});

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
}, 20);