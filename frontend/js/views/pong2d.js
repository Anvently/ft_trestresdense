import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.168.0/build/three.module.js'
import { TextGeometry } from "https://cdn.jsdelivr.net/npm/three@0.168.0/examples/jsm/geometries/TextGeometry.js"
import { FontLoader } from "https://cdn.jsdelivr.net/npm/three@0.168.0/examples/jsm/loaders/FontLoader.js"

import { BaseView } from '../view-manager.js';
import { authenticatedUser, User, userManager } from '../home.js';


// TODO
//	- Revoir les event listeners ( 1 seul pour keyup, 1 seul pour keydown )
//	- afficher pseudo et/ou avatar
//	- ameliorer les controles souris (mieux centrer le curseur sur le paddle, ou cacher le curseur)
// - TOUJOURS CRASH DE CHECK IMPACT MACHIN TRUC

// Constants
const DIRECTIONS = {
	WEST: 0,
	EAST: 1,
	NORTH: 2,
	SOUTH: 3
}

const PADDLE_LENGTH = 0.16
const PADDLE_THICKNESS = 0.05;
const BALL_RADIUS = 0.015
const PLAYER_SPEED = 0.016

const PADDLE_INIT = {
	WIDTH: [PADDLE_THICKNESS * 10, PADDLE_THICKNESS * 10, PADDLE_LENGTH * 10, PADDLE_LENGTH * 10],
	HEIGHT: [PADDLE_LENGTH * 10, PADDLE_LENGTH * 10, PADDLE_THICKNESS * 10, PADDLE_THICKNESS * 10],
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

// CONTROLS[player][direction]
const CONTROLS = [
	[
		{up: "w", down: "s"},
		{up: "w", down: "s"},
		{up: "a", down: "d"},
		{up: "a", down: "d"}
	],
	[
		{up: "ArrowUp", down: "ArrowDown"},
		{up: "ArrowUp", down: "ArrowDown"},
		{up: "ArrowLeft", down: "ArrowRight"},
		{up: "ArrowLeft", down: "ArrowRight"}
	]
]

export default class Pong2DView extends BaseView {
	constructor() {
		super("pong2d-view");
		this.initialize();
	}

	initialize() {
		this.gameHasStarted = false;
		this.socket = null;
		this.isLocalMatch = false;
		this.players = [
			{type: "wall", lives: 0, x: 0, y: 0, width: 0, height: 0, id: ''},
			{type: "wall", lives: 0, x: 0, y: 0, width: 0, height: 0, id: ''},
			{type: "wall", lives: 0, x: 0, y: 0, width: 0, height: 0, id: ''},
			{type: "wall", lives: 0, x: 0, y: 0, width: 0, height: 0, id: ''}
		];
		this.ball = {x: 0, y: 0, r: 0, speedX: 0, speedY: 0, last_hit: -1};
		this.username = authenticatedUser.username;
		this.direction = -1;
		this.pressKey = [
			{ key_up: false, key_down: false },
			{ key_up: false, key_down: false }
		];
		this.mousePosition = null;
		this.previousTimestamp = 0;
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
			environment: {field: null, corner: [], wall: []},
			winnerDisplay: null
		};
		this.font = null;

		this.playerInfos = [];
		this.scene = null;
		this.camera = null;
		this.renderer = null;
		this.number_of_players;
		this.game_state;
		this.previous_score = [0, 0, 0, 0];
		
		this.animationId = undefined;
		this.eventListeners = [];
	}


	async initView() {
		await this.loadFont();
		this.createScene();
		this.initWebSocket();
		this.setupResizeListener();
	}

	async loadFont() {
		const fontLoader = new FontLoader();
		this.font = await new Promise((resolve, reject) => {
			fontLoader.load(
				'https://cdn.jsdelivr.net/npm/three@0.136.0/examples/fonts/droid/droid_sans_regular.typeface.json',
				resolve,
				undefined,
				reject
			);
		});
	}

	initWebSocket() {
		console.log("initWebSocket");
		const sockAdd = this.urlParams.get('id');
		if (!sockAdd) window.location.hash = '#';

		this.socket = new WebSocket(`wss://${location.hostname}:8083/ws/pong/${sockAdd}/`);

		this.socket.onopen = () => {
			console.log("WebSocket is now open");
			// this.startGameLoop();
		}

		this.socket.onmessage = (e) => this.handleWebSocketMessage(JSON.parse(e.data));
		this.socket.onerror = (error) => console.error('WebSocket error:', error);
		this.socket.onclose = () => console.log('WebSocket is closed now.');
	}

	handleWebSocketMessage(msg) {
		if (!msg["type"]) return;
		if (msg["type"] == "ping")
			this.socket.send(JSON.stringify({ type: "join_game", username: `${authenticatedUser.username}` }));
		else if (msg["type"] === "send_game_state")
			this.updateGameState(msg);
	}

	updateGameState(msg) {
		this.number_of_players = parseInt(msg.number_of_players);
		this.ball.x = parseFloat(msg.ball_x);
		this.ball.y = parseFloat(msg.ball_y);
		this.ball.r = parseFloat(msg.ball_r);
		this.ball.speedX = parseFloat(msg.ball_speed_x);
		this.ball.speedY = parseFloat(msg.ball_speed_y);
		this.ball.last_hit = parseInt(msg.ball_last_hit);
		this.game_state  = msg['game_state'];

		for (var i = 0; i < 4; i++) {
			this.players[i] = {
				id: msg[`player${i}_id`],
				type: msg[`player${i}_type`],
				lives: msg[`player${i}_lives`],
				x: msg[`player${i}_x`],
				y: msg[`player${i}_y`],
				width: msg[`player${i}_width`],
				height: msg[`player${i}_height`]
			};
		}

		if (this.gameHasStarted === false) {
			if (this.allPlayersPresent()) {
				this.gameHasStarted = true;
				this.onGameStart();
			}
		}
	}

	allPlayersPresent() {
		for (let i = 0; i < this.number_of_players; i++) {
			if (this.players[i].id == '')
				return false;
		}
		return true;
	}

	onGameStart() {
		console.log("onGameStart");
		this.createScoreBoard();
		this.isLocalMatch = this.checkIfLocalMatch();
		this.findPlayerDirection();
		this.setupInputListeners();
		this.startGameLoop();
	}

	findPlayerDirection() {
		for (let i = 0; i < this.number_of_players; i++) {
			if (this.username == this.players[i].id)
				this.direction = i;
		}
	}

	checkIfLocalMatch() {
		for (let i = 0; i < this.number_of_players; i++) {
			if (this.isGuestId(this.players[i].id)) {
				return true;
			}
		}
		return false;
	}

	isGuestId(id) {
		if (id.includes(".") && id.indexOf(".") > 0)
			return true;
		return false;
	}

	startGameLoop() {
		console.log("startGameLoop");
		const loop = (timestamp) => {
			if (this.previousTimestamp !== 0) { // ?
				const deltaTime = timestamp - this.previousTimestamp; // ?
				this.handleInput();
				this.draw3D();
			}

			this.previousTimestamp = timestamp; // ?
			trackFrequency();

			this.animationId = requestAnimationFrame(loop);
		};
		this.animationId = requestAnimationFrame(loop);
	}

	handleInput() {
		if (this.socket && this.socket.readyState === WebSocket.OPEN) {
			this.sendInput();
		}
		else if (this.game_state != 3) {
			console.log("Error: Socket is not open !");
			cancelAnimationFrame(this.animationId);
			return;
		}
	}

	sendInput() {		
		// if localMatch
		if (this.isLocalMatch) {
			if (this.pressKey[0].key_up === true)
				this.socket.send(JSON.stringify({ type: 'key_input', username: this.players[0].id, input: "up" }));
			if (this.pressKey[0].key_down === true)
				this.socket.send(JSON.stringify({ type: 'key_input', username: this.players[0].id, input: "down" }));
			if (this.pressKey[1].key_up === true)
				this.socket.send(JSON.stringify({ type: 'key_input', username: this.players[1].id, input: "up" }));
			if (this.pressKey[1].key_down === true)
				this.socket.send(JSON.stringify({ type: 'key_input', username: this.players[1].id, input: "down" }));
		} else {
			// Mouse control
			var player_position;
			console.log("this.direction = ", this.direction);
			if (this.direction == DIRECTIONS.EAST || this.direction == DIRECTIONS.WEST)
				player_position = this.players[this.direction].y;
			else
				player_position = -this.players[this.direction].x;

			console.log("player_position = ", player_position);
			console.log("mouse pose = ", this.mousePosition);


			if (this.mousePosition) {
				if (this.mousePosition > player_position + PLAYER_SPEED)
					this.socket.send(JSON.stringify({ type: 'key_input', username: this.username, input: "up" }));
				else if (this.mousePosition < player_position - PLAYER_SPEED)
					this.socket.send(JSON.stringify({ type: 'key_input', username: this.username, input: "down" }));
			}
			if (this.pressKey[1].key_up === true) {
				this.socket.send(JSON.stringify({ type: 'key_input', username: this.username, input: "up" }));
				this.mousePosition = null;
			}
			if (this.pressKey[1].key_down === true) {
				this.socket.send(JSON.stringify({ type: 'key_input', username: this.username, input: "down" }));
				this.mousePosition = null;
			}
		}
	}

	async createGameOver() {
		{
			var geometry = new TextGeometry(`[press SPACE to continue]`, {
				font: this.font,
				size: 0.5,
				depth: 0,
				curveSegments: 24
			});
			geometry = centerTextGeometry(geometry);
			const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
			const mesh = new THREE.Mesh(geometry, material);
			mesh.position.set(0, -2, 1);

			this.scene.add(mesh);
		}

		var winner = 'AI';
		var winner_idx = 0;
		for (winner_idx = 0; winner_idx < this.number_of_players; winner_idx++) {
			if (this.players[winner_idx].lives != 0) {
				var userInfo = await userManager.getUserInfo(this.players[winner_idx].id);
				console.log(userInfo);
				if (userInfo && userInfo.display_name)
					winner = userInfo.display_name;
				break;
			}
		}
		var geometry = new TextGeometry(`${winner} won the game !`, {
			font: this.font,
			size: 2,
			depth: 0.5,
			curveSegments: 24
		});
		geometry = centerTextGeometry(geometry);
		const material = new THREE.MeshStandardMaterial({ color: PADDLE_INIT.COLOR[winner_idx] });
		const mesh = new THREE.Mesh(geometry, material);

		mesh.position.set(20, 0.5, 2);

		mesh.castShadow = true;
		mesh.receiveShadow = true;
		return mesh;
	}

	setupResizeListener() {
		const resizeListener = () => this.resize();
		window.addEventListener('resize', resizeListener);
		this.eventListeners.push({ type: 'resize', listener: resizeListener });
	}

	setupInputListeners() {
		console.log("setupInputListeners");

		if (this.isLocalMatch) {
			console.log("-> is localMatch");
			if (this.isGuestId(this.players[DIRECTIONS.WEST].id)) {
				const keydownListener = (e) => this.handleKeyDown(e, 0, DIRECTIONS.WEST);
				window.addEventListener("keydown", keydownListener);
				this.eventListeners.push({ type: 'keydown', listener: keydownListener });
			
				const keyupListener = (e) => this.handleKeyUp(e, 0, DIRECTIONS.WEST);
				window.addEventListener("keyup", keyupListener);
				this.eventListeners.push({ type: 'keyup', listener: keyupListener });
			}
			
			if (this.isGuestId(this.players[DIRECTIONS.EAST].id)) {
				const keydownListener = (e) => this.handleKeyDown(e, 1, DIRECTIONS.EAST);
				window.addEventListener("keydown", keydownListener);
				this.eventListeners.push({ type: 'keydown', listener: keydownListener });
			
				const keyupListener = (e) => this.handleKeyUp(e, 1, DIRECTIONS.EAST);
				window.addEventListener("keyup", keyupListener);
				this.eventListeners.push({ type: 'keyup', listener: keyupListener });
			}
		} else {
			const keydownListener = (e) => this.handleKeyDown(e, 1, this.direction);
			window.addEventListener("keydown", keydownListener);
			this.eventListeners.push({ type: 'keydown', listener: keydownListener });
		
			const keyupListener = (e) => this.handleKeyUp(e, 1, this.direction);
			window.addEventListener("keyup", keyupListener);
			this.eventListeners.push({ type: 'keyup', listener: keyupListener });
		
			// MOUSE MOVEMENT TEST
			const mouseMoveListener = (e) => this.handleMouseMove(e);
			window.addEventListener("mousemove", mouseMoveListener);
			this.eventListeners.push( {type: 'mousemove', listener: mouseMoveListener});
		
		}
	}

	handleMouseMove(event) {
		if (this.direction == DIRECTIONS.WEST || this.direction == DIRECTIONS.EAST)
			this.mousePosition = (event.clientY / window.innerHeight - 0.5) * -1.5;
		else
			this.mousePosition = (event.clientX / window.innerWidth - 0.5) * -1.5;

	}

	// setupInputListeners() {
	// 	console.log("setupInputListeners");

	// 	if (this.isLocalMatch) {
	// 		console.log("-> is localMatch");
	// 		if (this.isGuestId(this.players[DIRECTIONS.WEST].id)) {
	// 			window.addEventListener("keydown", (e) => this.handleKeyDown(e, 0, DIRECTIONS.WEST));
	// 			window.addEventListener("keyup", (e) => this.handleKeyUp(e, 0, DIRECTIONS.WEST));
	// 		}
	// 		if (this.isGuestId(this.players[DIRECTIONS.EAST].id)) {
	// 			window.addEventListener("keydown", (e) => this.handleKeyDown(e, 1, DIRECTIONS.EAST));
	// 			window.addEventListener("keyup", (e) => this.handleKeyUp(e, 1, DIRECTIONS.EAST));
	// 		}
	// 	} else {
	// 		// find player direction
	// 		console.log("-> is not localMatch");
	// 		let direction = 0;
	// 		for (let i = 0; i < 4; i++) {
	// 			if (this.username === this.players[i].id) {
	// 				direction = i;
	// 				break;
	// 			}
	// 		}
	// 		console.log("direction is = ", direction);
	// 		console.log("Key Down:", CONTROLS[1][direction].down);
	// 		console.log("Key Up:", CONTROLS[1][direction].up);
	// 		window.addEventListener("keydown", (e) => this.handleKeyDown(e, 1, direction));
	// 		window.addEventListener("keyup", (e) => this.handleKeyUp(e, 1, direction));
	// 	}
	// }

	handleKeyDown(e, player, direction) {
		console.log("handleKeyDown");
		if (e.key === CONTROLS[player][direction].up) this.pressKey[player].key_up = true;
		else if (e.key === CONTROLS[player][direction].down) this.pressKey[player].key_down = true;
	}

	handleKeyUp(e, player, direction) {
		console.log("handleKeyUp");
		if (e.key === CONTROLS[player][direction].up) this.pressKey[player].key_up = false;
		else if (e.key === CONTROLS[player][direction].down) this.pressKey[player].key_down = false;
	}

	resize() {
		var newWidth = window.innerWidth;
		var newHeight = window.innerWidth;
		if (window.innerHeight < window.innerWidth) {
			newWidth = window.innerHeight;
			newHeight = window.innerHeight;
		}

		newWidth *= 0.9;
		newHeight *= 0.9;

		var pixelRatio = 1;
		if (newWidth > 400) {
			pixelRatio = 400 / newWidth;
		}
		this.renderer.setPixelRatio( window.devicePixelRatio * pixelRatio);
		console.log("pixelRatio = " + this.renderer.getPixelRatio());
		this.renderer.setSize(newWidth, newHeight);
	}


	draw3D()
	{
		this.updateBall();
		this.updatePaddles();
		this.updateScoreBoard();
		if (this.game_state === 3)
			this.drawGameOver();

		this.renderer.render(this.scene, this.camera);
	}

	updateBall() {
		// update ball position
		this.objects.ball.position.x = this.ball.x * 10;
		this.objects.ball.position.y = this.ball.y * 10;

		//update ball color
		var color = 0xffffff;
		if (this.ball.last_hit !== -1)
			color = PADDLE_INIT.COLOR[this.ball.last_hit];
		this.objects.ball.traverse((child) => {
			if (child.isMesh) {
				child.material.color.set(color);
			} else if (child.isLight) {
				child.color.set(color);
			}
		});
	}

	updatePaddles() {
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
				this.objects.paddleLight[dir].position.z = -1;
			}
		}
	}

	createScoreBoard() {
		for (let i = 0; i < this.number_of_players; i++) {
				var geometry = new TextGeometry('', {
					font: this.font,
					size: 0.75,
					depth: 0,
					curveSegments: 24
				});

				geometry = centerTextGeometry(geometry);
				const material = new THREE.MeshBasicMaterial({ color: PADDLE_INIT.COLOR[i] });
				const mesh = new THREE.Mesh(geometry, material);

				this.objects.scoreBoard[i].lives = mesh;
				mesh.position.set(SCORE_POSITION[i].X, SCORE_POSITION[i].Y, 0);
				this.scene.add(mesh);
		}
	}

	updateScoreBoard() {
		for (let i = 0; i < this.number_of_players; i++) {
			const score = this.players[i].lives;
			if (this.previous_score[i] !== score) {
				console.log("updateScoreBoard");
				const geometry = new TextGeometry(score.toString(), {
					font: this.font,
					size: 0.75,
					depth: 0,
					curveSegments: 24
				});
				const centeredGeometry = centerTextGeometry(geometry);
				const oldMesh = this.objects.scoreBoard[i].lives;
				if (oldMesh.geometry) {
					oldMesh.geometry.dispose();
				}
				oldMesh.geometry = centeredGeometry;
				this.previous_score[i] = score;
			}
		}
	}

	async drawGameOver() {
		if (this.objects.winnerDisplay == null) {
			const winnerDisplay = await this.createGameOver();

			const  returnToIndex = (event) => {
				if (event.code === 'Space') {
					window.removeEventListener('keydown', returnToIndex);
					window.location.href = '#';
				}
			}

			window.addEventListener('keydown', returnToIndex);
			this.eventListeners.push( {type: 'keydown', returnToIndex} );

			this.objects.winnerDisplay = winnerDisplay;
			this.scene.add(this.objects.winnerDisplay);
		} else {
			if (this.objects.winnerDisplay.position.x < -20)
				this.objects.winnerDisplay.position.x = 20;
			this.objects.winnerDisplay.position.x -= 0.1;
		}
	}

	cleanupView() {
		console.log("Cleaning view");
		if (this.animationId) cancelAnimationFrame(this.animationId);
		if (this.socket) this.socket.close();
		this.cleanupListeners();
	}

	cleanupListeners() {
		for (const { type, listener } of this.eventListeners) {
			console.log("type: " + type + ", listener: " + listener + " removed;")
			window.removeEventListener(type, listener);
		}
		this.eventListeners = []; // Clear the array after removing
	}

