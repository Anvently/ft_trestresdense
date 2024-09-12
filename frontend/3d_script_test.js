// https://threejs.org/docs/#manual/en/introduction/Creating-a-scene

// import * as THREE from 'three';

// import {
// 	Camera,
// 	Material,
// 	Texture,
//   } from "https://cdn.skypack.dev/three@0.132.2";
  
  import * as THREE from "https://cdn.skypack.dev/three@0.132.2";


const scene = new THREE.Scene();

// CAMERA
// FOV, ratio, near clipping, far clipping
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000);


// RENDERER
const renderer = new THREE.WebGLRenderer();
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // default THREE.PCFShadowMap

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// LIGHT
// Create a DirectionalLight and turn on shadows for the light
const light = new THREE.DirectionalLight( 0xffffff, 1 );
light.position.set( -1, 1, 1); //default; light shining from top
light.castShadow = true; // default false
scene.add( light );

//Set up shadow properties for the light
light.shadow.mapSize.width = 512; // default
light.shadow.mapSize.height = 512; // default
light.shadow.camera.near = 0.5; // default
light.shadow.camera.far = 500; // default


// // OBJECTS
// //Create a sphere that cast shadows (but does not receive them)
// const sphereGeometry = new THREE.SphereGeometry( 5, 32, 32 );
// const sphereMaterial = new THREE.MeshStandardMaterial( { color: 0xff0000 } );
// const sphere = new THREE.Mesh( sphereGeometry, sphereMaterial );
// sphere.castShadow = true; //default is false
// sphere.receiveShadow = false; //default
// scene.add( sphere );

const geometry = new THREE.BoxGeometry( 1, 3, 1);
const material = new THREE.MeshStandardMaterial( {color: 0xff0000});
const cube = new THREE.Mesh( geometry, material );
cube.castShadow = true; //default is false
cube.receiveShadow = false; //default
scene.add( cube );

// //Create a plane that receives shadows (but does not cast them)
// const planeGeometry = new THREE.PlaneGeometry( 20, 20, 32, 32 );
// const planeMaterial = new THREE.MeshStandardMaterial( { color: 0x00ff00 } )
// const plane = new THREE.Mesh( planeGeometry, planeMaterial );
// plane.receiveShadow = true;
// scene.add( plane );

// //Create a helper for the shadow camera (optional)
// const helper = new THREE.CameraHelper( light.shadow.camera );
// scene.add( helper );


// the cube
// const geometry = new THREE.BoxGeometry( 1, 3, 1);
// const material = new THREE.MeshBasicMaterial( {color: 0xff0000});
// const cube = new THREE.Mesh( geometry, material );
// cube.castShadow = true; //default is false
// cube.receiveShadow = false; //default
// scene.add( cube );


// CAMERA
camera.position.z = 5;




// animation loop
function animate() 
{
	console.log("animate");
	cube.rotation.x += 0.01;
	cube.rotation.y += 0.01;

	renderer.render( scene, camera );
}
renderer.setAnimationLoop( animate );
