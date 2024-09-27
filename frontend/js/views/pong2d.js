
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.168.0/build/three.module.js'

import { BaseView } from '../view-manager.js';
import { User } from '../home.js';


// Constants
const WEST = 0;
const EAST = 1;
const NORTH = 2;
const SOUTH = 3;

const PADDLE_LENGTH = 0.16
const PADDLE_THICKNESS = 0.05;
const BALL_RADIUS = 0.015

const PADDLE_INIT = {
	WIDTH: [PADDLE_THICKNESS * 10, PADDLE_THICKNESS * 10, PADDLE_LENGTH * 10, PADDLE_LENGTH * 10],
	HEIGHT: [PADDLE_LENGTH * 10, PADDLE_LENGTH * 10, PADDLE_THICKNESS * 10, PADDLE_THICKNESS * 10],
	// Blue, Red, Green, Yellow
	COLOR: [0x0000ff, 0xff0000, 0x00ff00, 0xffff00]
};

const CORNER_POSITION = {
	X: [-10, -10, 10, 10],
	Y: [-10, 10, -10, 10]
};

const WALL_POSITION = {
	X: [-10, 10, 0, 0],
	Y: [0, 0, 10, -10]
};


export default class Pong2DView extends BaseView {
	constructor() {
		super("pong2d-view");

		this.socket = null;

		this.scene = null;
		this.camera = null;
		this.renderer = null;
		this.objects = {
			ball: null,
			paddle:[],
			score_board:[],
			environment: {field: null, corner: [], wall: []}
		};

		this.players = [
			{type: "wall", lives: 0, x: 0, y: 0, width: 0, height: 0},
			{type: "wall", lives: 0, x: 0, y: 0, width: 0, height: 0},
			{type: "wall", lives: 0, x: 0, y: 0, width: 0, height: 0},
			{type: "wall", lives: 0, x: 0, y: 0, width: 0, height: 0}
		];
		this.ball = {x: 0, y: 0, r: 0, speedX: 0, speedY: 0};
		this.number_of_players;
		this.user_id;
		this.pressKey = { key_up: false, key_down: false};
		this.intervalId;
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
		const hash = window.location.hash;
		if (hash.includes('?'))
		{
			const queryString = hash.split('?')[1];
			const params = new URLSearchParams(queryString);
			const sockadd = params.get('id');
		}
		else{
			window.location.hash = '#';
		}
		this.socket = new WebSocket(`wss://${location.hostname}:8083/ws/pong/${sockadd}/`);
		//this.socket = new WebSocket(`wss://${location.hostname}:8083/ws/pong/10/`);

		this.socket.onmessage = (e) => {
			const msg = JSON.parse(e.data);
			if (!msg["type"]) {
				return ;
			}
			if (msg["type"] == "ping") {
				this.socket.send(
					JSON.stringify({ type: "join_game", username: `${User.username}` })
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
		this.camera = new THREE.PerspectiveCamera( 75, 1, 0.1, 1000);
		this.camera.position.z = 10;
		this.camera.lookAt(0, 0, 0);

		// Renderer
		this.renderer = new THREE.WebGLRenderer();
		this.renderer.setSize(1200, 1200);
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		document.getElementById('container-canva').appendChild(this.renderer.domElement);

		this.resize();

		// renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#gameCanvas') });
		// this.canvasRef.nativeElement.appendChild(renderer.domElement);

		// Lights
		this.scene.add(createSpotLight({x: 0, y: 0, z: 10}));

		// Room
		this.createEnvironment(this.scene);

		// Ball
		this.objects.ball = createBall();
		this.scene.add(this.objects.ball);

		// Paddles
		for (let i = 0; i < 4; i++) {
			this.objects.paddle.push(createPaddle(PADDLE_INIT.WIDTH[i],
												PADDLE_INIT.HEIGHT[i],
												0.5,
												PADDLE_INIT.COLOR[i]));
			this.scene.add(this.objects.paddle[i]);
		}

		// Score
	}

	updateGameState(msg) {
		this.number_of_players = parseInt(msg.number_of_players);
		this.ball.x = parseFloat(msg.ball_x);
		this.ball.y = parseFloat(msg.ball_y);
		this.ball.r = parseFloat(msg.ball_r);
		this.ball.speedX = parseFloat(msg.ball_speed_x);
		this.ball.speedY = parseFloat(msg.ball_speed_y);

		for (var i = 0; i < 4; i++)
		{
			this.players[i] = {
				type: msg[`player${i}_type`],
				lives: msg[`player${i}_lives`],
				x: msg[`player${i}_x`],
				y: msg[`player${i}_y`],
				width: msg[`player${i}_width`],
				height: msg[`player${i}_height`]
			};
		}
	}

	startGameLoop() {
		console.log("startGameLoop");
		this.intervalId = setInterval(() => {
			if (this.pressKey.key_up === true)
				webSocket.send(JSON.stringify({type: 'key_input', username:user_id,  input: "up" }));
			if (this.pressKey.key_down === true)
				webSocket.send(JSON.stringify({type: 'key_input', username:user_id,  input: "down" }));

			this.draw3D();
		}, 16);
	}

	draw3D()
	{
		// update ball position
		this.objects.ball.position.x = this.ball.x * 10;
		this.objects.ball.position.y = this.ball.y * 10;
		// update paddles position

		for (var dir = 0; dir < 4; dir++)
		{
			if (this.players[dir].type == "Player")
			{
				this.objects.paddle[dir].position.x = this.players[dir].x * 10;
				this.objects.paddle[dir].position.y = this.players[dir].y * 10;
				this.objects.paddle[dir].position.z = 0;
				this.objects.environment.wall[dir].position.z = -0.5
			}
			else {
				console.log("wall");
				this.objects.environment.wall[dir].position.z = 0
				this.objects.paddle[dir].position.z = -1;
			}

		}

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
		var ratio = 1;

		var newWidth = window.innerWidth;
		var newHeight = window.innerWidth;
		if (window.innerHeight < window.innerWidth) {
			newWidth = window.innerHeight;
			newHeight = window.innerHeight;
		}
		this.renderer.setSize(newWidth, newHeight);
	}

	handleKeyDown(e) {
		if (e.key === "ArrowUp") this.pressKey.key_up = true;
		else if (e.key === "ArrowDown") this.pressKey.key_down = true;
	}

	handleKeyUp(e) {
		if (e.key === "ArrowUp") this.pressKey.key_up = false;
		else if (e.key === "ArrowDown") this.pressKey.key_down = false;
	}

	cleanup() {
		// Cleanup on exit (e.g., WebSocket and intervals)
		if (this.intervalId) clearInterval(this.intervalId);
		if (this.socket) this.socket.close();
	}

	createEnvironment() {

		const planeGeometry = new THREE.PlaneGeometry( 30, 30 );
		const planeMaterial = new THREE.MeshStandardMaterial( {color: 0xA0A0A0} );
		this.objects.environment.field = new THREE.Mesh(planeGeometry, planeMaterial);
		this.objects.environment.field.castShadow = true;
		this.objects.environment.field.receiveShadow = true;
		this.objects.environment.field.position.z -= 0.15; // minus ball radius
		this.scene.add(this.objects.environment.field);

		for (var i = 0; i < 4; i++)
		{
			//corners
			{
				const geometry = new THREE.BoxGeometry( 10, 10, 0.5 );
				const material = new THREE.MeshStandardMaterial ( {color: 0xf0f0f0});
				const corner = new THREE.Mesh(geometry, material);
				corner.position.set(CORNER_POSITION.X[i], CORNER_POSITION.Y[i], 0)
				this.objects.environment.corner.push(corner);
				this.scene.add(corner);
			}

			//walls
			{
				const geometry = new THREE.BoxGeometry( 10, 10, 0.5 );
				const material = new THREE.MeshStandardMaterial ( {color: 0xf0f0f0});
				const wall = new THREE.Mesh(geometry, material);
				wall.position.set(WALL_POSITION.X[i], WALL_POSITION.Y[i], -1)
				this.objects.environment.wall.push(wall);
				this.scene.add(wall);
			}
		}
	}
}



// registerCleanup('pong2d', () => {
// 	console.log("cleanup pong2d");
// 	renderer.dispose();
// 	scene.clear();
// 	webSocket.close();
// });

// registerInit('pong2d', () => {
// 	console.log('init pong2d');
// 	initGame();
// });



// MESH CREATORS ///////////////////////////////////////////////////////////////

function createSpotLight(position)
{
	const light = new THREE.SpotLight(0xffffff, 10, 0, Math.PI / 3, 0.5, 0.5);
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



function createBall() {
	const geometry = new THREE.SphereGeometry( BALL_RADIUS * 10, 32, 32 );
	const material = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.7, metalness: 0.5 });
	const sphere = new THREE.Mesh( geometry, material );

	sphere.castShadow = true;
	sphere.receiveShadow = true;

	return sphere;
}


function createPaddle(width, height, depth, color) {
	const geometry = new THREE.BoxGeometry(width, height, depth);
	// const material = new THREE.MeshStandardMaterial({color: color});
	const material = new THREE.MeshStandardMaterial({color: color, roughness: 0, metalness: 0});
	const paddle = new THREE.Mesh(geometry, material);
	paddle.position.z = -1;

	paddle.castShadow = true;
	paddle.receiveShadow = true;
	return paddle;
}
