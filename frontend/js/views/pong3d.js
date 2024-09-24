// import * as THREE from 'three';
// import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
// import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.168.0/build/three.module.js'
// import { TextGeometry } from "https://cdn.jsdelivr.net/npm/three@0.168.0/examples/jsm/geometries/TextGeometry.js"
// import { FontLoader } from "https://cdn.jsdelivr.net/npm/three@0.168.0/examples/jsm/loaders/FontLoader.js"

import { BaseView } from '../view-manager.js';
import { userInfo } from '../home.js';



// Constants
const TABLE_LENGTH = 9/5;
const BALL_RADIUS = 0.013;
const PADDLE_LENGTH = 0.1;
const PADDLE_THICKNESS = 0.01;
const REBOUND_LINE_X = 0.4;
const REBOUND_HEIGHT = 1;
const REBOUND_FAR_OUT = 10;

const WEST = 0;
const EAST = 1;

const CAMERA_SPEED = 0.1;

const FOOT_POS = {
	X: [-6, -6, 0, 0, 6, 6],
	Y: [-4.5, 4.5, -4.5, 4.5, -4.5, 4.5]
};

const WALL_POSITION = {
	X: [-50, 0, 50, 0],
	Y: [0, -50, 0, 50],
	rotX: [Math.PI/2, Math.PI/2, Math.PI/2, Math.PI/2],
	rotY: [Math.PI/2, 0, Math.PI/2, 0]
};


console.log(userInfo);

// SOUND
var ping_sound = new Audio("sound/ping_sound.mp3");
var pong_sound = new Audio("sound/pong_sound.mp3");
// const start_button = document.getElementById("start_button");

// Texture Loader 
const textureLoader = new THREE.TextureLoader();

// Font Loader
// const fontLoader = new FontLoader();

// var FONT;
// fontLoader.load('https://cdn.jsdelivr.net/npm/three@0.136.0/examples/fonts/droid/droid_sans_regular.typeface.json', (loadedFont) => {
// 	FONT = loadedFont;
// })





export default class Pong3DView extends BaseView {
	constructor() {
		super("pong3d-view");

		this.socket = null;

		this.scene = null;
		this.camera = null;
		this.renderer = null;
		this.objects = {
			ball: null,
			paddle:[],
			score_board:[],
			environment: {room: null, table: null}
		};

		this.pressKey = {
			key_up: false,
			key_down: false,
			key_left: false,
			key_right: false
		};

		this.players = [
			{points: 0, x: 0, y: 0, angle: 0, width: 0, height: 0, id: ''},
			{points: 0, x: 0, y: 0, angle: 0, width: 0, height: 0, id: ''}
		];
		this.ball = {x: 0.5, y: 0.5, r: 0, speed: {x: 0, y: 0}, last_hit: {x: 0, y: 0}};
		this.angle = 0; // spectator camera angle
		this.my_direction = -1;
		this.is_service = false;
		this.intervalId = null;
	}

	initView() {
		this.createScene();
		this.initWebSocket();
		this.startGameLoop();
		this.setupInputListeners();
		this.setupResizeListener();
	}

	initWebSocket() {
		console.log("initWebSocket");
		this.socket = new WebSocket(`wss://${location.hostname}:8083/ws/pong/11/`);
			// `wss://${location.host}:/ws/pong/11/`

		this.socket.onmessage = (e) => {
			const msg = JSON.parse(e.data);
			if (!msg["type"]) {
				return ;
			}
			if (msg["type"] == "ping") {
				this.socket.send(
					JSON.stringify({ type: "join_game", username: `${userInfo.username}` })
				);
			} else if (msg["type"] === "send_game_state") {
				this.updateGameState(msg);
				this.draw3D();
			}
		};
	}

