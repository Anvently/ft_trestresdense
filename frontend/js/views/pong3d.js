
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.168.0/build/three.module.js'
import { TextGeometry } from "https://cdn.jsdelivr.net/npm/three@0.168.0/examples/jsm/geometries/TextGeometry.js"
import { FontLoader } from "https://cdn.jsdelivr.net/npm/three@0.168.0/examples/jsm/loaders/FontLoader.js"

import { BaseView } from '../view-manager.js';
import { authenticatedUser, User, userManager } from '../home.js';
import { UserInfoManager } from '../user-infos-manager.js';

// Constants
const TABLE_LENGTH = 9/5;
const BALL_RADIUS = 0.013;
const PADDLE_LENGTH = 0.1;
const PADDLE_THICKNESS = 0.01;
const REBOUND_LINE_X = 0.4;
const REBOUND_HEIGHT = 1;
const REBOUND_FAR_OUT = 10;

const PADDLE_MAX_X = [-0.8, 1.4]
const PADDLE_MIN_X = [-1.4, 0.8]
const PADDLE_MAX_Y = [1, 1,]
const PADDLE_MIN_Y = [-1, -1]
const PADDLE_LEFT_DIR = [-1, 1]
const PADDLE_COLOR = [0xf00000, 0x0000f0]

const PLAYER_SPEED = 0.012

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

const MAX_WIDTH = 1500; // in pixels

// SOUND
var ping_sound = new Audio("sound/ping_sound.mp3");
var pong_sound = new Audio("sound/pong_sound.mp3");

// Texture Loader
const textureLoader = new THREE.TextureLoader();

export default class Pong3DView extends BaseView {
	constructor() {
		super("pong3d-view");
		this.isSpectator = true;
		this.playerInfos = {};
		this.initialize();
	}

	initialize() {
		this.gameHasStarted = false;

		this.socket = null;
		this.username = authenticatedUser.username;
		this.scene = null;
		this.camera = null;
		this.renderer = null;
		this.objects = {
			ball: null,
			paddle:[],
			scoreBoard:[],
			environment: {room: null, table: null},
			nameTag:[null, null],
			winnerDisplay: null
		};

		this.previousScore = [0, 0];

		this.pressKey = {
			key_up: false,
			key_down: false,
			key_left: false,
			key_right: false
		};
		this.mousePosition = { x: 0, y: 0, toggle: false};

		this.players = [
			{points: 0, x: 0, y: 0, angle: 0, width: 0, height: 0, id: ''},
			{points: 0, x: 0, y: 0, angle: 0, width: 0, height: 0, id: ''}
		];
		this.ball = {x: 0.5, y: 0.5, r: 0, speed: {x: 0, y: 0}, last_hit: {x: 0, y: 0}};
		this.angle = 0; // spectator camera angle
		this.game_state;
		this.direction = -1;
		this.is_service = false;
		this.font = null;

		this.previous_hit_x = 0;
		this.sound_type = 1; // 1 is PONG, 0 is PING
		this.previousTimestamp = 0;

		this.animationId = undefined;
		this.eventListeners = [];

		this.spectator_camera_type = 0;
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
		const sockAdd = this.urlParams.get('id');
		if (!sockAdd) window.location.hash = '#';

		this.socket = new WebSocket(`wss://${location.hostname}:8083/ws/pong/${sockAdd}/`);

		// this.socket.onopen = () => console.log("WebSocket is now open");
		this.socket.onmessage = async (e) => this.handleWebSocketMessage(JSON.parse(e.data));
		this.socket.onerror = (error) => console.error('WebSocket error:', error);
		// this.socket.onclose = () => console.log('WebSocket is closed now.');
		this.connectionTimeout = setTimeout(() => {
			if (this.socket.readyState !== WebSocket.OPEN) {
			  console.error('WebSocket connection failed to open within 1 seconds');
			  // Display an error message to the user
			  this.errorHandler("Invalid lobby or invalid credentials.");
			  window.location.hash = '#';
			}
		  }, 1000);
	}