////// CREATE SCENE ////////////////////////////////////////////////////////////
	createScene() {
		this.scene = new THREE.Scene();
		this.createCamera();
		this.createRenderer();
		this.createEnvironment(this.scene);
		this.createBall();
		this.createPaddles();

		this.resize();
	}

	createCamera() {
		this.camera = new THREE.PerspectiveCamera( 75, 1, 0.1, 1000);
		this.camera.position.z = 10;
		this.camera.lookAt(0, 0, 0);
	}

	createRenderer() {
		this.renderer = new THREE.WebGLRenderer();
		this.renderer.setSize(1200, 1200);
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		document.getElementById('container-canva').appendChild(this.renderer.domElement);
	}

	createEnvironment() {
		const planeGeometry = new THREE.PlaneGeometry( 30, 30 );
		const planeMaterial = new THREE.MeshStandardMaterial( {color: 0x666666, roughness: 0.7, metalness: 0.5 } );
		this.objects.environment.field = new THREE.Mesh(planeGeometry, planeMaterial);
		this.objects.environment.field.castShadow = true;
		this.objects.environment.field.receiveShadow = true;
		this.objects.environment.field.position.z -= 0.15; // minus ball radius
		this.scene.add(this.objects.environment.field);

		this.scene.add(createSpotLight({x: 0, y: 0, z: 5})); // light

		for (var i = 0; i < 4; i++) {
			//corners
			{
				const geometry = new THREE.BoxGeometry( 10, 10, 0.5 );
				const material = new THREE.MeshStandardMaterial ( { color: 0xffffff});
				const corner = new THREE.Mesh(geometry, material);
				corner.position.set(CORNER_POSITION.X[i], CORNER_POSITION.Y[i], 0)
				this.objects.environment.corner.push(corner);
				this.scene.add(corner);
			}

			//walls
			{
				const geometry = new THREE.BoxGeometry( 10, 10, 0.5 );
				const material = new THREE.MeshStandardMaterial ( {color: 0xffffff});
				const wall = new THREE.Mesh(geometry, material);
				wall.position.set(WALL_POSITION.X[i], WALL_POSITION.Y[i], -1)
				this.objects.environment.wall.push(wall);
				this.scene.add(wall);
			}
		}
	}

	createBall() {
		const group = new THREE.Group();
	
		// create ball
		const geometry = new THREE.SphereGeometry( BALL_RADIUS * 10, 48, 48 );
		const material = new THREE.MeshBasicMaterial({ color: 0xff0000});
		const sphere = new THREE.Mesh( geometry, material );
		group.add(sphere);
	
		//create light
		const light = new THREE.PointLight( 0xffff00, 5, 0, 1 ); 
		light.position.z = BALL_RADIUS*10;
		group.add(light);

		this.objects.ball = group;
		this.scene.add(this.objects.ball);
	}

	createPaddles() {
		for (let i = 0; i < 4; i++) {
			this.objects.paddle.push(createPaddle(PADDLE_INIT.WIDTH[i],
												PADDLE_INIT.HEIGHT[i],
												0.5,
												PADDLE_INIT.COLOR[i]));
			this.scene.add(this.objects.paddle[i]);
			this.objects.paddleLight.push(createPaddleLight(PADDLE_INIT.COLOR[i]));
			this.scene.add(this.objects.paddleLight[i]);
		}
	}

