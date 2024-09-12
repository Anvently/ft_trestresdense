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

const TABLE_LENGTH = 9/5;
// canvas.width = containerCanva.clientWidth;
// canvas.height = containerCanva.clientHeight;

// Constants
const WEST = 0;
const EAST = 1;
const NORTH = 2;
const SOUTH = 3;


var players = [
		{lives: 0, x: 0, y: 0, angle: 0, width: 0, height: 0}
	];
var ball = {x: 0.5, y: 0.5, r: 0, speedX: 0, speedY: 0, last_hit: 0};
var user_id;


/////////////////// 3D WIP ///////////////////
import * as THREE from "https://cdn.skypack.dev/three@0.132.2";

const scene = new THREE.Scene();

// CAMERA
// FOV, ratio, near clipping, far clipping
const camera = new THREE.PerspectiveCamera( 75, 1, 0.1, 1000);
// camera.position.z = 2;
// camera.position.y = -12;
camera.position.x = 0;
camera.position.y = -5;
camera.position.z = 14;
camera.lookAt(0, 0, 0);

// LIGHT
const light = new THREE.DirectionalLight( 0xffffff, 1 );
light.position.set( -1, 1, 1);
light.castShadow = true;
scene.add( light );
//Set up shadow properties for the light
light.shadow.mapSize.width = 512;
light.shadow.mapSize.height = 512;
light.shadow.camera.near = 0.5;
light.shadow.camera.far = 500;

const spotLight = new THREE.SpotLight( 0xffffff );
spotLight.position.set( 0, 0, 10 );
spotLight.castShadow = true;
spotLight.shadow.mapSize.width = 1024;
spotLight.shadow.mapSize.height = 1024;
spotLight.shadow.camera.near = 5;
spotLight.shadow.camera.far = 40;
spotLight.shadow.camera.fov = 30;

const spotLightHelper = new THREE.SpotLightHelper( spotLight );
scene.add( spotLightHelper );

scene.add( spotLight );

// RENDERER
const renderer = new THREE.WebGLRenderer();
renderer.setSize(1200, 800);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // default THREE.PCFShadowMap

document.body.appendChild(renderer.domElement);

// OBJECTS
	// create ball
const sphereGeometry = new THREE.SphereGeometry( 0.3, 32, 32 );
const sphereMaterial = new THREE.MeshStandardMaterial( { color: 0xf0f0f0 } );
const sphere = new THREE.Mesh( sphereGeometry, sphereMaterial );

sphere.castShadow = true;
sphere.receiveShadow = true;

scene.add( sphere );

	// create field plane
const planeGeometry = new THREE.PlaneGeometry( 9/5 * 10, 10 );
const planeMaterial = new THREE.MeshStandardMaterial( {color: 0x00ffff} );
const plane = new THREE.Mesh(planeGeometry, planeMaterial);

plane.castShadow = true;
plane.receiveShadow = true;
plane.position.z -= 0.015; // minus ball radius
scene.add(plane);

	// create paddles
const westPaddleGeometry = new THREE.CylinderGeometry(0.8, 0.8, 0.2, 16);
const westPaddleMaterial = new THREE.MeshStandardMaterial( { color: 0xff0000 } );
const westPaddle = new THREE.Mesh( westPaddleGeometry, westPaddleMaterial );
westPaddle.castShadow = true;
westPaddle.receiveShadow = true;
scene.add(westPaddle);
westPaddle.position.z += 1.6;
westPaddle.rotation.z += Math.PI / 2;


const eastPaddleGeometry = new THREE.CylinderGeometry(0.8, 0.8, 0.1, 16);
const eastPaddleMaterial = new THREE.MeshStandardMaterial( { color: 0xff0000 } );
const eastPaddle = new THREE.Mesh( eastPaddleGeometry, eastPaddleMaterial );
eastPaddle.castShadow = true;
eastPaddle.receiveShadow = true;
scene.add(eastPaddle);
eastPaddle.position.z += 2.8;
eastPaddle.rotation.z += Math.PI / 2;
///////////////////////////////////////////////////



