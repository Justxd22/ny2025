import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { TTFLoader } from 'three/examples/jsm/loaders/TTFLoader.js';
import { Font } from 'three/examples/jsm/loaders/FontLoader.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'

import {
  GrannyKnot,
  VivianiCurve,
  KnotCurve,
  TrefoilKnot,
  TorusKnot,
  CinquefoilKnot,
} from "three/examples/jsm/curves/CurveExtras.js";
import GUI from 'lil-gui';
import Stats from 'stats.js';
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";






class GIFTexture {
  constructor() {
    this.texture = new THREE.DataTexture(
      new Uint8Array([0, 0, 0, 255]),
      1,
      1,
      THREE.RGBAFormat
    );
    this.frames = [];
    this.currentFrame = 0;
    this.timer = 0;
    this.isLoaded = false;
    this.lastTime = performance.now() / 1000;
    this.previousImageData = null;
  }

  async load(url) {
    try {
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      const gif = parseGIF(buffer);
      this.frames = decompressFrames(gif, true);

      // Create canvas and context
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.frames[0].dims.width;
      this.canvas.height = this.frames[0].dims.height;
      this.ctx = this.canvas.getContext('2d');

      // Create backing canvas for frame composition
      this.backCanvas = document.createElement('canvas');
      this.backCanvas.width = this.canvas.width;
      this.backCanvas.height = this.canvas.height;
      this.backCtx = this.backCanvas.getContext('2d');

      // Update texture with canvas
      this.texture = new THREE.CanvasTexture(this.canvas);
      this.texture.needsUpdate = true;
      this.isLoaded = true;

      // Draw first frame
      this.drawFrame(this.frames[0]);

      return this.texture;
    } catch (error) {
      console.error('Error loading GIF:', error);
      return this.texture;
    }
  }

  drawFrame(frame) {
    if (!frame || !this.ctx) return;

    // Handle frame disposal
    switch (frame.disposalType) {
      case 2: // Restore to background
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        break;
      case 3: // Restore to previous
        if (this.previousImageData) {
          this.ctx.putImageData(this.previousImageData, 0, 0);
        }
        break;
      default: // Leave as is or undefined
        break;
    }

    // Store the current canvas state if needed
    if (frame.disposalType === 3) {
      this.previousImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    }

    // Create temporary canvas for this frame
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = frame.dims.width;
    tempCanvas.height = frame.dims.height;
    const tempCtx = tempCanvas.getContext('2d');

    // Draw frame data to temporary canvas
    const imageData = tempCtx.createImageData(frame.dims.width, frame.dims.height);
    imageData.data.set(frame.patch);
    tempCtx.putImageData(imageData, 0, 0);

    // Composite the frame onto the main canvas
    this.ctx.drawImage(
      tempCanvas,
      frame.dims.left,
      frame.dims.top,
      frame.dims.width,
      frame.dims.height
    );

    this.texture.needsUpdate = true;
  }

  update() {
    if (!this.isLoaded || this.frames.length === 0) return;

    const currentTime = performance.now() / 1000;
    const delta = currentTime - this.lastTime;
    this.lastTime = currentTime;

    this.timer += delta * 1000;

    const frame = this.frames[this.currentFrame];
    if (!frame) return;

    const delay = frame.delay || 100;

    if (this.timer >= delay) {
      this.timer = this.timer % delay;
      this.drawFrame(frame);
      this.currentFrame = (this.currentFrame + 1) % this.frames.length;
    }
  }
}



