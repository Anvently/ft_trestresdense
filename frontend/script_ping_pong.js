import * as THREE from 'three';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';


const start_button = document.getElementById("start_button");

// Constants
const TABLE_LENGTH = 9/5;
const BALL_RADIUS = 0.013
const PADDLE_LENGTH = 0.1
const PADDLE_THICKNESS = 0.01
const REBOUND_LINE_X = 0.4
const REBOUND_HEIGHT = 1
const REBOUND_FAR_OUT = 10

const WEST = 0;
const EAST = 1;

const CAMERA_SPEED = 0.1

const FOOT_POS = {
	X: [-6, -6, 0, 0, 6, 6],
	Y: [-4.5, 4.5, -4.5, 4.5, -4.5, 4.5]
};

// Globals
var players = [
		{points: 0, x: 0, y: 0, angle: 0, width: 0, height: 0}
	];
var ball = {x: 0.5, y: 0.5, r: 0, speed: {x: 0, y: 0}, last_hit: {x: 0, y: 0}};
var objects = {ball: null, paddle:[], score_board:[]}
var user_id;
var my_direction = -1;
var is_service = false


const scene = new THREE.Scene();

// CAMERA ////////////////////////////////////////////////////
const camera = new THREE.PerspectiveCamera( 60, 4/3, 0.1, 100);
camera.up.set(0, 0, 1); // Set Z as the up direction

// RENDERER //////////////////////////////////////////////////
const renderer = new THREE.WebGLRenderer();
renderer.setSize(1500, 1000);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

	// Texture Loader 
const textureLoader = new THREE.TextureLoader();

	// Font Loader
const fontLoader = new FontLoader();


// LIGHT //////////////////////////////////////////////////////
// SpotLight( color : Integer, intensity : Float, distance : Float, angle : Radians, penumbra : Float, decay : Float )
// {
// 	const spotlight = new THREE.SpotLight(0xffffff, 10, 0, Math.PI / 4, 0.5, 0.5);
// 	// spotlight.position.set(-10, -2, 1);
// 	spotlight.position.set(-8, -5, 15);
// 	spotlight.lookAt(0,0,0)
// 	spotlight.castShadow = true;
// 	spotlight.shadow.mapSize.width = 1024;
// 	spotlight.shadow.mapSize.height = 1024;
// 	spotlight.shadow.camera.near = 1;
// 	spotlight.shadow.camera.far = 500;
// 	spotlight.shadow.camera.fov = 60;
// 	scene.add(spotlight);
// }

{
	const spotlight = new THREE.SpotLight(0xffffff, 10, 0, Math.PI / 4, 0.5, 0.5);
	spotlight.position.set(-5, 2, 15);
	spotlight.lookAt(0,0,0)
	spotlight.castShadow = true;
	spotlight.shadow.mapSize.width = 1024;
	spotlight.shadow.mapSize.height = 1024;
	spotlight.shadow.camera.near = 1;
	spotlight.shadow.camera.far = 500;
	spotlight.shadow.camera.fov = 60;
	scene.add(spotlight);
}
{
	const spotlight = new THREE.SpotLight(0xffffff, 10, 0, Math.PI / 4, 0.5, 0.5);
	spotlight.position.set(7, -10, 5);
	spotlight.lookAt(0,0,0)
	spotlight.castShadow = true;
	spotlight.shadow.mapSize.width = 1024;
	spotlight.shadow.mapSize.height = 1024;
	spotlight.shadow.camera.near = 1;
	spotlight.shadow.camera.far = 500;
	spotlight.shadow.camera.fov = 60;
	scene.add(spotlight);
}


// ambient Light
{
	const ambientLight = new THREE.AmbientLight( 0x404040 , 6); // soft white light
	scene.add( ambientLight );
}


// OBJECTS ///////////////////////////////////////////////////
	// BALL
{
	const sphereGeometry = new THREE.SphereGeometry(BALL_RADIUS * 10, 32, 32);
	const sphereMaterial = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.7, metalness: 0.5 });
	objects.ball = new THREE.Mesh(sphereGeometry, sphereMaterial);
	objects.ball.castShadow = true;
	objects.ball.receiveShadow = true;
	scene.add(objects.ball);
}

	// TABLE
