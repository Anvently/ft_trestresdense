const 	containerCanva = /**  @type {HTMLCanvasElement} */  document.getElementById("container-canva");
var 	canvas = document.getElementById("canvas");
const 	usernameButt = document.getElementById("username-field");
const 	lobbyID = document.getElementById("lobby-id");
const 	loginBUTT = document.getElementById("submit-btn");
// const	wsRef = null;

// loginBUTT.addEventListener("click", e => {
//     e.preventDefault();
// });

// canvas.width = containerCanva.clientWidth;
// canvas.height = containerCanva.clientHeight;

// Constants
const WEST = 0;
const EAST = 1;
const NORTH = 2;
const SOUTH = 3;

const PADDLE_LENGTH = 0.16
const PADDLE_THICKNESS = 0.05;
const BALL_RADIUS = 0.015

var players = [
		{type: "wall", lives: 0, x: 0, y: 0, width: 0, height: 0},
		{type: "wall", lives: 0, x: 0, y: 0, width: 0, height: 0},
		{type: "wall", lives: 0, x: 0, y: 0, width: 0, height: 0},
		{type: "wall", lives: 0, x: 0, y: 0, width: 0, height: 0}
	];
var ball = {x: 0, y: 0, r: 0, speedX: 0, speedY: 0};
var number_of_players;
var user_id;

var walls = [];


/////////////////// 3D WIP ///////////////////
import * as THREE from "https://cdn.skypack.dev/three@0.132.2";

const scene = new THREE.Scene();

// CAMERA
// FOV, ratio, near clipping, far clipping
const camera = new THREE.PerspectiveCamera( 75, 1, 0.1, 1000);
camera.position.z = 10;
camera.lookAt(0, 0, 0);

// LIGHT
const spotLight = new THREE.SpotLight( 0xffffff );
spotLight.position.set( 0, 0, 10 );
spotLight.castShadow = true;
spotLight.shadow.mapSize.width = 1024;
spotLight.shadow.mapSize.height = 1024;
spotLight.shadow.camera.near = 5;
spotLight.shadow.camera.far = 40;
spotLight.shadow.camera.fov = 30;

scene.add( spotLight );

// RENDERER
const renderer = new THREE.WebGLRenderer();
renderer.setSize(1200, 1200);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // default THREE.PCFShadowMap

document.body.appendChild(renderer.domElement);

// Define different geometries
const paddleGeometry = [
	new THREE.BoxGeometry(PADDLE_THICKNESS * 10, PADDLE_LENGTH * 10, 0.5),
	new THREE.BoxGeometry(PADDLE_THICKNESS * 10, PADDLE_LENGTH * 10, 0.5),
	new THREE.BoxGeometry(PADDLE_LENGTH * 10,PADDLE_THICKNESS * 10, 0.5),
	new THREE.BoxGeometry(PADDLE_LENGTH * 10,PADDLE_THICKNESS * 10, 0.5)
];

// Define different materials
const paddleMaterial = [
	new THREE.MeshStandardMaterial({ color: 0x0000ff }), // Blue
	new THREE.MeshStandardMaterial({ color: 0xff0000 }), // Red
	new THREE.MeshStandardMaterial({ color: 0x00ff00 }), // Green
	new THREE.MeshStandardMaterial({ color: 0xffff00 })  // Yellow
];


// OBJECTS
	// create ball
const sphereGeometry = new THREE.SphereGeometry( BALL_RADIUS * 10, 32, 32 );
const sphereMaterial = new THREE.MeshStandardMaterial( { color: 0xf0f0f0 } );
const sphere = new THREE.Mesh( sphereGeometry, sphereMaterial );

sphere.castShadow = true;
sphere.receiveShadow = true;

scene.add( sphere );

	// create field plane

const CORNER_POSITION = {
	X: [-10, -10, 10, 10],
	Y: [-10, 10, -10, 10]
}

const WALL_POSITION = {
	X: [-10, 10, 0, 0],
	Y: [0, 0, -10, 10]
}

{
	const group = new THREE.Group();
	{
		const planeGeometry = new THREE.PlaneGeometry( 30, 30 );
		const planeMaterial = new THREE.MeshStandardMaterial( {color: 0x00ffff} );
		const plane = new THREE.Mesh(planeGeometry, planeMaterial);
		
		plane.castShadow = true;
		plane.receiveShadow = true;
		plane.position.z -= 0.15; // minus ball radius
		
		group.add(plane);
	}
	for (var i = 0; i < 4; i++)
	{
		//corners
		{
			const geometry = new THREE.BoxGeometry( 10, 10, 0.5 );
			const material = new THREE.MeshStandardMaterial ( {color: 0xf0f0f0});
			const mesh = new THREE.Mesh(geometry, material);
			mesh.position.set(CORNER_POSITION.X[i], CORNER_POSITION.Y[i], 0)
			group.add(mesh);
		}

		//walls
		{
			const geometry = new THREE.BoxGeometry( 10, 10, 0.5 );
			const material = new THREE.MeshStandardMaterial ( {color: 0xf0f0f0});
			const mesh = new THREE.Mesh(geometry, material);
			mesh.position.set(WALL_POSITION.X[i], WALL_POSITION.Y[i], -1)
			walls.push(mesh);
			group.add(mesh);
		}
	}

	scene.add(group);
}




const paddles = [];
	
function create_paddles(number_of_players)
{
	for (var i = 0; i < number_of_players; i++)
	{
		const geometry = paddleGeometry[i % paddleGeometry.length];
		const material = paddleMaterial[i % paddleMaterial.length];
		const paddle = new THREE.Mesh(geometry, material);
		paddle.position.z = -1
		
		paddle.castShadow = true;
		paddle.receiveShadow = true;

		paddles.push(paddle);
		console.log("create paddle");
		scene.add(paddle);
	}
}

create_paddles(4);

///////////////////////////////////////////////////



window.onload = function() {
	// Afficher une fenêtre popup pour demander à l'utilisateur d'entrer une valeur
	user_id = prompt("Veuillez entrer une valeur :");

	// Afficher la valeur dans la console pour vérification
	console.log("Valeur saisie par l'utilisateur : " + user_id);

	const wsRef = new WebSocket(
		'wss://'
		+ `${location.hostname}` + ':8083'
		+ `/ws/pong/10/`
	);
	

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

			for (var i = 0; i < 4; i++)
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
			draw_3d();
			// draw();
		}
	}

	setInterval(() => {
		if (pressKey.key_up === true)
			wsRef.send(JSON.stringify({type: 'key_input', username:user_id,  input: "up" }));
		if (pressKey.key_down === true)
			wsRef.send(JSON.stringify({type: 'key_input', username:user_id,  input: "down" }));

	}, 15);

};


function init_3d_map()
{

}

function draw_3d()
{
	// console.log(number_of_players)
	sphere.position.x = ball.x * 10;
	sphere.position.y = ball.y * 10;
	for (var dir = 0; dir < 4; dir++)
	{
		if (players[dir].type == "Player")
		{
			paddles[dir].position.x = players[dir].x * 10;
			paddles[dir].position.y = players[dir].y * 10;
			paddles[dir].position.z = 0;
		}
		else
			walls[dir].position.z = 0
	}

	renderer.render(scene, camera);
}

function draw()
{
	var context = canvas.getContext("2d");
	
	// draw field
	context.fillStyle = 'grey';
	context.fillRect(0, 0, canvas.width, canvas.height);

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