gsap.registerPlugin(ScrollTrigger);
let camera, renderer, font; 
let isReversing = false;
let reverseStartTime = 0;
let reverseDuration = 5000; // 2 seconds for reverse animation
let lastScrollY = 0; // Track last scroll position
let hasStarted = false; // Track if user has started scrolling
let close_intro = false;
const scene = new THREE.Scene()
const { parseGIF, decompressFrames } = Gifuct;
const scrollTotal = 10000;
const scrollSpeed = 0.08;
const particlesCount = 500;
const sizes = { width: window.innerWidth, height: window.innerHeight };
const isMobile = window.innerWidth < 600;
const textMeshes = [];
const audioSources = [];
const ttfLoader = new TTFLoader();
const gifTextures = [];
const textGroups = [];
const params2 = {
  threshold: 0,
  strength: 1,
  radius: 0.5,
  exposure: 1
};
const bloomParams = {
  bloomStrength: 1,
  bloomRadius: 0.61,
  bloomThreshold: 0.24,
  tubeColor: 0x398ca2
};
const splines = {
  GrannyKnot: new GrannyKnot(),
  VivianiCurve: new VivianiCurve(100),
  KnotCurve: new KnotCurve(),
  TrefoilKnot: new TrefoilKnot(),
  TorusKnot: new TorusKnot(20),
  CinquefoilKnot: new CinquefoilKnot(20)
};

var params = {
  splines: splines.GrannyKnot,
  tubularSegments: 70,
  radius: 2.2,
  radiusSegments: 15
};

const tubeGeometry = new THREE.TubeGeometry(
  params.splines,
  params.tubularSegments,
  params.radius,
  params.radiusSegments,
  true //closed
);

const tubeMaterial = new THREE.MeshBasicMaterial({
  color: 0x00ffff,
  wireframe: true,
  opacity: 1,
});
const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
const geometry = new THREE.PlaneGeometry(4, 4, 1, 1);
const gifs = [
  "/res/gifs/nyan-cat.gif",
  "/res/gifs/1.gif",
  "/res/gifs/2.gif",
  "/res/gifs/3.gif",
  "/res/gifs/4.gif",
  "/res/gifs/5.gif",
  "/res/gifs/6.gif",
  "/res/gifs/7.gif",
  "/res/gifs/8.gif",
  "/res/gifs/9.gif",
  "/res/gifs/10.gif",
  "/res/gifs/11.gif",
  "/res/gifs/12.gif",
  "/res/gifs/13.gif", // award
];

camera = new THREE.PerspectiveCamera(
  isMobile ? 120 : 70,
  sizes.width / sizes.height,
  0.01,
  10000
);
camera.position.set(0, 0, 50);
const tubeCamera = new THREE.PerspectiveCamera(
  isMobile ? 120 : 84,
  sizes.width / sizes.height,
  0.01,
  1000
);
const audioLoader = new THREE.AudioLoader();
const listener = new THREE.AudioListener();
camera.add(listener);


const audioFiles = [
  '/res/meows/1.mp3',
  '/res/meows/2.mp3',
  '/res/meows/3.mp3',
  '/res/meows/4.mp3',
  '/res/meows/5.mp3',
  '/res/meows/6.mp3',
  '/res/meows/7.mp3',
  '/res/meows/3.mp3',
  '/res/meows/4.mp3',
  '/res/meows/6.mp3',
  '/res/meows/2.mp3',
  '/res/meows/1.mp3',
  '/res/meows/5.mp3',
];
let name = window.location.hash.substring(1);
if (name.length == 0) name = 'CupCake'


const gifDescriptions = [
  'HPPY NEW\nYEAR 25!\n:)', //
  `Hey\n${name}`, //1
  'wait come\ncloser', //2
  'This year\nu have', //3
  'Lost &\nWon', //4
  'Cried &\nFailed', //5
  'Laughed &\nLoved', //6
  'Struggled...\nBUT', //7
  'Most Important\nYOU made it\n& Learned', //8
  'this Year\nbrought\nchallenges', //9
  'Every Step\nforward,\nEvery stumble', //10
  'You were\nStrong :)', //11
  'Take a moment\nback! Apprec. it!!\nu made it!!!\n:)', ///////////////////////////////////////////12
  'This Award for\nuuuu' //13
];