	createScene() {
		console.log("createScene");
		// Scene
		this.scene = new THREE.Scene();

		// Camera
		this.camera = new THREE.PerspectiveCamera( 60, 4/3, 0.1, 100);
		this.camera.up.set(0, 0, 1); // Set Z as the up direction

		// Renderer
		this.renderer = new THREE.WebGLRenderer();
		// this.renderer.setSize(1200, 900);
		this.resize();
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		// document.body.appendChild(this.renderer.domElement)
		document.getElementById('container-canva').appendChild(this.renderer.domElement);
		;

		// lights
			// SpotLights
		this.scene.add(createSpotLight({x: -5, y: 2, z: 15}));
		this.scene.add(createSpotLight({x: 7, y: -10, z: 5}));
			// Ambient Light
		const ambientLight = new THREE.AmbientLight( 0x404040 , 6);
		this.scene.add( ambientLight );
	
		// Room
			// create room
		this.objects.environment.room = createRoom();
		this.scene.add(this.objects.environment.room);
			// create table
		this.objects.environment.table = createTable();
		this.scene.add(this.objects.environment.table);

		// Ball
		this.objects.ball = createBall();
		this.scene.add(this.objects.ball);
		
		// Paddles
		this.objects.paddle.push(createPaddle(0xf00000)); // West paddle
		this.objects.paddle.push(createPaddle(0x0000f0)); // East paddle
		this.objects.paddle.forEach(paddle => this.scene.add(paddle))
		
		// Score Board
		// this.objects.score_board.push(createScoreBoard(0xf00000, WEST, FONT));
		// this.objects.score_board.push(createScoreBoard(0x0000f0, EAST, FONT));
		// this.objects.score_board.forEach(score_board => this.scene.add(score_board))

	}

	updateGameState(msg) {
		this.is_service = msg.is_service;
		this.ball.x = parseFloat(msg.ball_x);
		this.ball.y = parseFloat(msg.ball_y);
		this.ball.r = parseFloat(msg.ball_r);
		this.ball.speed.x = parseFloat(msg.ball_speed_x);
		this.ball.speed.y = parseFloat(msg.ball_speed_y);
		this.ball.last_hit.x = parseFloat(msg.ball_last_hit_x);
		this.ball.last_hit.y = parseFloat(msg.ball_last_hit_y);
		this.ball.is_out = msg.ball_is_out;

		for (let i = 0; i < 2; i++) {
			this.players[i] = {
				id: msg[`player${i}_id`],
				points: msg[`player${i}_points`],
				x: msg[`player${i}_x`],
				y: msg[`player${i}_y`],
				angle: msg[`player${i}_angle`],
				width: msg[`player${i}_width`],
				height: msg[`player${i}_height`],
			};
		}
	}

	startGameLoop() {
		console.log("startGameLoop");
		this.intervalId = setInterval(() => {
			if (this.pressKey.key_up === true)
				this.socket.send(JSON.stringify({type: 'key_input', username:userInfo.username,  input: "up" }));
			if (this.pressKey.key_down === true)
				this.socket.send(JSON.stringify({type: 'key_input', username:userInfo.username,  input: "down" }));
			if (this.pressKey.key_left === true)
				this.socket.send(JSON.stringify({type: 'key_input', username:userInfo.username,  input: "left" }));
			if (this.pressKey.key_right === true)
				this.socket.send(JSON.stringify({type: 'key_input', username:userInfo.username,  input: "right" }));
			

			this.draw3D();

		}, 16);
	}

	draw3D() {
		this.setCamera();

		// Update ball position
		this.objects.ball.position.x = this.ball.x * 10;
		this.objects.ball.position.y = this.ball.y * 10;
		this.objects.ball.position.z = this.setBallHeight();

		// Update paddle positions
		this.objects.paddle.forEach((paddle, i) => {
			paddle.position.x = this.players[i].x * 10;
			paddle.position.y = this.players[i].y * 10;
			this.setPaddleHeight(i);
			paddle.rotation.z = this.players[i].angle + Math.PI / 2;
		});

		// Update scoreboards
		this.updateScoreBoard(WEST, this.players[WEST].points);
		this.updateScoreBoard(EAST, this.players[EAST].points);

		// PLAY SOUND
		///////////// here

		this.renderer.render(this.scene, this.camera);

	}
	
	setupResizeListener() {
		window.addEventListener('resize', () => {this.resize()});
	}

	setupInputListeners() {
		console.log("setupInputListeners");
		window.addEventListener("keydown", (e) => this.handleKeyDown(e));
		window.addEventListener("keyup", (e) => this.handleKeyUp(e));
	}

	resize() {
		var ratio = 4/3;
		
		var newWidth = window.innerWidth;
		var newHeight = window.innerWidth * 3/4;
		if ((window.innerHeight) < window.innerWidth * 3/4) {
			newWidth = window.innerHeight * 4/3;
			newHeight = window.innerHeight;
		}
		this.renderer.setSize(newWidth, newHeight);
			
	}

