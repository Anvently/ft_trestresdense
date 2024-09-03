const containerCanva = /**  @type {HTMLCanvasElement} */  document.getElementById("container-canva");
const canva = /**  @type {HTMLCanvasElement} */  document.getElementById("myCanvas");
const ctx = canva.getContext("2d");
var left = 0;
var right = 0;

canva.width = containerCanva.clientWidth;
canva.height = containerCanva.clientHeight;

const wsRef = new WebSocket(
	'wss://'
	+ 'localhost:8083'
	+ '/ws/websocket_example/square/'
);

wsRef.onmessage = function (e) {
	const msg = JSON.parse(e.data);
	if (msg.hasOwnProperty("p1_pos")) {
		// console.log(msg.p1_pos);
		left = parseInt(msg.p1_pos);
	}
	if (msg.hasOwnProperty("p2_pos")) {
		// console.log(msg.p2_pos);
		right = parseInt(msg.p2_pos);
	}
	draw();
}

function draw() {

	const left_move = left * (canva.height / 100)
	const right_move = right * (canva.height / 100)
	ctx.clearRect(0, 0, canva.width, canva.height);
	ctx.fillRect(0, (canva.height / 2) + left_move, canva.width / 100, canva.height / 10);
	ctx.fillRect((99 / 100) * canva.width, (canva.height / 2) + right_move, canva.width / 100, canva.height / 10);
	ctx.fill();
	ctx.save();
}


// function draw_absolue() {
// 	ctx.fillStyle = "rgb(200, 0, 0)";
// 	ctx.fillRect(10, 10, 150, 50);

// 	ctx.fillStyle = "rgba(0, 0, 200, 0.5)";
// 	ctx.fillRect(30, 30, 150, 50);

// 	ctx.fillStyle = "rgba(200, 200, 200)";
// 	ctx.strokeRect(30, 30, 150, 50);


// 	ctx.beginPath();
// 	ctx.fillStyle = "rgba(0, 200, 0)";
// 	ctx.strokeStyle = "blue";
// 	ctx.moveTo(150, 15);
// 	ctx.lineTo(300, 15);
// 	ctx.lineTo(300, 55);
// 	ctx.fill();
// 	ctx.stroke();
// }

// function draw_arc() {
// 	ctx.fillStyle = "rgb(200, 0, 0)";
// 	// ctx.fillRect(10, 10, 150, 50);
// 	ctx.beginPath();
// 	ctx.arc(canva.width / 2, canva.height / 2, 20, 0, Math.PI, true);
// 	ctx.fill();
// }


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
	if (e.key === "ArrowUp") {
		pressKey.arrowup = true;
	}
	else if (e.key === "ArrowDown") {
		pressKey.arrowdown = true;
	}
	if (e.key.toLowerCase() === "w") {
		pressKey.key_w = true;
	}
	else if (e.key.toLowerCase() === "s") {
		pressKey.key_s = true;
	}
}
);


window.addEventListener("keyup", e => {
	console.log("keyup, ", e.key);
	if (e.key === "ArrowUp") {
		pressKey.arrowup = false;
	}
	else if (e.key === "ArrowDown") {
		pressKey.arrowdown = false;
	}
	if (e.key.toLowerCase() === "w") {
		pressKey.key_w = false;
	}
	else if (e.key.toLowerCase() == "s") {
		pressKey.key_s = false;
	}
}
);

setInterval(() => {

	if (pressKey.arrowup === true)
		wsRef.send(JSON.stringify({ key_pressed: "p2_up" }));
	if (pressKey.arrowdown === true)
		wsRef.send(JSON.stringify({ key_pressed: "p2_down" }));
	if (pressKey.key_w === true)
		wsRef.send(JSON.stringify({ key_pressed: "p1_up" }));
	if (pressKey.key_s === true)
		wsRef.send(JSON.stringify({ key_pressed: "p1_down" }));
}, 20);