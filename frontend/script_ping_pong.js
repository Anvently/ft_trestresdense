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



// TODO
	// Front-End
		// - better net
		// - ball fall to the floor when out
		// - ping pong sound
		// - lighting
		// - camera
	// Back-End
		// - service (A REVOIR ?)

// Constants
const TABLE_LENGTH = 9/5;
const BALL_RADIUS = 0.013
const PADDLE_LENGTH = 0.1
const PADDLE_THICKNESS = 0.01
const MIN_SPEED = 0.01

const REBOUND_LINE_X = 0.4
const REBOUND_HEIGHT = 1
const REBOUND_FAR_OUT = 10

const WEST = 0;
const EAST = 1;

const FOOT_POS = {
	X: [-6, -6, 0, 0, 6, 6], // X coordinates for each foot
	Y: [-4.5, 4.5, -4.5, 4.5, -4.5, 4.5]  // Y coordinates for each foot
};

// Globals
var players = [
		{points: 0, x: 0, y: 0, angle: 0, width: 0, height: 0}
	];
var ball = {x: 0.5, y: 0.5, r: 0, speed: {x: 0, y: 0}, last_hit: {x: 0, y: 0}};
var user_id;



import * as THREE from "https://cdn.skypack.dev/three@0.132.2";

const scene = new THREE.Scene();


// CAMERA ////////////////////////////////////////////////////
const camera = new THREE.PerspectiveCamera( 60, 4/3, 0.1, 100);
camera.up.set(0, 0, 1); // Set Z as the up direction


	// West POV View
// camera.position.set(-17, 0, 5)
// camera.lookAt(0, 0, -4);

	// Standard View
camera.position.set(0, -12, 15)
camera.lookAt(0, 0, 0);

	// display view
// camera.position.set(-10, -12, 3)
// camera.lookAt(0, 0, 0);

	// Table Level View
// camera.position.set(0, -15, 3)
// camera.lookAt(0, 0, 0);

	// Top view
// camera.position.set(0, 0, 15)
// camera.lookAt(0, 0, 0);

	// test POV view
// camera.position.set(-20, 0, 4)
// camera.rotation.z = -Math.PI/2
// camera.rotation.y = -Math.PI/2

// RENDERER //////////////////////////////////////////////////
const renderer = new THREE.WebGLRenderer();
renderer.setSize(1200, 800);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // default THREE.PCFShadowMap
document.body.appendChild(renderer.domElement);

// Add axis AIDS
// const axesHelper = new THREE.AxesHelper(100);
// scene.add(axesHelper)

// TEXTURE LOADER ////////////////////////////////////////////
const loader = new THREE.TextureLoader();


// OBJECTS ///////////////////////////////////////////////////
var objects = {table: null, floor: null, ball: null, paddle:[], spotlight: null}

// LIGHT
// SpotLight( color : Integer, intensity : Float, distance : Float, angle : Radians, penumbra : Float, decay : Float )
objects.spotlight = new THREE.SpotLight(0xffffff, 0.8, 0, Math.PI / 4, 0.5, 0.5);
objects.spotlight.position.set(-5, -5, 30);
objects.spotlight.lookAt(0,0,0)
objects.spotlight.castShadow = true;
objects.spotlight.shadow.mapSize.width = 1024;
objects.spotlight.shadow.mapSize.height = 1024;
objects.spotlight.shadow.camera.near = 1;
objects.spotlight.shadow.camera.far = 500;
objects.spotlight.shadow.camera.fov = 30;
scene.add(objects.spotlight);


// ambient Light
const ambientLight = new THREE.AmbientLight( 0x404040 ); // soft white light
scene.add( ambientLight );

// BALL
const sphereGeometry = new THREE.SphereGeometry(BALL_RADIUS * 10, 32, 32);
const sphereMaterial = new THREE.MeshStandardMaterial({ color: 0xf0f0f0 });
objects.ball = new THREE.Mesh(sphereGeometry, sphereMaterial);
objects.ball.castShadow = true;
objects.ball.receiveShadow = true;
scene.add(objects.ball);

// TABLE
const group = new THREE.Group();

	// tablemesh
const tableTexture = loader.load('image/table_512.jpg');
tableTexture.colorSpace = THREE.SRGBColorSpace;
const tableGeometry = new THREE.BoxGeometry(TABLE_LENGTH * 10, 10, 0.2);
const tableMaterial = new THREE.MeshStandardMaterial({ map: tableTexture});
const tableMesh = new THREE.Mesh(tableGeometry, tableMaterial);
tableMesh.castShadow = true;
tableMesh.receiveShadow = true;
tableMesh.position.z -= 0.2;
group.add(tableMesh);