const tableGroup = new THREE.Group();
{
		// tablemesh
	const tableTexture = textureLoader.load('image/table_512.jpg');
	tableTexture.colorSpace = THREE.SRGBColorSpace;
	const tableGeometry = new THREE.BoxGeometry(TABLE_LENGTH * 10, 10, 0.2);
	const tableMaterial = new THREE.MeshStandardMaterial({ map: tableTexture, roughness: 0.7, metalness: 0.5});
	const tableMesh = new THREE.Mesh(tableGeometry, tableMaterial);
	tableMesh.castShadow = true;
	tableMesh.receiveShadow = true;
	tableMesh.position.z -= 0.2;
	tableGroup.add(tableMesh);

	// feet
	for (var i = 0; i < 6; i++) {
		const footGeometry = new THREE.BoxGeometry(0.2, 0.2, 4.8);
		const footMaterial = new THREE.MeshStandardMaterial({ color: 0x050505});
		const footMesh = new THREE.Mesh(footGeometry, footMaterial);
		footMesh.castShadow = true;
		footMesh.receiveShadow = true;
		footMesh.position.z = -2.7
		footMesh.position.x = FOOT_POS.X[i]
		footMesh.position.y = FOOT_POS.Y[i]
		tableGroup.add(footMesh)
	}

	// net
	create_net(tableGroup)
}

function create_net(group)
{
	var num_verticals = 100
	var num_horizontals = 10

	var width = 10;
	var height = 0.7;

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
	// left side
	{
		const geometry = new THREE.BoxGeometry(0.15, 0.15, 1.4);
		const material = new THREE.MeshPhongMaterial({ color: 0x000000 });
		const mesh = new THREE.Mesh(geometry, material);
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		mesh.position.y = -5.075;
		mesh.position.z = 0.35;
		group.add(mesh);
	}
	// right side
	{
		const geometry = new THREE.BoxGeometry(0.15, 0.15, 1.4);
		const material = new THREE.MeshPhongMaterial({ color: 0x000000 });
		const mesh = new THREE.Mesh(geometry, material);
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		mesh.position.y = 5.075;
		mesh.position.z = 0.35;
		group.add(mesh);
	}
	// vertical threads
	for (var i = 0; i < num_verticals; i++) {
		const geometry = new THREE.BoxGeometry(width / (5 * num_verticals), width / (5 * num_verticals), 0.7);
		const material = new THREE.MeshStandardMaterial({ color: 0x000000 });
		const mesh = new THREE.Mesh(geometry, material);
		mesh.castShadow = true;
		mesh.position.z = 0.45;
		mesh.position.y = (i * width / (num_verticals)) - 5;
		group.add(mesh);
	}
	//horizontal threads
	for (var i = 0; i < num_horizontals; i++) {
		const geometry = new THREE.BoxGeometry(height / (5 * num_horizontals), width, height / (5 * num_horizontals));
		const material = new THREE.MeshStandardMaterial({ color: 0x000000 });
		const mesh = new THREE.Mesh(geometry, material);
		mesh.castShadow = true;
		mesh.position.z = (i * height / (num_horizontals) + 0.1);
		mesh.position.y = 0;
		group.add(mesh);
	}
}

scene.add(tableGroup)


const tableGroup2 = tableGroup.clone()
tableGroup2.position.y += 20
scene.add(tableGroup2)
const tableGroup3 = tableGroup.clone()
tableGroup3.position.y -= 20
scene.add(tableGroup3)



// ROOM
const WALL_POSITION = {
	X: [-50, 0, 50, 0],
	Y: [0, -50, 0, 50],
	rotX: [Math.PI/2, Math.PI/2, Math.PI/2, Math.PI/2],
	rotY: [Math.PI/2, 0, Math.PI/2, 0]
	
}

