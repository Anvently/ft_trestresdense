
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.168.0/build/three.module.js'
import { TextGeometry } from "https://cdn.jsdelivr.net/npm/three@0.168.0/examples/jsm/geometries/TextGeometry.js"
import { FontLoader } from "https://cdn.jsdelivr.net/npm/three@0.168.0/examples/jsm/loaders/FontLoader.js"

import { BaseView } from '../view-manager.js';
import { authenticatedUser, User, userManager } from '../home.js';
import { UserInfoManager } from '../user-infos-manager.js';


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
	// COLOR: [0x0000ff, 0xff0000, 0x00ff00, 0xffff00]
	COLOR: [0x0000ff, 0xff0000, 0x00ff00, 0xff00ff]
};

const CORNER_POSITION = {
	X: [-10, -10, 10, 10],
	Y: [-10, 10, -10, 10]
};

const WALL_POSITION = {
	X: [-10, 10, 0, 0],
	Y: [0, 0, 10, -10]
};

const SCORE_POSITION = [
	{X: -6.5, Y: 0},
	{X: 6.5, Y: 0},
	{X: 0, Y: 6.5},
	{X: 0, Y: -6.5},
];

export default class Pong2DView extends BaseView {
	constructor() {
		super("pong2d-view");

		this.start = false;
		this.socket = null;
		this.scene = null;
		this.camera = null;
		this.renderer = null;
		this.objects = {
			ball: null,
			paddle:[],
			paddleLight:[],
			scoreBoard:[
				{name: null, lives: null},
				{name: null, lives: null},
				{name: null, lives: null},
				{name: null, lives: null},
			],
			environment: {field: null, corner: [], wall: []}
		};

		this.players = [
			{type: "wall", lives: 0, x: 0, y: 0, width: 0, height: 0},
			{type: "wall", lives: 0, x: 0, y: 0, width: 0, height: 0},
			{type: "wall", lives: 0, x: 0, y: 0, width: 0, height: 0},
			{type: "wall", lives: 0, x: 0, y: 0, width: 0, height: 0}
		];
		this.ball = {x: 0, y: 0, r: 0, speedX: 0, speedY: 0, last_hit: -1};
		this.number_of_players;
		this.previous_score = [0, 0, 0, 0];
		this.username = authenticatedUser.username;
		this.pressKey = { key_up: false, key_down: false};
		this.intervalId;
		this.font = null;
	}

	async initView() {
		await this.initFont();
		this.createScene();
		this.initWebSocket();
		this.startGameLoop();
		this.setupInputListeners();
		this.setupResizeListener();
	}

	initWebSocket() {
		console.log("initWebSocket");
		const sockAdd = this.urlParams.get('id');
		if (sockAdd === undefined)
			window.location.hash = '#';
		this.socket = new WebSocket(`wss://${location.hostname}:8083/ws/pong/${sockAdd}/`);

		this.socket.onmessage = (e) => {
			const msg = JSON.parse(e.data);
			if (!msg["type"]) {
				return ;
			}
			if (msg["type"] == "ping") {
				this.socket.send(
					JSON.stringify({ type: "join_game", username: `${authenticatedUser.username}` })
				);
			} else if (msg["type"] === "send_game_state") {
				this.updateGameState(msg);
				this.draw3D();
			}
		};
	}

