const containerCanva = /**  @type {HTMLCanvasElement} */  document.getElementById("container-canva");
const canva = /**  @type {HTMLCanvasElement} */  document.getElementById("myCanvas");
const ctx = canva.getContext("2d");
var	left = 0;
var right = 0

canva.width = containerCanva.clientWidth;
canva.height = containerCanva.clientHeight;

const wsRef = new WebSocket(
	'wss://'
	+ 'localhost:8083'
	+ '/ws/websocket_example/square/'
);

wsRef.onmessage = function(e) {
	// console.log("PING");

	const msg = JSON.parse(e.data);
	// console.log(msg.direction);
	// if (msg.direction)
	// 	movement = movement + parseInt(msg.direction);
	// console.log(movement);
	if (msg.p1_pos)
		console.log(msg.p1_pos)
		left = parseInt(msg.p1_pos)
	if (msg.p2_pos)
		console.log(msg.p2_pos)
		right = parseInt(msg.p2_pos)
	draw();
}

function draw() {

	const left_move = left * (canva.height / 20)
	const right_move = right * (canva.height / 20)
	ctx.clearRect(0, 0, canva.width, canva.height);
	ctx.fillRect(0, (canva.height / 2) + left_move, canva.width / 20, canva.height / 10);
	ctx.fillRect((19/20) * canva.width, (canva.height / 2) + right_move, canva.width / 20, canva.height / 10);
	ctx.fill();
	ctx.save();
}

// function moving_square() {

// }

function draw_absolue()
{
	ctx.fillStyle = "rgb(200, 0, 0)";
	ctx.fillRect(10, 10, 150, 50);

	ctx.fillStyle = "rgba(0, 0, 200, 0.5)";
	ctx.fillRect(30, 30, 150, 50);

	ctx.fillStyle = "rgba(200, 200, 200)";
	ctx.strokeRect(30, 30, 150, 50);


	ctx.beginPath();
	ctx.fillStyle = "rgba(0, 200, 0)";
	ctx.strokeStyle = "blue";
	ctx.moveTo(150, 15);
	ctx.lineTo(300, 15);
	ctx.lineTo(300, 55);
	ctx.fill();
	ctx.stroke();
}

function draw_arc()
{
	ctx.fillStyle = "rgb(200, 0, 0)";
	// ctx.fillRect(10, 10, 150, 50);
	ctx.beginPath();
	ctx.arc(canva.width / 2, canva.height / 2, 20, 0, Math.PI, true);
	ctx.fill();
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
window.addEventListener('resize', e=>{
	resizeCanvas();
	draw();
});

window.addEventListener("keydown", e=>{
	console.log(e.key);
	if (e.key === "ArrowUp") {
		wsRef.send( JSON.stringify({key_pressed: "p1_up"}));
		// movement = movement + 1;
	}
	else if (e.key === "ArrowDown"){
		wsRef.send( JSON.stringify({key_pressed: "p1_down"}));}
	else if (e.key === "q"){
		wsRef.send(JSON.stringify({key_pressed: "p2_up"}));
	}
	else if (e.key == "w"){
		wsRef.send(JSON.stringify({key_pressed: "p2_down"}));
	}
	// fetch("./mouv.json")
	// 	.then((res) => {
	// 		if (!res.ok)
	// 		{
	// 			throw new Error("erreur");
	// 		}
	// 		return res.json();
	// 	})
	// 	.then((data) => {
	// 		console.log(data)
	// 		console.log(parseInt(data.direction));
	// 		movement = movement + parseInt(data.direction);
	// 		draw(movement);
	// 	})
	// 	.catch((error) =>
	// 		console.error("ERREUR X", error));
		}
	// draw(movement);
);