{
	const roomGroup = new THREE.Group();

	// Floor
	{
		const floorTexture = textureLoader.load('image/floorboard_512.jpg');
		floorTexture.colorSpace = THREE.SRGBColorSpace;
		floorTexture.wrapS = THREE.RepeatWrapping;
		floorTexture.wrapT = THREE.RepeatWrapping;
		floorTexture.repeat.set(4, 4); // number of repetitions
		
		const geometry = new THREE.PlaneGeometry(100, 100);
		const material = new THREE.MeshStandardMaterial({ map: floorTexture, side: THREE.DoubleSide });
		const mesh = new THREE.Mesh(geometry, material);
		mesh.position.z = -5;
		mesh.receiveShadow = true;
		roomGroup.add(mesh);
	}

	// Walls
	{
		// const wallTexture = textureLoader.load('image/brick_wall_512.jpg');
		const wallTexture = textureLoader.load('image/metal_wall.jpg');
		wallTexture.colorSpace = THREE.SRGBColorSpace;
		wallTexture.wrapS = THREE.RepeatWrapping;
		wallTexture.wrapT = THREE.RepeatWrapping;
		wallTexture.repeat.set(4, 2); // number of repetitions
		// wallTexture.repeat.set(8, 4); // number of repetitions
		
		for(var i = 0; i < 4; i++){
			const geometry = new THREE.PlaneGeometry(100, 50);
			const material = new THREE.MeshStandardMaterial({ map: wallTexture, side: THREE.DoubleSide });
			const mesh = new THREE.Mesh(geometry, material);
			mesh.position.x = WALL_POSITION.X[i];
			mesh.position.y = WALL_POSITION.Y[i];
			mesh.rotation.x = WALL_POSITION.rotX[i];
			mesh.rotation.y = WALL_POSITION.rotY[i];
			mesh.position.z = 20
			mesh.receiveShadow = true;
			roomGroup.add(mesh);
		}
	}


	scene.add(roomGroup);
}




	// PADDLES
const createPaddle = (color) => {
	const group = new THREE.Group();

	// HANDLE
	const handleGeometry = new THREE.BoxGeometry(0.12, 0.095, 0.5);
	const handleMaterial = new THREE.MeshStandardMaterial({ color: 0xc5a785, side: THREE.DoubleSide});
	const handleMesh = new THREE.Mesh(handleGeometry, handleMaterial);
	handleMesh.castShadow = true;
	handleMesh.receiveShadow = true;
	// handleMesh.rotation.y = Math.PI/2
	handleMesh.position.z = -0.6; 
	handleMesh.position.x = -0.35; 
	handleMesh.rotation.y = Math.PI/6;
	group.add(handleMesh);

	// CYLINDER
	const cylinderGeometry = new THREE.CylinderGeometry((PADDLE_LENGTH / 2) * 10, (PADDLE_LENGTH / 2) * 10, PADDLE_THICKNESS * 10, 24);
	const cylinderMaterial = new THREE.MeshStandardMaterial({ color: color });
	const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
	cylinder.castShadow = true;
	cylinder.receiveShadow = true;
	group.add(cylinder);

	group.rotation.z = Math.PI / 2;
	group.position.z = 1;

	return group;
}

// SCORE BOARD

var font;
fontLoader.load('https://cdn.jsdelivr.net/npm/three@0.136.0/examples/fonts/droid/droid_sans_regular.typeface.json', (loadedFont) => {
	font = loadedFont;
	objects.score_board.push(createScoreBoard(0xf00000, WEST));
	objects.score_board.push(createScoreBoard(0x0000f0, EAST));
	objects.score_board.forEach(score_board => scene.add(score_board))
})

function createScoreBoard(color, side)
{
		const geometry = new TextGeometry('0', {
			font: font,
			size: 1.5,
			depth: 0.1,
			curveSegments: 12,
		});
		const material = new THREE.MeshStandardMaterial({ color: color });
		const textMesh = new THREE.Mesh(geometry, material);
		
		if (side == WEST)
		{
			textMesh.position.set(-3, 5, 0.2);  // Adjust position
		}
		else
		{
			textMesh.position.set(3, -5, 0.2);  // Adjust position
			textMesh.rotation.y = Math.PI
		}
		
		textMesh.rotation.x = Math.PI/2
		return(textMesh)
}

// SOUND
var ping_sound = new Audio("sound/ping_sound.mp3");
var pong_sound = new Audio("sound/pong_sound.mp3");