	async initFont() {
		const fontLoader = new FontLoader();

		// Return a promise to be awaited
		this.font = await new Promise((resolve, reject) => {
			fontLoader.load(
				'https://cdn.jsdelivr.net/npm/three@0.136.0/examples/fonts/droid/droid_sans_regular.typeface.json',
				(loadedFont) => {
					resolve(loadedFont); // Resolve the promise with the loaded font
				},
				undefined,
				(error) => reject(error) // Reject if there's an error
			);
		});
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

			this.objects.paddleLight.push(createPaddleLight(PADDLE_INIT.WIDTH[i],
				PADDLE_INIT.HEIGHT[i],
				0.5,
				PADDLE_INIT.COLOR[i]));
			this.scene.add(this.objects.paddleLight[i]);


			//ScoreBoard
				// names
	
				// lives


		}



	}

	updateGameState(msg) {
		this.number_of_players = parseInt(msg.number_of_players);
		this.ball.x = parseFloat(msg.ball_x);
		this.ball.y = parseFloat(msg.ball_y);
		this.ball.r = parseFloat(msg.ball_r);
		this.ball.speedX = parseFloat(msg.ball_speed_x);
		this.ball.speedY = parseFloat(msg.ball_speed_y);
		this.ball.last_hit = parseInt(msg.ball_last_hit);

		for (var i = 0; i < 4; i++) {
			this.players[i] = {
				type: msg[`player${i}_type`],
				lives: msg[`player${i}_lives`],
				x: msg[`player${i}_x`],
				y: msg[`player${i}_y`],
				width: msg[`player${i}_width`],
				height: msg[`player${i}_height`]
			};
		}


		// create scoreBoard only once game started (bit janky)

		if (this.start == false) {
			for (let i = 0; i < this.number_of_players; i++) {
				if (this.players[i].id == '')
					return;
				this.start = true;
				//create scoreBoard
				this.createScoreBoard();
			}
		}
	}



	createScoreBoard() {
		for (let i = 0; i < this.number_of_players; i++) {
				var geometry = new TextGeometry('', {
					font: this.font,
					size: 0.5,
					depth: 2,
					curveSegments: 12
				});

				// center the text
				geometry = centerTextGeometry(geometry);

				const material = new THREE.MeshBasicMaterial({ color: PADDLE_INIT.COLOR[i] });
				const mesh = new THREE.Mesh(geometry, material);
				// mesh.rotation.y = Math.PI /2;
				// mesh.rotation.z = Math.PI /2;

				// save the object
				this.objects.scoreBoard[i].lives = mesh;

				// mesh.position.set(0, -7, 0);
				console.log(SCORE_POSITION[i]);
				mesh.position.set(SCORE_POSITION[i].X, SCORE_POSITION[i].Y, 0);
				this.scene.add(mesh);
		}
	}

	// PUE LA MERDE CETTE FUNCTION WALLA
	updateScoreBoard() {
		for (let i = 0; i < this.number_of_players; i++) {
			const score = this.players[i].lives; // Access player score
			if (this.previous_score[i] != score) {
				const geometry = new TextGeometry(score.toString(), {
					font: this.font,
					size: 0.5,
					depth: 0,
					curveSegments: 12
				});
	
				const centeredGeometry = centerTextGeometry(geometry);
				const oldMesh = this.objects.scoreBoard[i].lives;
	
				// Clean up old geometry
				if (oldMesh.geometry) {
					oldMesh.geometry.dispose();
				}
	
				// Set new geometry
				oldMesh.geometry = centeredGeometry;
			}
		}
	}

	startGameLoop() {
		console.log("startGameLoop");
		this.intervalId = setInterval(() => {
			if (this.pressKey.key_up === true)
				this.socket.send(JSON.stringify({type: 'key_input', username:this.username,  input: "up" }));
			if (this.pressKey.key_down === true)
				this.socket.send(JSON.stringify({type: 'key_input', username:this.username,  input: "down" }));

			this.draw3D();
		}, 16);
	}

	draw3D()
	{
		// update ball position
		this.objects.ball.position.x = this.ball.x * 10;
		this.objects.ball.position.y = this.ball.y * 10;

		//update ball color
		var color = 0xffffff;
		if (this.ball.last_hit !== -1)
			color = PADDLE_INIT.COLOR[this.ball.last_hit];
		this.objects.ball.traverse((child) => {
			if (child.isMesh) {
				// Change the color of the material
				child.material.color.set(color);
			}
			// Optionally handle lights if you want to change their color
			else if (child.isLight) {
				// Change the color of the light (if applicable)
				child.color.set(color); // This would change the light color
			}
		});


		// update paddles position
		for (var dir = 0; dir < 4; dir++) {
			if (this.players[dir].type == "Player") {
				this.objects.paddle[dir].position.x = this.players[dir].x * 10;
				this.objects.paddle[dir].position.y = this.players[dir].y * 10;
				this.objects.paddle[dir].position.z = 0;
				this.objects.environment.wall[dir].position.z = -0.5

				this.objects.paddleLight[dir].position.x = this.players[dir].x * 10;
				this.objects.paddleLight[dir].position.y = this.players[dir].y * 10;
				this.objects.paddleLight[dir].position.z = 0.5;
			} else {
				this.objects.environment.wall[dir].position.z = 0
				this.objects.paddle[dir].position.z = -1;
				// this.objects.paddleLight[dir].position.z = -1;
			}
		}

		// update scoreBoard
		this.updateScoreBoard();

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
		this.renderer.setSize(newWidth * 0.9, newHeight * 0.9);
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
		const planeMaterial = new THREE.MeshStandardMaterial( {color: 0x666666, roughness: 0.7, metalness: 0.5 } );
		this.objects.environment.field = new THREE.Mesh(planeGeometry, planeMaterial);
		this.objects.environment.field.castShadow = true;
		this.objects.environment.field.receiveShadow = true;
		this.objects.environment.field.position.z -= 0.15; // minus ball radius
		this.scene.add(this.objects.environment.field);

		for (var i = 0; i < 4; i++) {
			//corners
			{
				const geometry = new THREE.BoxGeometry( 10, 10, 0.5 );
				const material = new THREE.MeshStandardMaterial ( { color: 0xf0f0f0});
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

function centerTextGeometry(geometry) {
	geometry.computeBoundingBox();
	const boundingBox = geometry.boundingBox;

	const xOffset = (boundingBox.max.x - boundingBox.min.x) / 2;
	const yOffset = (boundingBox.max.y - boundingBox.min.y) / 2;
	const zOffset = (boundingBox.max.z - boundingBox.min.z) / 2;

	geometry.translate(-xOffset, -yOffset, -zOffset);

	return geometry;
}

// MESH CREATORS ///////////////////////////////////////////////////////////////

function createSpotLight(position) {
	const light = new THREE.SpotLight(0xffffff, 0, 0, Math.PI / 3, 0.5, 0.5);
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
	const group = new THREE.Group();

	// create ball
	const geometry = new THREE.SphereGeometry( BALL_RADIUS * 10, 48, 48 );
	// const material = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.7, metalness: 0.5 });
	const material = new THREE.MeshBasicMaterial({ color: 0xff0000});
	const sphere = new THREE.Mesh( geometry, material );
	// sphere.castShadow = true;
	// sphere.receiveShadow = true;

	group.add(sphere);

	//create light
	const light = new THREE.PointLight( 0xffff00, 5, 0, 1 ); 
	light.position.z = BALL_RADIUS*10;
	group.add(light);
	return group;
}



function createPaddleLight(width, height, depth, color) {
	const pointLight = new THREE.PointLight( color, 10, 100, 1 );
	// pointLight.lookAt( 0, 0, 0 );
	return pointLight;
}

function createPaddle(width, height, depth, color) {
	const geometry = new THREE.BoxGeometry(width, height, depth);
	const material = new THREE.MeshStandardMaterial({color: color, roughness: 1, metalness: 0.2});
	// const material = new THREE.MeshStandardMaterial({color: color, roughness: 0, metalness: 0});
	const paddle = new THREE.Mesh(geometry, material);
	paddle.position.z = -1;

	paddle.castShadow = true;
	// paddle.receiveShadow = true;

	return paddle;
}