window.onload = function() {
	// Afficher une fenêtre popup pour demander à l'utilisateur d'entrer une valeur
	user_id = prompt("Veuillez entrer une valeur :");

	// Afficher la valeur dans la console pour vérification
	console.log("Valeur saisie par l'utilisateur : " + user_id);

};


function draw_3d()
{
	sphere.position.x = ball.x * 10;
	sphere.position.y = ball.y * 10;


	// Define the bounds
	var min_x = -0.9 * TABLE_LENGTH; // -9/10 of the table length
	var max_x = 0.9 * TABLE_LENGTH;  // 9/10 of the table length

	// Define the value r where z should be 0
	var r = 0;
	if (ball.last_hit == WEST)
		r = TABLE_LENGTH / 4;
	else
		r = -TABLE_LENGTH / 4;
	// Calculate z based on ball.x position
	var z;
	if (ball.x <= r) {
		// Ball is on the left of r, calculate z from 1 to 0
		z = (ball.x - min_x) / (r - min_x);
	} else {
		// Ball is on the right of r, calculate z from 0 to 1
		z = 1 - (ball.x - r) / (max_x - r);
	}
	// Ensure z is within the range [0, 1]
	z = Math.max(0, Math.min(1, z));

	sphere.position.z = 4 * (1 - z) + 0.075;

	// DRAW PADDLES
	westPaddle.position.x = players[0].x * 10;
	westPaddle.position.y = players[0].y * 10;
	westPaddle.rotation.z = players[0].angle + Math.PI / 2;

	eastPaddle.position.x = players[1].x * 10;
	eastPaddle.position.y = players[1].y * 10;
	eastPaddle.rotation.z = players[1].angle + Math.PI / 2;

	renderer.render(scene, camera);
}

wsRef.onmessage = function (e) {
	const msg = JSON.parse(e.data);
	if (msg.hasOwnProperty("type") === false)
		return
	else if (msg["type"] === "ping")
		wsRef.send(JSON.stringify({type: 'join_game', username: `${user_id}`}));
	else if (msg["type"] === "send_game_state") {
		ball.x = parseFloat(msg.ball_x);
		ball.y = parseFloat(msg.ball_y);
		ball.r = parseFloat(msg.ball_r);
		ball.speedX = parseFloat(msg.ball_speed_x);
		ball.speedY = parseFloat(msg.ball_speed_y);
		ball.last_hit = parseInt(msg.ball_last_hit);


		for (var i = 0; i < 2; i++)
		{
			players[i] = {
						lives: msg[`player${i}_lives`],
						x: msg[`player${i}_x`],
						y: msg[`player${i}_y`],
						angle: msg[`player${i}_angle`],
						width: msg[`player${i}_width`],
						height: msg[`player${i}_height`]
					
					};
					console.log(players[i])
		}
		draw_3d();


		// draw();
	}
}

		// INPUT
		var pressKey = {
			key_up: false,
			key_down: false,
			key_left: false,
			key_right: false,
		};

window.addEventListener("keydown", e => {
	if (e.key === "ArrowUp") 
		pressKey.key_up = true;
	else if (e.key === "ArrowDown") 
		pressKey.key_down = true;
	else if (e.key === "ArrowLeft") 
		pressKey.key_left = true;
	else if (e.key === "ArrowRight") 
		pressKey.key_right = true;
});

window.addEventListener("keyup", e => {
	if (e.key === "ArrowUp")
		pressKey.key_up = false;
	else if (e.key === "ArrowDown") 
		pressKey.key_down = false;
	else if (e.key === "ArrowLeft") 
		pressKey.key_left = false;
	else if (e.key === "ArrowRight") 
		pressKey.key_right = false;
});

setInterval(() => {
	if (pressKey.key_up === true)
		wsRef.send(JSON.stringify({type: 'key_input', username:user_id,  input: "up" }));
	if (pressKey.key_down === true)
		wsRef.send(JSON.stringify({type: 'key_input', username:user_id,  input: "down" }));
	if (pressKey.key_left === true)
		wsRef.send(JSON.stringify({type: 'key_input', username:user_id,  input: "left" }));
	if (pressKey.key_right === true)
		wsRef.send(JSON.stringify({type: 'key_input', username:user_id,  input: "right" }));
}, 15);


