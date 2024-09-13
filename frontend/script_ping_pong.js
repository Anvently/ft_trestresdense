const 	containerCanva = /**  @type {HTMLCanvasElement} */  document.getElementById("container-canva");
var 	canvas = document.getElementById("canvas");
const 	usernameButt = document.getElementById("username-field");
const 	lobbyID = document.getElementById("lobby-id");
const 	loginBUTT = document.getElementById("submit-btn");


const wsRef = new WebSocket(
	'wss://'
	+ 'localhost:8083'
	+ `/ws/pong/10/`
);

const TABLE_LENGTH = 9/5;

// Constants
const WEST = 0;
const EAST = 1;
const NORTH = 2;
const SOUTH = 3;

const REBOUND_RING_RADIUS = 0.6
const REBOUND_LINE_X = 0.5


var players = [
		{lives: 0, x: 0, y: 0, angle: 0, width: 0, height: 0}
	];
var ball = {x: 0.5, y: 0.5, r: 0, speed: {x: 0, y: 0}, last_hit: {x: 0, y: 0}};
var user_id;


/////////////////// 3D WIP ///////////////////
import * as THREE from "https://cdn.skypack.dev/three@0.132.2";

const scene = new THREE.Scene();

// CAMERA
// FOV, ratio, near clipping, far clipping
const camera = new THREE.PerspectiveCamera( 75, 4/3, 0.1, 100);
camera.position.set(0, -5, 12)
// camera.position.set(0, -12, 2)
camera.lookAt(0, 0, 0);

// LIGHT
// SpotLight( color : Integer, intensity : Float, distance : Float, angle : Radians, penumbra : Float, decay : Float )
const spotLight = new THREE.SpotLight( 0xffffff, 1, 0, 3*Math.PI/4, 0.4, 0.2);
// const spotLight = new THREE.SpotLight( 0xffffff);
spotLight.position.set( 0, 0, 20 );
spotLight.castShadow = true;
spotLight.shadow.mapSize.width = 1024;
spotLight.shadow.mapSize.height = 1024;
spotLight.shadow.camera.near = 1;
spotLight.shadow.camera.far = 500;
spotLight.shadow.camera.fov = 30;

// const spotLightHelper = new THREE.SpotLightHelper( spotLight );
// scene.add( spotLightHelper );

scene.add( spotLight );

// RENDERER
const renderer = new THREE.WebGLRenderer();
renderer.setSize(1200, 800);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // default THREE.PCFShadowMap

document.body.appendChild(renderer.domElement);

// Add axis AIDS
// const axesHelper = new THREE.AxesHelper(100);
// scene.add(axesHelper)

// OBJECTS
	// create ball
const sphereGeometry = new THREE.SphereGeometry( 0.3, 32, 32 );
const sphereMaterial = new THREE.MeshStandardMaterial( { color: 0xf0f0f0 } );
const sphere = new THREE.Mesh( sphereGeometry, sphereMaterial );

sphere.castShadow = true;
sphere.receiveShadow = true;

scene.add( sphere );

	// create table
const tableGeometry = new THREE.BoxGeometry( 9/5 * 10, 10 , 1);
const tableMaterial = new THREE.MeshStandardMaterial( {color: 0x0c71a7} );
const table = new THREE.Mesh(tableGeometry, tableMaterial);

table.castShadow = true;
table.receiveShadow = true;
table.position.z -= 0.80; // minus ball radius, minus table depth /2 
scene.add(table);
	// create net
const netGeometry = new THREE.BoxGeometry(0.1, 10, 1);
const netMaterial = new THREE.MeshStandardMaterial( {color: 0xffffff} );
const net = new THREE.Mesh(netGeometry, netMaterial);
net.castShadow = true;
net.receiveShadow = true;
net.position.z = 0.2; 
scene.add(net);
	// create line
const lineGeometry = new THREE.PlaneGeometry(9/5 * 10 - 0.2 , 0.1); 
const lineMaterial = new THREE.MeshStandardMaterial( { color: 0xC0C0C0, side: THREE.DoubleSide } );
const line = new THREE.Mesh( lineGeometry, lineMaterial );
line.receiveShadow = true;
line.position.z = - 0.29
scene.add( line );
	// create floor