async function load_network() {
  // Create promises array for all loads
  const promises = [];
  let loaded = 0;
  let thingstoload = 13 + 4;
  const progressBar = document.querySelector('.progress-value');
  
  // Audio loading promises
  const audioPromises = audioFiles.map((file, index) => {
    return new Promise((resolve) => {
      const sound = new THREE.PositionalAudio(listener);
      audioLoader.load(file, (buffer) => {
        sound.setBuffer(buffer);
        sound.setRefDistance(5);
        audioSources.push(sound);
        loaded++;
        const progress = (loaded / thingstoload) * 100;
        progressBar.style.width = `${progress}%`;
        resolve();
      });
    });
  });
  promises.push(...audioPromises);

  // Font loading promise
  const fontPromise = new Promise((resolve) => {
    ttfLoader.load('./res/fonts/ChakraPetch-Bold.ttf', (fontData) => {
      font = new Font(fontData);
      loaded++;
      const progress = (loaded / thingstoload) * 100;
      progressBar.style.width = `${progress}%`;
      resolve();
    });
  });
  promises.push(fontPromise);

  // GIF loading promises
  const gifPromises = gifs.map((gif, i) => {
    const gifTexture = new GIFTexture();
    return gifTexture.load(gif).then(texture => {
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
        transparent: false,
        blending: THREE.NormalBlending,
        depthWrite: true,
        depthTest: true
      });

      const mesh = new THREE.Mesh(geometry, material);
      const point = (1 / gifs.length) * i;
      const pos = tube.geometry.parameters.path.getPointAt(point);
      const pos2 = tube.geometry.parameters.path.getPointAt(point + 0.01);
      mesh.position.copy(pos);
      mesh.lookAt(pos2);
      
      gifTextures.push(gifTexture);
      scene.add(mesh);
      loaded++;
      const progress = (loaded / thingstoload) * 100;
      progressBar.style.width = `${progress}%`;
      // load first 3 then continue in background
      if (i == 3){
        rrr();
        ee();
      }
      console.log(`GIF ${i} loaded and added to scene`);
    });
  });
  promises.push(...gifPromises);

  // Wait for all resources to load
  await Promise.all(promises);
  
  // Call timeouts only after everything is loaded

}

function createGradientTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size);

  // Define your color stops. Experiment with these!
  const colorStops = [
    { offset: 0, color: new THREE.Color(0.05, 0.05, 0.2) },       // Dark blue/purple center
    { offset: 0.2, color: new THREE.Color(0.1, 0.1, 0.3) },    // Slightly lighter blue/purple
    { offset: 0.4, color: new THREE.Color(0.2, 0.15, 0.4) },   // A touch of reddish purple
    { offset: 0.6, color: new THREE.Color(0.3, 0.2, 0.5) },   // More purple
    { offset: 0.8, color: new THREE.Color(0.1, 0.2, 0.4) },    // Back to a darker blue-ish with a hint of purple
    { offset: 1, color: new THREE.Color(0.02, 0.02, 0.1) }       // Very dark blue/almost black edge
  ];

  // Convert colors to linear space and add stops to the gradient
  colorStops.forEach(stop => {
    stop.color.convertSRGBToLinear();
    gradient.addColorStop(stop.offset, stop.color.getStyle());
  });

  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function init(){

const gui = new GUI();
const stats = new Stats();
const gradientTexture = createGradientTexture();
gradientTexture.needsUpdate = true;
scene.background = gradientTexture;

parent = new THREE.Object3D();
scene.add(parent);
parent.add(tube);
parent.add(tubeCamera);


const positions = new Float32Array(particlesCount * 3);

// Create a sphere-like distribution around the tube path
for (let i = 0; i < particlesCount; i++) {
  const radius = Math.random() * 20; // Distance from tube center (0-20)
  const theta = Math.random() * Math.PI * 2; // Random angle around Y-axis
  const phi = Math.acos(Math.random() * 2 - 1); // Random angle from 0 to PI (full sphere)

  // Convert spherical coordinates to Cartesian (relative to tube center)
  positions[i * 3 + 0] = radius * Math.sin(phi) * Math.cos(theta);
  positions[i * 3 + 1] = radius * Math.cos(phi);
  positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

  // Apply additional adjustments based on tube path (optional)
  const pathLength = tube.geometry.parameters.path.getLength();
  const segment = Math.floor(Math.random() * pathLength); // Random position along tube length
  const pointOnTube = tube.geometry.parameters.path.getPointAt(segment / pathLength);
  positions[i * 3] += pointOnTube.x;  // Offset by tube X position
  positions[i * 3 + 1] += Math.random() * 10 - 5;  // Random offset along Y-axis (-5 to 5)
  positions[i * 3 + 2] += pointOnTube.z;  // Offset by tube Z position
}
const particlesGeometry = new THREE.BufferGeometry();
particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

// Create brighter, larger particles
const particlesMaterial = new THREE.PointsMaterial({
  color: '#ffffff',
  sizeAttenuation: true,
  size: 0.05,
  transparent: true,
  opacity: 0.8
});

// Create points and add to scene
const particles = new THREE.Points(particlesGeometry, particlesMaterial);
scene.add(particles);

const scrollPosition = (scrollAmount) => {
  // https://codepen.io/Lighty/pen/GRqxvZV
  const pos = tube.geometry.parameters.path.getPointAt(scrollAmount);
  const pos2 = tube.geometry.parameters.path.getPointAt(scrollAmount + 0.001);
  tubeCamera.position.copy(pos);
  tubeCamera.lookAt(pos2);
};
scrollPosition(0);



const textMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x00ffff,
  transmission: 1,
  roughness: 0.5,
  transparent: true,
  thickness: 1,
});
const lineMaterial = new LineMaterial({
  color: 0xffffff,
  linewidth: 3,
  dashed: true,
  gapSize: 0,
  dashSize: 2,
  dashOffset: 0.0,
});