	async handleWebSocketMessage(msg) {
		if (!msg["type"]) return;
		if (msg["type"] == "ping")
			await this.sendJoinGame(msg);
		else if (msg["type"] === "cancel") {
			console.info("Game canceled");
			window.location.hash = '#';
			this.warningHandler(msg.message);
		}
		else if (msg["type"] === "send_game_state")
			await this.updateGameState(msg);
	}

	isGuestId(id) {
		if (id.includes(".") && id.indexOf(".") > 0)
			return true;
		return false;
	}

	async sendJoinGame(msg) {
		for (let i = 0; i < msg.player_list.length; i++) {
			if (msg.player_list[i] === authenticatedUser.username || msg.player_list[i].split('.')[0] === authenticatedUser.username) {
				if (this.isGuestId(msg.player_list[i])) this.isLocalMatch = true;
				this.isSpectator = false;
				this.socket.send(JSON.stringify({ type: "join_game", username: `${msg.player_list[i]}` }));
			}
			if (msg.player_list[i] !== '!wall') {
				if (msg.player_list[i][0] === '!') {
					this.playerInfos[msg.player_list[i]] = new User('!bot');
				} else {
					const user = new User(msg.player_list[i], await userManager.getUserInfo(msg.player_list[i], false, true));
					this.playerInfos[msg.player_list[i]] = user;
				}
			}
		}
	}

	async updateGameState(msg) {
		this.is_service = msg.is_service;
		this.ball.x = parseFloat(msg.ball_x);
		this.ball.y = parseFloat(msg.ball_y);
		this.ball.r = parseFloat(msg.ball_r);
		this.ball.speed.x = parseFloat(msg.ball_speed_x);
		this.ball.speed.y = parseFloat(msg.ball_speed_y);
		this.ball.last_hit.x = parseFloat(msg.ball_last_hit_x);
		this.ball.last_hit.y = parseFloat(msg.ball_last_hit_y);
		this.ball.is_out = msg.ball_is_out;
		this.game_state  = msg['game_state'];
		this.winner = msg.winner;

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

		if (this.gameHasStarted === false) {
			if(this.allPlayersPresent()) {
				await this.onGameStart();
			}
		}
	}

	allPlayersPresent() {
		return this.players[0].id != '' && this.players[1].id != '';
	}

	async onGameStart() {
		this.gameHasStarted = true;

		this.findPlayerDirection();
		this.createScoreBoards();
		this.displayControls();
		this.createNameTag();
		this.setupInputListeners();
		this.startGameLoop();
	}

	displayControls() {
		if (this.isSpectator) {
			document.getElementById('controls-spectator').classList.remove('d-none');
			document.getElementById('controls-player').classList.add('d-none');
		} else {
			document.getElementById('controls-player').classList.remove('d-none');
			document.getElementById('controls-spectator').classList.add('d-none');
		}
	}

	findPlayerDirection() {
		for (var i = 0; i < 2; i++) {
			if (this.players[i].id == this.username)
				this.direction = i;
		}
	}

	startGameLoop() {
		const loop = (timestamp) => {
			this.handleInput();
			this.draw3D();
			this.audio();
			trackFrequency()

			this.animationId = requestAnimationFrame(loop);
		};

		this.animationId = requestAnimationFrame(loop);
	}

	handleInput() {
		if (this.socket && this.socket.readyState === WebSocket.OPEN && this.direction != -1) {
			this.sendInput();
		}
		else if (this.game_state != 3 && this.direction != -1) {
			// console.log("Error: Socket is not open !");
			cancelAnimationFrame(this.animationId);
			return;
		}


	}