const floorGeometry = new THREE.PlaneGeometry(100 , 100); 
const floorMaterial = new THREE.MeshStandardMaterial( { color: 0xe55c28, side: THREE.DoubleSide } );
const floor = new THREE.Mesh( floorGeometry, floorMaterial );
floor.position.z = - 5
// floor.castShadow = true;
floor.receiveShadow = true;
scene.add( floor );

	// create paddles
const westPaddleGeometry = new THREE.CylinderGeometry(1, 1, 0.2, 16);
const westPaddleMaterial = new THREE.MeshStandardMaterial( { color: 0xff0000 } );
const westPaddle = new THREE.Mesh( westPaddleGeometry, westPaddleMaterial );
westPaddle.castShadow = true;
westPaddle.receiveShadow = true;
scene.add(westPaddle);
westPaddle.rotation.z = Math.PI / 2;
westPaddle.position.z = 1.5;

const westHandleGeometry = new THREE.BoxGeometry( 0.2, 0.2 , 0.7);
const westHandleMaterial = new THREE.MeshStandardMaterial( {color: 0xa0a0a0} );
const westHandle = new THREE.Mesh(westHandleGeometry, westHandleMaterial);
westHandle.castShadow = true;
westHandle.position.z = 0.2;
westHandle.receiveShadow = true;
scene.add(westHandle);


const eastPaddleGeometry = new THREE.CylinderGeometry(1, 1, 0.2, 16);
const eastPaddleMaterial = new THREE.MeshStandardMaterial( { color: 0xff0000 } );
const eastPaddle = new THREE.Mesh( eastPaddleGeometry, eastPaddleMaterial );
eastPaddle.castShadow = true;
eastPaddle.receiveShadow = true;
scene.add(eastPaddle);
eastPaddle.rotation.z = Math.PI / 2;
eastPaddle.position.z = 1.5;

const eastHandleGeometry = new THREE.BoxGeometry( 0.2, 0.2 , 0.7);
const eastHandleMaterial = new THREE.MeshStandardMaterial( {color: 0xa0a0a0} );
const eastHandle = new THREE.Mesh(eastHandleGeometry, eastHandleMaterial);
eastHandle.castShadow = true;
eastHandle.position.z = 0.2;
eastHandle.receiveShadow = true;
scene.add(eastHandle);

// REBOUND ring
// const geometry = new THREE.RingGeometry((REBOUND_RING_RADIUS - 0.01) * 10, (REBOUND_RING_RADIUS + 0.01) * 10, 32 ); 
// const material = new THREE.MeshBasicMaterial( { color: 0xffff00, side: THREE.DoubleSide } );
// const mesh = new THREE.Mesh( geometry, material );
// scene.add( mesh );

// REBOUND LINE WEST
// const geometry = new THREE.PlaneGeometry(0.1, 10); 
// const material = new THREE.MeshBasicMaterial( { color: 0xffff00, side: THREE.DoubleSide } );
// const mesh = new THREE.Mesh( geometry, material );
// mesh.position.x = -REBOUND_LINE_X * 10
// scene.add( mesh );

// //REBOUND LINE EAST
// const geometry2 = new THREE.PlaneGeometry(0.1, 10); 
// const material2 = new THREE.MeshBasicMaterial( { color: 0xffff00, side: THREE.DoubleSide } );
// const mesh2 = new THREE.Mesh( geometry2, material2 );
// mesh2.position.x = REBOUND_LINE_X * 10
// scene.add( mesh2 );

// TEST BALL
// const testBallGeometry = new THREE.SphereGeometry( 0.3, 32, 32 );
// const testBallMaterial = new THREE.MeshStandardMaterial( { color: 0xf0f0f0 } );
// const testBall = new THREE.Mesh( testBallGeometry, testBallMaterial );
// testBall.castShadow = true;
// testBall.receiveShadow = true;

// testBall.position.set(0, 0, 0);
// scene.add( testBall );

///////////////////////////////////////////////////