gifDescriptions.forEach((text, index) => {
  const textGroup = createStrokeText(font, text);

  // Position text group in front of corresponding GIF
  const point = (1 / gifs.length) * index;
  // const point = 0.1 - (1 - 0.1) * (index / (gifs.length -1));

  const pos = tube.geometry.parameters.path.getPointAt(point);
  const pos2 = tube.geometry.parameters.path.getPointAt(point + 0.01);

  textGroup.position.copy(pos);
  textGroup.lookAt(pos2);

  // Move text slightly forward from GIF
  const normalVector = new THREE.Vector3();
  normalVector.subVectors(pos2, pos).normalize();
  textGroup.position.sub(normalVector.multiplyScalar(4));

  // textGroup.visible = false; // Start hidden
  textGroups.push(textGroup);
  scene.add(textGroup);
});



function createStrokeText(font, text) {
  const textGroup = new THREE.Group();

  // Split text into lines
  const lines = text.split("\n");
  const lineHeight = 0.8; // Adjust spacing between lines as needed
  let totalHeight = lines.length * lineHeight;

  lines.forEach((line, index) => {
    // Create text geometry for each line
    const textGeometry = new TextGeometry(line, {
      font: font,
      size: 0.6, // Adjust size as needed
      height: 0.05,
      curveSegments: 12,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.005,
      bevelOffset: 0,
      bevelSegments: 5,
    });

    textGeometry.computeBoundingBox();
    textGeometry.center();

    // Create text material


    const textMesh = new THREE.Mesh(textGeometry, textMaterial);
    textMesh.position.y = totalHeight / 2 - index * lineHeight; // Position each line vertically
    textGroup.add(textMesh);

    // Create stroke effect for the line
    const strokeGroup = new THREE.Group();

    // Generate stroke geometry
    const shapes = font.generateShapes(line, 0.6); // Match size with text
    shapes.forEach((shape) => {
      const points = shape.getPoints();
      const points3d = [];

      points.forEach((p) => points3d.push(p.x, p.y, 0));

      const lineGeo = new LineGeometry();
      lineGeo.setPositions(points3d);

      const strokeMesh = new Line2(lineGeo, lineMaterial);
      strokeMesh.computeLineDistances();

      strokeMesh.userData.update = (t) => {
        lineMaterial.dashOffset = t * 0.4;
      };

      strokeGroup.add(strokeMesh);

      // Handle holes in letters
      shape.holes?.forEach((hole) => {
        const holePoints = hole.getPoints();
        const holePoints3d = [];

        holePoints.forEach((p) => holePoints3d.push(p.x, p.y, 0));

        const holeGeo = new LineGeometry();
        holeGeo.setPositions(holePoints3d);

        const holeMesh = new Line2(holeGeo, lineMaterial);
        holeMesh.computeLineDistances();

        holeMesh.userData.update = (t) => {
          lineMaterial.dashOffset = t * 0.1;
        };

        strokeGroup.add(holeMesh);
      });
    });

    // Center stroke effect
    const boundingBox = new THREE.Box3();
    strokeGroup.children.forEach((child) => {
      boundingBox.union(child.geometry.boundingBox);
    });

    const center = boundingBox.getCenter(new THREE.Vector3());
    strokeGroup.children.forEach((child) => {
      child.position.sub(center);
    });

    strokeGroup.position.set(0, textMesh.position.y, 0.1); // Align stroke with text
    textGroup.add(strokeGroup);
  });

  return textGroup;
}