	sendInput() {
		// MOUSE

		// get paddle screen position
		let paddle_screen_pos = new THREE.Vector3();
		paddle_screen_pos = paddle_screen_pos.setFromMatrixPosition(this.objects.paddle[this.direction].matrixWorld);
		paddle_screen_pos.project(this.camera);

		let widthHalf = this.renderer.domElement.clientWidth / 2;
		let heightHalf = this.renderer.domElement.clientHeight / 2;

		paddle_screen_pos.x = (paddle_screen_pos.x * widthHalf) + widthHalf;
		paddle_screen_pos.y = - (paddle_screen_pos.y * heightHalf) + heightHalf;
		paddle_screen_pos.z = 0;

		// console.log(paddle_screen_pos);
		if (this.mousePosition.toggle) {
			if (this.mousePosition.x > paddle_screen_pos.x + PLAYER_SPEED * 1000)
				this.socket.send(JSON.stringify({type: 'key_input', username: this.username,  input: "right" }));
			else if (this.mousePosition.x < paddle_screen_pos.x - PLAYER_SPEED * 1000)
				this.socket.send(JSON.stringify({ type: 'key_input', username: this.username, input: "left" }));

			if (this.mousePosition.y > paddle_screen_pos.y + PLAYER_SPEED * 1000)
				this.socket.send(JSON.stringify({ type: 'key_input', username: this.username, input: "down" }));
			else if (this.mousePosition.y < paddle_screen_pos.y - PLAYER_SPEED * 1000)
				this.socket.send(JSON.stringify({type: 'key_input', username: this.username,  input: "up" }));
		}

		// OLD MOUSE CONTROLS
		// var player_rel_pos = {
		// 	x: (this.players[this.direction].x + 1.1) / 0.6,// - (PADDLE_MAX_X[this.direction] - PADDLE_MIN_X[this.direction]),
		// 	y: (this.players[this.direction].y * PADDLE_LEFT_DIR[this.direction]) / 2
		// }
		// if (this.mousePosition.toggle) {
		// 	if (this.mousePosition.x > player_rel_pos.x + PLAYER_SPEED)
		// 		this.socket.send(JSON.stringify({type: 'key_input', username: this.username,  input: "up" }));
		// 	else if (this.mousePosition.x < player_rel_pos.x - PLAYER_SPEED)
		// 		this.socket.send(JSON.stringify({ type: 'key_input', username: this.username, input: "down" }));

		// 	if (this.mousePosition.y > player_rel_pos.y + PLAYER_SPEED)
		// 		this.socket.send(JSON.stringify({type: 'key_input', username: this.username,  input: "right" }));
		// 	else if (this.mousePosition.y < player_rel_pos.y - PLAYER_SPEED)
		// 		this.socket.send(JSON.stringify({ type: 'key_input', username: this.username, input: "left" }));
		// }

		// KEYBOARD
		if (this.pressKey.key_up === true) {
			this.socket.send(JSON.stringify({type: 'key_input', username: this.username,  input: "up" }));
			this.mousePosition.toggle = false;
		}
		if (this.pressKey.key_down === true) {
			this.socket.send(JSON.stringify({type: 'key_input', username: this.username,  input: "down" }));
			this.mousePosition.toggle = false;
		}
		if (this.pressKey.key_left === true) {
			this.socket.send(JSON.stringify({type: 'key_input', username: this.username,  input: "left" }));
			this.mousePosition.toggle = false;
		}
		if (this.pressKey.key_right === true) {
			this.socket.send(JSON.stringify({type: 'key_input', username: this.username,  input: "right" }));
			this.mousePosition.toggle = false;
		}

	}