start_button.addEventListener('click', () => {
	// ping_sound.play();;
	pong_sound.play()
	
});







window.onload = function() {
	// TEMPORARY Afficher une fenêtre popup pour demander à l'utilisateur d'entrer une valeur 
	user_id = prompt("Veuillez entrer une valeur :");

	objects.paddle.push(createPaddle(0xf00000)); // West paddle
	objects.paddle.push(createPaddle(0x0000f0)); // East paddle
	objects.paddle.forEach(paddle => scene.add(paddle))



	const wsRef = new WebSocket(
		'wss://'
		+ `${location.hostname}:8083`
		+ `/ws/pong/11/`
	);

	wsRef.onmessage = function (e) {
		const msg = JSON.parse(e.data);
		if (msg.hasOwnProperty("type") === false)
			return
		else if (msg["type"] === "ping")
			wsRef.send(JSON.stringify({type: 'join_game', username: `${user_id}`}));
		else if (msg["type"] === "send_game_state") {
			is_service = msg.is_service;
			ball.x = parseFloat(msg.ball_x);
			ball.y = parseFloat(msg.ball_y);
			ball.r = parseFloat(msg.ball_r);
			ball.speed.x = parseFloat(msg.ball_speed_x);
			ball.speed.y = parseFloat(msg.ball_speed_y);
			ball.last_hit.x = parseFloat(msg.ball_last_hit_x);
			ball.last_hit.y = parseFloat(msg.ball_last_hit_y);
			ball.is_out = msg.ball_is_out;
			for (var i = 0; i < 2; i++)
			{
				players[i] = {
							id: msg[`player${i}_id`],
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
	
};


function draw_3d() {
	set_camera()

	// DRAW BALL
	objects.ball.position.x = ball.x * 10;
	objects.ball.position.y = ball.y * 10;
	objects.ball.position.z = set_ball_height()

	for (var i = 0; i < 2; i++) {
		// DRAW PADDLES
		objects.paddle[i].position.x = players[i].x * 10;
		objects.paddle[i].position.y = players[i].y * 10;
		set_paddle_height(i)
		objects.paddle[i].rotation.z = players[i].angle + Math.PI / 2;
	}

	// SCORE BOARD
	updateScoreBoard(WEST, players[WEST].points);
	updateScoreBoard(EAST, players[EAST].points);

	// SOUND
	ball_sound()

	renderer.render(scene, camera);
}


function updateScoreBoard(side, score) {
	if (objects.score_board[side]) {
		const geometry = new TextGeometry(score.toString(), {
			font: font,
			size: 1.5,
			depth: 0.1,
			curveSegments: 12,
		});
		objects.score_board[side].geometry.dispose(); // Clean up old geometry
		objects.score_board[side].geometry = geometry; // Set new geometry
	}
}

var previous_hit_x = 0;
var sound_type = 1 // 1 is PONG, 0 is PING
function ball_sound() {
	
	if (sound_type == 0) { // PING when ball hit the table
		if ((ball.speed.x > 0 && ball.x  > REBOUND_LINE_X) // ball is going EAST
			|| ball.speed.x < 0 && ball.x < -REBOUND_LINE_X) {
			if (!ball.is_out)
				play_sound(sound_type)
			sound_type = !sound_type
		}
	} else { // PONG when ball hit the paddle
		if (previous_hit_x != ball.last_hit.x) {
			previous_hit_x = ball.last_hit.x
			play_sound(sound_type)
			sound_type = !sound_type
		}
	}
}

function play_sound(sound_type) {
	if (sound_type == 0){
		ping_sound.play()
	} else if (sound_type == 1){
		pong_sound.play()
	}
}

function set_camera() {
	// find my position // Find a better way to avoid recalculation ? eventOnFirstMessage ?
	for (var i = 0; i < 2; i++) {
		if (players[i].id == user_id)
			my_direction = i;
	}
	if (my_direction == -1)
		spectator_camera()
	else
		set_POV_camera()
}


let angle = 0;
function spectator_camera() {
	const radius = 20;

	angle += 0.005;
	camera.position.x = radius * Math.cos(angle);
	camera.position.y = radius * Math.sin(angle);
	camera.position.z = 10;
	camera.lookAt(0, 0, 0);
}

function set_POV_camera() {
	// calculate camera destination
	var camera_destination = {x: 0, y: 0, z: 0}

	var radius = 15;
	var camera_angle = 0;
	var player_angle = players[my_direction].angle;
	var middle_angle = 0

	if (my_direction == WEST)
		middle_angle = Math.PI
	else if (my_direction == EAST)
		player_angle += Math.PI;

	radius = Math.abs(players[my_direction].x**2 + players[my_direction].y**2) * 5 + 10
	player_angle = normalizeAngle(player_angle);
	camera_angle = middle_angle + player_angle / 2;

	camera_destination.x = radius * Math.cos(camera_angle);
	camera_destination.y = radius * Math.sin(camera_angle);

	camera.position.z = 5;

	// Move camera + smoothness
	if (camera.position.x < camera_destination.x)
		camera.position.x += (camera_destination.x - camera.position.x) * CAMERA_SPEED
	else if (camera.position.x > camera_destination.x)
		camera.position.x -= (camera.position.x - camera_destination.x) * CAMERA_SPEED

	if (camera.position.y < camera_destination.y)
		camera.position.y += (camera_destination.y - camera.position.y) * CAMERA_SPEED
	else if (camera.position.y > camera_destination.y)
		camera.position.y -= (camera.position.y - camera_destination.y) * CAMERA_SPEED

	camera.lookAt(0, 0, 0);
}

function normalizeAngle(angle) {
	return angle - 2 * Math.PI * Math.floor((angle + Math.PI) / (2 * Math.PI));
}

function set_paddle_height(direction) {
	if ((ball.x < 0 && direction == WEST) || (ball.x > 0 && direction == EAST) ) {
		if (objects.paddle[direction].position.z > Math.max(objects.ball.position.z, 0.8))
			objects.paddle[direction].position.z -= 0.01
		else if (objects.paddle[direction].position.z < objects.ball.position.z)
			objects.paddle[direction].position.z += 0.01
	} else {
		if (objects.paddle[direction].position.z >= 1.01)
			objects.paddle[direction].position.z -= 0.01
		else if (objects.paddle[direction].position.z < 1)
			objects.paddle[direction].position.z += 0.01
	}
}

function set_ball_height() {
	var xStart, zStart, xEnd, zEnd;

	const isEast = ball.speed.x > 0;
	const passedReboundLine = isEast ? ball.x > REBOUND_LINE_X : ball.x < -REBOUND_LINE_X;

	if (is_service)
		return 1;
	else if (passedReboundLine && !ball.is_out) {
		xStart = isEast ? REBOUND_LINE_X : -REBOUND_LINE_X;
		zStart = 0;
		xEnd = (isEast ? REBOUND_FAR_OUT * ball.speed.x * 10 + 1 : REBOUND_FAR_OUT * ball.speed.x * 10 - 1);
		zEnd = 0;
	} else {
		xEnd = isEast ? REBOUND_LINE_X : -REBOUND_LINE_X;
		zEnd = 0;
		if (ball.last_hit.x !== 0) {
			xStart = ball.last_hit.x;
			zStart = parabolic_z(
				ball.last_hit.x * 10,
				isEast ? -REBOUND_LINE_X * 10 : REBOUND_LINE_X * 10,
				0,
				isEast ? -2 * 10 : 2 * 10,
				0,
				REBOUND_HEIGHT
			);
		} else {
			xStart = 0;
			zStart = 1;
		}
	}

	return parabolic_z(
		objects.ball.position.x,
		xStart * 10,
		zStart,
		xEnd * 10,
		zEnd,
		REBOUND_HEIGHT
	);
}

function parabolic_z(x, x1, z1, x2, z2, height) {
	var xMid = (x1 + x2) / 2;
	var k = z1 + height;

	if (x1 < x2 && x <= xMid || x1 > x2 && x > xMid) {
		var a1 = (z1 - k) / ((x1 - xMid) ** 2);
		return a1 * ((x - xMid) ** 2) + k;
	} else {
		var a2 = (z2 - k) / ((x2 - xMid) ** 2);
		return a2 * ((x - xMid) ** 2) + k;
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