// feet
for (var i = 0; i < 6; i++)
{
	const footGeometry = new THREE.BoxGeometry(0.2, 0.2, 4.8);
	const footMaterial = new THREE.MeshStandardMaterial({ color: 0x050505});
	const footMesh = new THREE.Mesh(footGeometry, footMaterial);
	footMesh.castShadow = true;
	footMesh.receiveShadow = true;
	footMesh.position.z = -2.7
	footMesh.position.x = FOOT_POS.X[i]
	footMesh.position.y = FOOT_POS.Y[i]
	group.add(footMesh)
}

// net
create_net(group)

// const netGeometry = new THREE.BoxGeometry(0.1, 10, 1);
// const netMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
// const netMesh = new THREE.Mesh(netGeometry, netMaterial);
// netMesh.castShadow = true;
// netMesh.receiveShadow = true;
// netMesh.position.z = 0.4;
// group.add(netMesh);


function create_net(group)
{
	var num_verticals = 100
	var num_horizontals = 10

	var width = 10;
	var height = 1;

	// top
	{
		const geometry = new THREE.BoxGeometry(width / (4 * num_verticals), 10, 0.2);
		const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
		const mesh = new THREE.Mesh(geometry, material);
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		mesh.position.z = 0.9;
		group.add(mesh);
	}

	// vertical threads
	for (var i = 0; i < num_verticals; i++)
	{
		const geometry = new THREE.BoxGeometry(width / (5 * num_verticals), width / (5 * num_verticals), 1);
		const material = new THREE.MeshStandardMaterial({ color: 0x000000 });
		const mesh = new THREE.Mesh(geometry, material);
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		mesh.position.z = 0.4;
		mesh.position.y = (i * width / (num_verticals)) - 5;
		group.add(mesh);
	}
	//horizontal threads
	for (var i = 0; i < num_horizontals; i++)
	{
		const geometry = new THREE.BoxGeometry(height / (5 * num_horizontals), width, height / (5 * num_horizontals));
		const material = new THREE.MeshStandardMaterial({ color: 0x000000 });
		const mesh = new THREE.Mesh(geometry, material);
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		mesh.position.z = (i * height / (num_horizontals));
		mesh.position.y = 0;
		group.add(mesh);
	}
}



objects.table = group
scene.add(objects.table)

// FLOOR

const floorTexture = loader.load('image/floorboard_512.jpg');
floorTexture.colorSpace = THREE.SRGBColorSpace;
floorTexture.wrapS = THREE.RepeatWrapping;
floorTexture.wrapT = THREE.RepeatWrapping;
floorTexture.repeat.set(4, 4); // Adjust the number of repetitions

const floorGeometry = new THREE.PlaneGeometry(100, 100);
const floorMaterial = new THREE.MeshStandardMaterial({ map: floorTexture, side: THREE.DoubleSide });
// const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xe55c28, side: THREE.DoubleSide });
objects.floor = new THREE.Mesh(floorGeometry, floorMaterial);
objects.floor.position.z = -5;
objects.floor.receiveShadow = true;
scene.add(objects.floor);

// PADDLES
const createPaddle = (color) => {
	const group = new THREE.Group();

	// HANDLE
	const handleGeometry = new THREE.BoxGeometry(0.12, 0.095, 0.5);
	const handleMaterial = new THREE.MeshStandardMaterial({ color: 0xc5a785 });
	const handleMesh = new THREE.Mesh(handleGeometry, handleMaterial);
	handleMesh.castShadow = true;
	handleMesh.receiveShadow = true;
	// handleMesh.rotation.y = Math.PI/2
	handleMesh.position.z = -0.6; 
	handleMesh.position.x = -0.35; 
	handleMesh.rotation.y = Math.PI/6;
	group.add(handleMesh);

	// CYLINDER
	const cylinderGeometry = new THREE.CylinderGeometry((PADDLE_LENGTH / 2) * 10, (PADDLE_LENGTH / 2) * 10, PADDLE_THICKNESS * 10, 16);
	const cylinderMaterial = new THREE.MeshStandardMaterial({ color: 0xf00000 });
	const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
	cylinder.castShadow = true;
	cylinder.receiveShadow = true;
	group.add(cylinder);

	group.rotation.z = Math.PI / 2;
	group.position.z = 1;

	return group;
}



///////////////////////////////////////////////////