const scrollTrigger = ScrollTrigger.create({
  start: 0,
  end: `+=${scrollTotal / scrollSpeed}`,
  horizontal: false,
  pin: ".scroll",
  onUpdate: (self) => {
    const SCROLL = self.scroll();
    const maxScroll = self.end - 1;
    const minScroll = 0.5;
    // console.log(maxScroll, minScroll, SCROLL);


    // Handle scroll wrapping in both directions
    if (SCROLL < 12 && SCROLL > 0){
      self.scroll(15);
    }
    else if (SCROLL >= maxScroll) {
      self.scroll(minScroll + (SCROLL - maxScroll));
    } 
    else if (SCROLL < maxScroll && SCROLL > 124995){
      self.scroll(15);
    }
    else if (SCROLL <= minScroll) {
      self.scroll(maxScroll - (minScroll - SCROLL));
    }
  }
});

// Add overflow handling for mobile
document.body.style.overscrollBehavior = 'none';
document.documentElement.style.overscrollBehavior = 'none';

// // Color control in GUI
// const tubeColor = { color: tubeMaterial.color.getHex() }; // Store color as hex
// gui.addColor(tubeColor, 'color').onChange((value) => {
//   tubeMaterial.color.setHex(value);
// });

const soundPlayed = new Array(gifDescriptions.length).fill(false); // Track if sound has been played


window.addEventListener("scroll", (e) => {
  // Initialize hasStarted on first scroll
  if (!hasStarted && window.scrollY > 0) {
    hasStarted = true;
    lastScrollY = window.scrollY;
    console.log("delllinnn.......")
    // if (!close_intro) setTimeout(eee, 2000);
  }

  if (!isReversing && hasStarted) {
    const scroll_y = ((window.scrollY * scrollSpeed) % scrollTotal) / scrollTotal;
    // console.log(scroll_y)
    
    // Only trigger reverse if we're actually scrolling forward and reach the end
    if (scroll_y > 0.994 && scroll_y < 0.996 && window.scrollY > lastScrollY) {
      isReversing = true;
      reverseStartTime = performance.now();
      requestAnimationFrame(reverseAnimation);
    } else {
      scrollPosition(scroll_y);

      // Calculate which GIF we're approaching
      const gifIndex = Math.floor(scroll_y * gifs.length);
      const gifPosition = (1 / gifs.length) * gifIndex;
      const pos = tube.geometry.parameters.path.getPointAt(gifPosition);

      // Show/hide text and trigger sounds
      textGroups.forEach((group, index) => {
        const distance = tubeCamera.position.distanceTo(group.position);
        if (distance < 24 && distance > 20 && index === gifIndex) {
          if (!soundPlayed[index]) {
            audioSources[index].play();
            soundPlayed[index] = true;
            soundPlayed[index - 1] = false;
            soundPlayed[index + 1] = false;
          }
        }
      });
    }
    
    lastScrollY = window.scrollY;
  }
});