	draw3D() {
		this.updateCamera();

		this.updateBall();
		this.updatePaddles();
		this.updateNameTag();
		this.updateScoreBoard(); //need to update only when there is a goal

		if (this.game_state === 3) {
			this.drawGameOver();
		}

		this.renderer.render(this.scene, this.camera);
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
			this.objects.winnerDisplay.rotation.z = this.camera.rotation.z;
		}
	}

	async createGameOver() {
		const groupMesh = new THREE.Group();

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
			mesh.position.set(0, -2, 0);
			mesh.rotation.set(Math.PI /2, 0, 0)

			groupMesh.add(mesh);
		}


		let winner = (this.players[0].points > this.players[1].points) ? this.playerInfos[this.players[0].id].display_name : this.playerInfos[this.players[1].id].display_name;
		let winner_idx = (this.players[0].points > this.players[1].points) ? 0 : 1;

		var geometry = new TextGeometry(`${winner} won the game !`, {
			font: this.font,
			size: 2,
			depth: 0.5,
			curveSegments: 24
		});
		geometry = centerTextGeometry(geometry);
		const material = new THREE.MeshStandardMaterial({ color: PADDLE_COLOR[winner_idx] });
		const mesh = new THREE.Mesh(geometry, material);

		mesh.position.set(0, 0, 2);
		mesh.rotation.set(Math.PI /2, 0, 0)

		mesh.castShadow = true;
		mesh.receiveShadow = true;

		groupMesh.add(mesh);

		groupMesh.position.set(0, 0, 3)
		return groupMesh;
	}

	// updateBall() {
	// 	this.objects.ball.position.x = this.ball.x * 10;
	// 	this.objects.ball.position.y = this.ball.y * 10;
	// 	this.objects.ball.position.z = this.setBallHeight();
	// }

	// WITH LERP TO SMOOTH MVMENT
	updateBall() {
		const targetPosition = new THREE.Vector3(
			this.ball.x * 10,
			this.ball.y * 10,
			this.setBallHeight()
		);

		this.objects.ball.position.lerp(targetPosition, 0.8); // value is the lerp factor
	}

	// updatePaddles() {
	// 	this.objects.paddle.forEach((paddle, i) => {
	// 		paddle.position.x = this.players[i].x * 10;
	// 		paddle.position.y = this.players[i].y * 10;
	// 		this.setPaddleHeight(i);
	// 		paddle.rotation.z = this.players[i].angle + Math.PI / 2;
	// 	});
	// }

	// WITH LERP TO SMOOTH MVMENT
	updatePaddles() {
		this.objects.paddle.forEach((paddle, i) => {
			const targetPosition = new THREE.Vector3(
				this.players[i].x * 10,
				this.players[i].y * 10,
				paddle.position.z
			);

			paddle.position.lerp(targetPosition, 0.8); // Adjust lerp for speed
			paddle.rotation.z = this.players[i].angle + Math.PI / 2;
			this.setPaddleHeight(i);
		});
	}

	updateNameTag() {
		for (let i = 0; i < 2; i++) {
			if (this.objects.nameTag[i]) {
				this.objects.nameTag[i].position.x = this.objects.paddle[i].position.x;
				this.objects.nameTag[i].position.y = this.objects.paddle[i].position.y;
				this.objects.nameTag[i].position.z = this.objects.paddle[i].position.z + 1;
			}
		}
	}

	updateCamera() {
		if (this.direction == -1 || this.game_state == 3)
			this.spectatorCamera(this.spectator_camera_type)
		else
			this.POVCamera(this.direction)
	}

	spectatorCamera(camera_type) {
		const radius = 20;

		switch (camera_type % 5) {
			case 0:
				this.angle += 0.005;
				this.camera.position.x = radius * Math.cos(this.angle);
				this.camera.position.y = radius * Math.sin(this.angle);
				this.camera.position.z = 10;
				this.camera.lookAt(0, 0, -1);
				break;
			case 1:
				this.POVCamera(0);
				break;
			case 2:
				this.POVCamera(1);
				break;
			case 3:
				this.camera.position.x = 0;
				this.camera.position.y = -5;
				this.camera.position.z = 1;
				this.camera.lookAt(this.objects.ball.position);
				break;
			case 4:
				this.camera.position.x = 0;
				this.camera.position.y = 0;
				this.camera.position.z = 20;
				this.camera.rotation.set(0, 0, Math.PI)
				// this.camera.lookAt(this.objects.ball.position.x, this.objects.ball.position.y, this.objects.ball.position.z);
				// this.camera.lookAt(0, 0, 0);
			default:
				break;
		}


	}

	POVCamera(direction) {
		// calculate camera destination
		var camera_destination = {x: 0, y: 0, z: 0}

		var radius = 12;
		var camera_angle = 0;
		var player_angle = this.players[direction].angle;
		var middle_angle = 0

		if (direction == WEST)
			middle_angle = Math.PI
		else if (direction == EAST)
			player_angle += Math.PI;

		radius = Math.abs(this.players[direction].x**2 + this.players[direction].y**2) * 5 + 10
		player_angle = normalizeAngle(player_angle);
		camera_angle = middle_angle + player_angle / 1; // 2 for half angle

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

		this.camera.lookAt(0, 0, -1);
	}

	updateScoreBoard() {
		for (let i = 0; i < 2; i++) {
			var score = this.players[i].points;
			if (score != this.previousScore[i]) {
				const geometry = new TextGeometry(score.toString(), {
					font: this.font,
					size: 1.5,
					depth: 0.05,
					curveSegments: 12,
				});
			this.objects.scoreBoard[i].geometry.dispose(); // Clean up old geometry
			this.objects.scoreBoard[i].geometry = geometry; // Set new geometry
			}
		}
	}

	audio() {
		if (this.sound_type == 0) { // PING when ball hit the table
			if ((this.ball.speed.x > 0 && this.ball.x  > REBOUND_LINE_X) // ball is going EAST
				|| this.ball.speed.x < 0 && this.ball.x < -REBOUND_LINE_X) {
				if (!this.ball.is_out) {
					ping_sound.play();
				}
				this.sound_type = !this.sound_type
			}
		} else { // PONG when ball hit the paddle
			if (this.previous_hit_x != this.ball.last_hit.x) {
				this.previous_hit_x = this.ball.last_hit.x
				pong_sound.play();
				this.sound_type = !this.sound_type
			}
		}
	}

	setupResizeListener() {
		const resizeListener = () => this.resize();
		window.addEventListener('resize', resizeListener);
		this.eventListeners.push({ type: 'resize', listener: resizeListener });
	}

	setupInputListeners() {
		const keydownListener = (e) => this.handleKeyDown(e);
		window.addEventListener("keydown", keydownListener);
		this.eventListeners.push( {type: 'keydown', listener: keydownListener});

		const keyupListener = (e) => this.handleKeyUp(e);
		window.addEventListener("keyup", keyupListener);
		this.eventListeners.push( {type: 'keyup', listener: keyupListener });

		// Mouse input listener
		const mouseMoveListener = (e) => this.handleMouseMove(e);
		window.addEventListener("mousemove", mouseMoveListener);
		this.eventListeners.push( {type: 'mousemove', listener: mouseMoveListener});
	}

	handleMouseMove(event) {
		// this.mousePosition.x = (event.clientY / window.innerHeight - 0.5) * -1.5;
		// this.mousePosition.y = (event.clientX / window.innerWidth - 0.5) * 1.5;


		const rect =  this.renderer.domElement.getBoundingClientRect();
		this.mousePosition.x = event.clientX - rect.left;
		this.mousePosition.y = event.clientY - rect.top;
		this.mousePosition.toggle = true;
	}

	resize() {
		const ratio = 4/3;
		const resolutionScale = 1;

		var newWidth = window.innerWidth;
		var newHeight = window.innerWidth * 3/4;
		if ((window.innerHeight) < window.innerWidth * 3/4) {
			newWidth = window.innerHeight * 4/3;
			newHeight = window.innerHeight;
		}
		// check max size
		if (newWidth > MAX_WIDTH) {
			newWidth = MAX_WIDTH
			newHeight = MAX_WIDTH * 3/4;
		}

		this.renderer.setSize(newWidth * resolutionScale, newHeight * resolutionScale);
		this.renderer.domElement.style.width = `${newWidth * 0.85}px`;
		this.renderer.domElement.style.height = `${newHeight * 0.85}px`;
	}

	handleKeyDown(e) {
		if (e.key === "ArrowUp") this.pressKey.key_up = true;
		else if (e.key === "ArrowDown") this.pressKey.key_down = true;
		else if (e.key === "ArrowLeft") this.pressKey.key_left = true;
		else if (e.key === "ArrowRight") this.pressKey.key_right = true;

		if (this.isSpectator) {
			console.log("IS SPECTATOR")
			if (e.key === ' ') {
				this.spectator_camera_type += 1
				console.log("Spectator camera type = ", this.spectator_camera_type);
			}
		}
	}

	handleKeyUp(e) {
		if (e.key === "ArrowUp") this.pressKey.key_up = false;
		else if (e.key === "ArrowDown") this.pressKey.key_down = false;
		else if (e.key === "ArrowLeft") this.pressKey.key_left = false;
		else if (e.key === "ArrowRight") this.pressKey.key_right = false;
	}

	cleanupView() {
		if (this.animationId) cancelAnimationFrame(this.animationId);
		if (this.socket) this.socket.close();
		this.cleanupListeners();
		clearTimeout(this.connectionTimeout);
	}

	cleanupListeners() {
		for (const { type, listener } of this.eventListeners) {
			window.removeEventListener(type, listener);
		}
		this.eventListeners = []; // Clear the array after removing
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

	createScene() {
		this.scene = new THREE.Scene();

		this.createCamera();
		this.createRenderer();
		this.createEnvironment();
		this.createLights();
		this.createBall();
		this.createPaddles();

		this.resize();
	}

	createCamera() {
		this.camera = new THREE.PerspectiveCamera( 60, 4/3, 0.1, 100);
		this.camera.up.set(0, 0, 1); // Set Z as the up direction
		this.camera.position.set(0, 0, 1);
	}

	createRenderer() {
		this.renderer = new THREE.WebGLRenderer({ antialias: true });
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		document.getElementById('container-canva').appendChild(this.renderer.domElement);
	}

	createEnvironment() {
		this.objects.environment.room = createRoom();
		this.scene.add(this.objects.environment.room);

		this.objects.environment.table = createTable();
		this.scene.add(this.objects.environment.table);
	}

	createLights() {
		this.scene.add(createSpotLight({x: -5, y: 2, z: 15}));
		this.scene.add(createSpotLight({x: 7, y: -10, z: 5}));

		const ambientLight = new THREE.AmbientLight( 0x404040 , 6);
		this.scene.add( ambientLight );
	}

	createBall() {
		this.objects.ball = createBall();
		this.scene.add(this.objects.ball);
	}

	createPaddles() {
		this.objects.paddle.push(createPaddle(PADDLE_COLOR[0])); // West paddle
		this.objects.paddle.push(createPaddle(PADDLE_COLOR[1])); // East paddle
		this.objects.paddle.forEach(paddle => this.scene.add(paddle))
	}

	createNameTag() {
		for (let i = 0; i < 2; i++) {
			if (this.direction != i) {
				var id = this.players[i].id;
				const sprite = createTextSprite(this.playerInfos[id].display_name, 'white', 1);
				this.objects.nameTag[i] = sprite;
				this.scene.add(sprite);
			}
		}
	}

	createScoreBoards()
	{
		this.objects.scoreBoard.push(this.createScoreBoard(0xf00000, WEST));
		this.objects.scoreBoard.push(this.createScoreBoard(0x0000f0, EAST));
		this.objects.scoreBoard.forEach(scoreBoard => this.scene.add(scoreBoard))
	}

	createScoreBoard(color, side)
	{
		const geometry = new TextGeometry('0', {
			font: this.font,
			size: 1.5,
			depth: 0.05,
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
}

function createTextSprite(message, color, size) {
	const fontSize = 20;

	const tempCanvas = document.createElement('canvas');
	const tempContext = tempCanvas.getContext('2d');
	tempContext.font = `${fontSize}px Arial`;
	const textWidth = tempContext.measureText(message).width;

	const canvas = document.createElement('canvas');
	canvas.width = textWidth;
	canvas.height = fontSize * 1.2;

	const context = canvas.getContext('2d');
	context.font = `${fontSize}px Arial`;
	context.fillStyle = color;

	context.clearRect(0, 0, canvas.width, canvas.height);

	const xPosition = (canvas.width - textWidth) / 2; // Center the text
	context.fillText(message, xPosition, fontSize) ; // Draw the text

	const texture = new THREE.Texture(canvas);
	texture.needsUpdate = true;

	const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
	const sprite = new THREE.Sprite(spriteMaterial);

	sprite.scale.set((textWidth / fontSize) * size, size, size)

	return sprite;
}

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
	light.lookAt(0, 0, 0)
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

let callCount = 0;
let lastTimestamp = performance.now();

function trackFrequency() {
	callCount++;
	const currentTime = performance.now();
	const elapsedTime = currentTime - lastTimestamp;

	// Check if one second has passed
	if (elapsedTime >= 1000) {
		console.log(`TrackFrequency : ${callCount} times in the last second`);
		callCount = 0; // Reset call count
		lastTimestamp = currentTime; // Reset the timestamp
	}
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