window.onload = function() {
	// Afficher une fenêtre popup pour demander à l'utilisateur d'entrer une valeur
	user_id = prompt("Veuillez entrer une valeur :");

	// Afficher la valeur dans la console pour vérification
	console.log("Valeur saisie par l'utilisateur : " + user_id);


	objects.paddle.push(createPaddle(0xff0000)); // West paddle
	objects.paddle.push(createPaddle(0xff0000)); // East paddle
	objects.paddle.forEach(paddle => scene.add(paddle))
};



const radius = 20; // Distance from the origin
let angle = 0; // Initial angle
function rotate_camera()
{
	// Update the camera position
	angle += 0.01; // Adjust the angle for rotation speed
	camera.position.x = radius * Math.cos(angle);
	camera.position.y = radius * Math.sin(angle);
	camera.position.z = 5; // Fixed height; adjust as needed
	camera.lookAt(0, 0, 0);
}

function draw_3d()
{

	// rotate_camera()


	// DRAW BALL
	objects.ball.position.x = ball.x * 10;
	objects.ball.position.y = ball.y * 10;
	objects.ball.position.z = set_ball_height()

	// DRAW PADDLES

	for (var i = 0; i < 2; i++)
	{
		objects.paddle[i].position.x = players[i].x * 10;
		objects.paddle[i].position.y = players[i].y * 10;
		set_paddle_height(i)
		objects.paddle[i].rotation.z = players[i].angle + Math.PI / 2;

	}



	renderer.render(scene, camera);
}

function set_paddle_height(direction)
{
	if ((ball.x < 0 && direction == WEST) || (ball.x > 0 && direction == EAST) )
		{
			if (objects.paddle[direction].position.z > Math.max(objects.ball.position.z, 0.8))
				objects.paddle[direction].position.z -= 0.01
			else if (objects.paddle[direction].position.z < objects.ball.position.z)
				objects.paddle[direction].position.z += 0.01
		}
		else
		{
			if (objects.paddle[direction].position.z > 1)
				objects.paddle[direction].position.z -= 0.01
			else
				objects.paddle[direction].position.z += 0.01
		}
}

function set_ball_height()
{
	var xStart;
	var zStart;
	var xEnd;
	var zEnd;
	
	if (ball.speed.x > 0) // ball is going EAST
	{
		if (ball.x > REBOUND_LINE_X) // the ball passed the rebound line // + AND rebound was on the line
		{
			xStart = REBOUND_LINE_X;
			zStart = 0;
			xEnd = REBOUND_FAR_OUT * ball.speed.x * 10 + 1;
			console.log(ball.speed.x)
			zEnd = 0;
		}
		else // the ball is before the rebound line
		{
			xEnd = REBOUND_LINE_X;
			zEnd = 0;
			if (ball.last_hit.x !== 0)
			{
				xStart = ball.last_hit.x;
				zStart = parabollic_z(ball.last_hit.x * 10, -REBOUND_LINE_X * 10, 0, -2 * 10, 0, REBOUND_HEIGHT);
			}
			else //service
			{
				xStart = 0;
				zStart = 1;
			}
		}
	}
	else if (ball.speed.x < 0) // Ball is going west
	{
		if (ball.x < -REBOUND_LINE_X) // the ball passed the rebound line
		{
			xStart = -REBOUND_LINE_X;
			zStart = 0;
			xEnd = REBOUND_FAR_OUT * ball.speed.x * 10 -1;
			zEnd = 0;
		}
		else // the ball is before the rebound line
		{
			xEnd = -REBOUND_LINE_X; 
			zEnd = 0;
			if (ball.last_hit.x !== 0)
			{
				xStart = ball.last_hit.x
				zStart = parabollic_z(ball.last_hit.x * 10, REBOUND_LINE_X * 10, 0, 2 * 10, 0, REBOUND_HEIGHT)
			}
			else //service
			{
				xEnd = -REBOUND_LINE_X;
				xStart = 0;
				zStart = 1;
			}
		}
	}
	return parabollic_z(objects.ball.position.x, xStart * 10, zStart, xEnd * 10, zEnd, REBOUND_HEIGHT);
}

function parabollic_z(x, x1, z1, x2, z2, height)
{
	var xMid = (x1 + x2) / 2;
	var k = z1 + height;

	if (x1 < x2 && x <= xMid || x1 > x2 && x > xMid)
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
						points: msg[`player${i}_points`],
						x: msg[`player${i}_x`],
						y: msg[`player${i}_y`],
						angle: msg[`player${i}_angle`],
						width: msg[`player${i}_width`],
						height: msg[`player${i}_height`]
					
					};
		}
		draw_3d();
	}
}

// INPUT ///////////////////////////////////////
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