	handleKeyDown(e) {
		if (e.key === "ArrowUp") this.pressKey.key_up = true;
		else if (e.key === "ArrowDown") this.pressKey.key_down = true;
		else if (e.key === "ArrowLeft") this.pressKey.key_left = true;
		else if (e.key === "ArrowRight") this.pressKey.key_right = true;
	}

	handleKeyUp(e) {
		if (e.key === "ArrowUp") this.pressKey.key_up = false;
		else if (e.key === "ArrowDown") this.pressKey.key_down = false;
		else if (e.key === "ArrowLeft") this.pressKey.key_left = false;
		else if (e.key === "ArrowRight") this.pressKey.key_right = false;
	}

	cleanup() {
		// Cleanup on exit (e.g., WebSocket and intervals)
		if (this.intervalId) clearInterval(this.intervalId);
		if (this.socket) this.socket.close();
	}

	setCamera() {
		// find my position // Find a better way to avoid recalculation ? eventOnFirstMessage ?
		for (var i = 0; i < 2; i++) {
			if (this.players[i].id == userInfo.username)
				this.my_direction = i;
		}

		if (this.my_direction == -1)
			this.spectatorCamera()
		else
			this.setPOVCamera()
	}

	updateScoreBoard(side, score) {
		if (this.objects.score_board[side]) {
			const geometry = new TextGeometry(score.toString(), {
				font: font,
				size: 1.5,
				depth: 0.05,
				curveSegments: 12,
			});
			this.objects.score_board[side].geometry.dispose(); // Clean up old geometry
			this.objects.score_board[side].geometry = geometry; // Set new geometry
		}
	}

	spectatorCamera() {
		const radius = 20;
	
		this.angle += 0.005;
		this.camera.position.x = radius * Math.cos(this.angle);
		this.camera.position.y = radius * Math.sin(this.angle);
		this.camera.position.z = 10;
		this.camera.lookAt(0, 0, 0);
	}

	setPOVCamera() {
		// calculate camera destination
		var camera_destination = {x: 0, y: 0, z: 0}
	
		var radius = 15;
		var camera_angle = 0;
		var player_angle = this.players[this.my_direction].angle;
		var middle_angle = 0
	
		if (this.my_direction == WEST)
			middle_angle = Math.PI
		else if (this.my_direction == EAST)
			player_angle += Math.PI;
	
		radius = Math.abs(this.players[this.my_direction].x**2 + this.players[this.my_direction].y**2) * 5 + 10
		player_angle = normalizeAngle(player_angle);
		camera_angle = middle_angle + player_angle / 2;
	
		camera_destination.x = radius * Math.cos(camera_angle);
		camera_destination.y = radius * Math.sin(camera_angle);
	
		this.camera.position.z = 5;
	
		// Move camera + smoothness
		if (this.camera.position.x < camera_destination.x)
			this.camera.position.x += (camera_destination.x - this.camera.position.x) * CAMERA_SPEED
		else if (this.camera.position.x > camera_destination.x)
			this.camera.position.x -= (this.camera.position.x - camera_destination.x) * CAMERA_SPEED
	
		if (this.camera.position.y < camera_destination.y)
			this.camera.position.y += (camera_destination.y - this.camera.position.y) * CAMERA_SPEED
		else if (this.camera.position.y > camera_destination.y)
			this.camera.position.y -= (this.camera.position.y - camera_destination.y) * CAMERA_SPEED
	
		this.camera.lookAt(0, 0, 0);
	}
	
	setPaddleHeight(direction) {
		if ((this.ball.x < 0 && direction == WEST) || (this.ball.x > 0 && direction == EAST) ) {
			if (this.objects.paddle[direction].position.z > Math.max(this.objects.ball.position.z, 0.8))
				this.objects.paddle[direction].position.z -= 0.01
			else if (this.objects.paddle[direction].position.z < this.objects.ball.position.z)
				this.objects.paddle[direction].position.z += 0.01
		} else {
			if (this.objects.paddle[direction].position.z >= 1.01)
				this.objects.paddle[direction].position.z -= 0.01
			else if (this.objects.paddle[direction].position.z < 1)
				this.objects.paddle[direction].position.z += 0.01
		}
	}
	