////////////////////////////////////////////////////////////////////////////////



}

function centerTextGeometry(geometry) {
	geometry.computeBoundingBox();
	const boundingBox = geometry.boundingBox;

	const xOffset = (boundingBox.max.x - boundingBox.min.x) / 2;
	const yOffset = (boundingBox.max.y - boundingBox.min.y) / 2;
	const zOffset = (boundingBox.max.z - boundingBox.min.z) / 2;

	geometry.translate(-xOffset, -yOffset, -zOffset);

	return geometry;
}

function createSpotLight(position) {
	const light = new THREE.SpotLight(0xffffff, 3, 0, Math.PI / 3, 0.5, 0.5);
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

function createPaddleLight(color) {
	const pointLight = new THREE.PointLight( color, 10, 100, 1 );
	return pointLight;
}

function createPaddle(width, height, depth, color) {
	const geometry = new THREE.BoxGeometry(width, height, depth);
	const material = new THREE.MeshStandardMaterial({color: color, roughness: 1, metalness: 0.2});
	const paddle = new THREE.Mesh(geometry, material);
	paddle.position.z = -1;

	paddle.castShadow = true;
	// paddle.receiveShadow = true;

	return paddle;
}

var callCount = 0;
var lastTimestamp = 0;

function trackFrequency() {
	callCount++;
	const currentTime = performance.now();
	const elapsedTime = currentTime - lastTimestamp;

	// Check if one second has passed
	if (elapsedTime >= 1000) {
		console.log(`Function called ${callCount} times in the last second`);
		callCount = 0; // Reset call count
		lastTimestamp = currentTime; // Reset the timestamp
	}
}