window.onload = function() {
	// Afficher une fenêtre popup pour demander à l'utilisateur d'entrer une valeur
	user_id = prompt("Veuillez entrer une valeur :");

	// Afficher la valeur dans la console pour vérification
	console.log("Valeur saisie par l'utilisateur : " + user_id);

};



// const a = (z1 - z3) / Math.pow(x1 - x3, 2);

function parabollic_z(x, x1, z1, x2, z2, height)
{
	var xMid = (x1 + x2) / 2;
	var k = z1 + height;

	if (x <= xMid)
	{
		var a1 = (z1 - k) / ((x1 - xMid) ** 2);
		return a1 * ((x - xMid) ** 2) + k;
	}
	else
	{
		var a2 = (z2 - k) / ((x2 - xMid) ** 2);
		return a2 * ((x - xMid) ** 2) + k;
	}
}


function set_ball_height()
{
	var xStart;
	var zStart;
	var xEnd;
	var zEnd;

	// ball is going EAST
	if (ball.speed.x > 0)
		{
			// the ball passed the rebound line
			if (ball.x > REBOUND_LINE_X)
			{
				xStart = REBOUND_LINE_X;
				zStart = 0;
				xEnd = 2;
				zEnd = 0;
			}
			// the ball is before the rebound line
			else
			{
				xEnd = REBOUND_LINE_X;
				zEnd = 0;
				if (ball.last_hit.x !== 0)
				{
					xStart = ball.last_hit.x;
					zStart = parabollic_z(ball.last_hit.x * 10, -REBOUND_LINE_X * 10, 0, -2 * 10, 0, 2);
				}
				//service
				else
				{
					xStart = 0;
					zStart = 1;
				}
			}
		}
		else if (ball.speed.x < 0)
		{
			// the ball passed the rebound line
			if (ball.x < -REBOUND_LINE_X)
			{
				xStart = -REBOUND_LINE_X;
				zStart = 0;
				xEnd = -2;
				zEnd = 0;
			}
			// the ball is before the rebound line
			else
			{
				xEnd = -REBOUND_LINE_X + 0.15; //MANGES TES GRANDS MORTS NOMBRE MAGIQUE DE MERDE
				zEnd = 0;
				if (ball.last_hit.x !== 0)
				{
					xStart = ball.last_hit.x + 0.15; //MANGES TES GRANDS MORTS NOMBRE MAGIQUE DE MERDE
					zStart = parabollic_z(ball.last_hit.x * 10, REBOUND_LINE_X * 10, 0, 2 * 10, 0, 2)
				}
				//service
				else
				{
					xEnd = -REBOUND_LINE_X;
					xStart = 0;
					zStart = 1;
				}
			}
		}
		// SERVICE
		else
		{
			xStart = 0;
			zStart = 1;
			// WEST IS STARTING
			if (ball.speed.x > 0)
			{
				xEnd = -2;
				zEnd = 0
			}
			else
			{
				xEnd = 2;
				zEnd = 0;
			}
		}


	return parabollic_z(sphere.position.x, xStart * 10, zStart, xEnd * 10, zEnd, 2);

}


function draw_3d()
{
	// DRAW BALL
		// Position
	sphere.position.x = ball.x * 10;
	sphere.position.y = ball.y * 10;
		// Height
	sphere.position.z = set_ball_height()

	// DRAW PADDLES
	westPaddle.position.x = players[0].x * 10;
	westPaddle.position.y = players[0].y * 10;
	westPaddle.rotation.z = players[0].angle + Math.PI / 2;
	westHandle.position.x = westPaddle.position.x
	westHandle.position.y = westPaddle.position.y

	eastPaddle.position.x = players[1].x * 10;
	eastPaddle.position.y = players[1].y * 10;
	eastPaddle.rotation.z = players[1].angle + Math.PI / 2;
	eastHandle.position.x = eastPaddle.position.x
	eastHandle.position.y = eastPaddle.position.y

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
		ball.speed.x = parseFloat(msg.ball_speed_x);
		ball.speed.y = parseFloat(msg.ball_speed_y);
		ball.last_hit.x = parseFloat(msg.ball_last_hit_x);
		ball.last_hit.y = parseFloat(msg.ball_last_hit_y);


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