	setBallHeight() {
		var xStart, zStart, xEnd, zEnd;
	
		const isEast = this.ball.speed.x > 0;
		const passedReboundLine = isEast ? this.ball.x > REBOUND_LINE_X : this.ball.x < -REBOUND_LINE_X;
	
		if (this.is_service)
			return 1;
		else if (passedReboundLine && !this.ball.is_out) {
			xStart = isEast ? REBOUND_LINE_X : -REBOUND_LINE_X;
			zStart = 0;
			xEnd = (isEast ? REBOUND_FAR_OUT * this.ball.speed.x * 10 + 1 : REBOUND_FAR_OUT * this.ball.speed.x * 10 - 1);
			zEnd = 0;
		} else {
			xEnd = isEast ? REBOUND_LINE_X : -REBOUND_LINE_X;
			zEnd = 0;
			if (this.ball.last_hit.x !== 0) {
				xStart = this.ball.last_hit.x;
				zStart = parabolic_z(
					this.ball.last_hit.x * 10,
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
			this.objects.ball.position.x,
			xStart * 10,
			zStart,
			xEnd * 10,
			zEnd,
			REBOUND_HEIGHT
		);
	}
}




// start_button.addEventListener('click', () => {
// 	// ping_sound.play();;
// 	pong_sound.play()
	
// });




// var previous_hit_x = 0;
// var sound_type = 1 // 1 is PONG, 0 is PING
// function ball_sound() {
	
// 	if (sound_type == 0) { // PING when ball hit the table
// 		if ((ball.speed.x > 0 && ball.x  > REBOUND_LINE_X) // ball is going EAST
// 			|| ball.speed.x < 0 && ball.x < -REBOUND_LINE_X) {
// 			if (!ball.is_out)
// 				play_sound(sound_type)
// 			sound_type = !sound_type
// 		}
// 	} else { // PONG when ball hit the paddle
// 		if (previous_hit_x != ball.last_hit.x) {
// 			previous_hit_x = ball.last_hit.x
// 			play_sound(sound_type)
// 			sound_type = !sound_type
// 		}
// 	}
// }

// function play_sound(sound_type) {
// 	if (sound_type == 0){
// 		ping_sound.play()
// 	} else if (sound_type == 1){
// 		pong_sound.play()
// 	}
// }
















// MATH ////////////////////////////////////////////////////////////////////////
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

function normalizeAngle(angle) {
	return angle - 2 * Math.PI * Math.floor((angle + Math.PI) / (2 * Math.PI));
}

// MESH CREATORS ///////////////////////////////////////////////////////////////

function createSpotLight(position)
{
	const light = new THREE.SpotLight(0xffffff, 10, 0, Math.PI / 4, 0.5, 0.5);
	light.position.set(position.x, position.y, position.z);
	light.lookAt(0,0,0)
	light.castShadow = true;
	light.shadow.mapSize.width = 1024;
	light.shadow.mapSize.height = 1024;
	light.shadow.camera.near = 1;
	light.shadow.camera.far = 500;
	light.shadow.camera.fov = 60;
	return light
}

function createBall()
{
	const geometry = new THREE.SphereGeometry(BALL_RADIUS * 10, 32, 32);
	const material = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.7, metalness: 0.5 });
	const mesh = new THREE.Mesh(geometry, material);
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	return mesh
}

function createTable()
{
	const tableGroup = new THREE.Group();
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
	
	return tableGroup
}

function createRoom()
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
		const wallTexture = textureLoader.load('image/metal_wall.jpg');
		wallTexture.colorSpace = THREE.SRGBColorSpace;
		wallTexture.wrapS = THREE.RepeatWrapping;
		wallTexture.wrapT = THREE.RepeatWrapping;
		wallTexture.repeat.set(4, 2);
		
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

	return roomGroup;
}

function createPaddle(color) {
	const group = new THREE.Group();
	// HANDLE
	const handleGeometry = new THREE.BoxGeometry(0.12, 0.095, 0.5);
	const handleMaterial = new THREE.MeshStandardMaterial({ color: 0xc5a785, side: THREE.DoubleSide});
	const handleMesh = new THREE.Mesh(handleGeometry, handleMaterial);
	handleMesh.castShadow = true;
	handleMesh.receiveShadow = true;
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

function createScoreBoard(color, side, font)
{
		const geometry = new TextGeometry('0', {
			font: font,
			size: 1.5,
			depth: 0.05,
			curveSegments: 12
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