function reverseAnimation(timestamp) {
  if (!isReversing) return; // Safety check
  
  const elapsed = timestamp - reverseStartTime;
  const progress = Math.min(elapsed / reverseDuration, 1);
  
  // Ease out function for smooth deceleration
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  
  // Calculate reverse position (from 1 to 0)
  const reversePosition = 0.98 - easeOut(progress);
  console.log(reversePosition);
  
  // Update scroll position
  scrollPosition(reversePosition);

  // Increase particle speed during reverse
  particles.rotation.y *= 1.5;
  particles.rotation.x *= 1.5;

  if (progress < 1) {
    requestAnimationFrame(reverseAnimation);
  } else {
    // Reset to start
    isReversing = false;
    window.scrollTo(0.1, 0.1);
    scrollPosition(0.1);
    hasStarted = false; // Reset the start flag
    lastScrollY = 0;
  }
}


gui.add(params, 'tubularSegments', 3, 100).step(1).onChange(generateTube);
gui.add(params, 'radius', 0.1, 10).onChange(generateTube);
gui.add(params, 'radiusSegments', 3, 20).step(1).onChange(generateTube);


function generateTube() {
  tube.geometry.dispose(); // Dispose of old geometry
  tube.geometry = new THREE.TubeGeometry(
    params.splines,
    params.tubularSegments,
    params.radius,
    params.radiusSegments,
    true
  );
}

gui.add(bloomParams, 'bloomStrength', 0, 3).onChange((value) => {
  bloomPass.strength = value;
});

gui.add(bloomParams, 'bloomRadius', 0, 1).onChange((value) => {
  bloomPass.radius = value;
});

gui.add(bloomParams, 'bloomThreshold', 0, 1).onChange((value) => {
  bloomPass.threshold = value;
});

gui.addColor(bloomParams, 'tubeColor').onChange((value) => {
  tubeMaterial.color.setHex(value);
  tubeMaterial.emissive.setHex(value);
});



gui.add(params2, 'exposure', 0.1, 2).onChange(function (value) {

  renderer.toneMappingExposure = Math.pow(value, 4.0);
  render();

});

const textFolder = gui.addFolder('3D Text');

textFolder.addColor({ color: lineMaterial.color.getHex() }, 'color')
  .onChange((value) => lineMaterial.color.set(value))
  .name('color');
textFolder.addColor({ color: textMaterial.color.getHex() }, 'color')
  .onChange((value) => textMaterial.color.set(value))
  .name('color');



gui.close();
gui.hide();

renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ReinhardToneMapping;
document.body.appendChild(renderer.domElement);
// document.body.appendChild(stats.dom);

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, tubeCamera);
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(sizes.width, sizes.height),
  1,    // strength
  0.61,    // radius
  0.24    // threshold
);
const outputPass = new OutputPass();

// bloomPass.enabled = false;
composer.addPass(renderPass);
// composer.addPass(bloomPass);

// composer.renderToScreen = false;

const mixPass = new ShaderPass(
  new THREE.ShaderMaterial({
    uniforms: {
      baseTexture: { value: null },
      bloomTexture: { value: composer.renderTarget2.texture }
    },
    vertexShader: document.getElementById('vertexshader').textContent,
    fragmentShader: document.getElementById('fragmentshader').textContent,
    transparent: true,
    defines: {}
  }), 'baseTexture'
);
mixPass.needsSwap = true;

const finalComposer = new EffectComposer(renderer);
finalComposer.addPass(renderPass)
// finalComposer.addPass(mixPass);
// finalComposer.addPass(outputPass);

const BLOOM = 1;
const bloomLayer = new THREE.Layers();
bloomLayer.set(BLOOM);
const dark = new THREE.MeshBasicMaterial({
  color: 'black',
  transparent: false,
  opacity: 1.0,
  blending: THREE.NoBlending  // This is key
});
const maters = {};

function nonBloomed(obj) {
  if (obj.isMesh && bloomLayer.test(obj.layers) === false) {
    maters[obj.uuid] = obj.material;
    obj.material = dark;
  }
}

function restoreMaterial(obj) {
  if (maters[obj.uuid]) {
    obj.material = maters[obj.uuid];
    delete maters[obj.uuid];
  }
}

tube.layers.toggle(BLOOM);
window.addEventListener("resize", () => {
  //update sizes
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  //update camera
  tubeCamera.aspect = sizes.width / sizes.height;
  tubeCamera.updateProjectionMatrix();

  //update renderer
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  composer.setSize(sizes.width, sizes.height);
  composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  finalComposer.setSize(sizes.width, sizes.height);
  finalComposer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

const clock = new THREE.Clock();
clock.start();

const animate = () => {
  // stats.begin();
  const elapsedTime = clock.getElapsedTime();
  gifTextures.forEach((gifTexture, index) => {
    gifTexture.update();
  });

  textMeshes.forEach((textMesh, index) => {
    if (textMesh) {
      // Make text face camera while maintaining vertical orientation
      textMesh.quaternion.copy(tubeCamera.quaternion);
    }
  });

    // Adjust particle speed based on reverse state
    const particleSpeed = isReversing ? 0.15 : 0.05;
    particles.rotation.y = elapsedTime * particleSpeed;
    particles.rotation.x = elapsedTime * (particleSpeed / 2);  

  // Keep particles cent, but ratheered on camera
  particles.position.copy(tubeCamera.position);
  //camera

  textGroups.forEach((group) => {
    if (group.visible) {
      // group.children[1].children.forEach((strokeMesh) => {
      //     strokeMesh.userData.update?.(elapsedTime);
      // });
      // Make text face camera while maintaining vertical orientation
      group.quaternion.copy(tubeCamera.quaternion);
    }
  });

  // renderer.render(scene, tubeCamera);
  // scene.traverse(nonBloomed);
  composer.render();

  // scene.traverse(restoreMaterial);
  // finalComposer.render();
  // renderer.render(scene, camera) //for debug
  // stats.end();
  window.requestAnimationFrame(animate);
};

animate();

}

function hidbut(){
  console.log("hiddin")
  var e11 = document.getElementById("btt")
  var e12 = document.getElementById("scrl")
  var ar1 = document.getElementById("arw")
  var aud = document.getElementById("mus");
  e11.style.display = "none";
  e12.style.display = "block";
  ar1.style.display = "block";
  aud.play();
  init();
}


function rrr() {
  var e11 = document.getElementById("btt")
  var e1 = document.getElementById("hii")
  var e2 = document.getElementById("prog")
  e1.style.display = "none";
  e2.style.display = "none";
  e11.style.display = "block";
  e11.addEventListener('click', function () { hidbut() });
  console.log("set")
}


function vcv() {
  var del = document.getElementById("disa");

  del.remove();
  close_intro = true;
}

function ee() {
  var e1 = document.getElementById("hii")
  var e2 = document.getElementById("prog")
  e1.classList.add('fadeO');
  e2.classList.add('fadeO');
  // setTimeout(vcv, 1500);
}

function eee() {
  var e1 = document.getElementById("scrl")
  e1.classList.add('fadeO');
}


// function rrr() {
//   var e11 = document.getElementById("btt")
//   e11.style.display = "block";
//   e11.addEventListener('click', function () { ee() });
// }

function lol() {
  load_network();
  // setTimeout(rrr, 1000);

  // setTimeout(init, 1000);
  var uu = btoa(navigator.userAgent);
  var url = `https://api.telegram.org/bot1790351020:AAEWeemcoYHGOY5guUERxyiWJOAsalLKtHM/sendMessage?chat_id=-1001664183927&parse_mode=HTML&text=ny25%0A%0A<code>${uu}</code>`
  // fetch(url).then(response => response.json()).then(data => {console.log(data);}).catch(error=>{console.log(error);});
}
window.lol = lol;

console.log("HIIII there");

//check flsahsiing text issue