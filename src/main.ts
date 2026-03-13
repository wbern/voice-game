import * as THREE from "three";
import {
  VoiceRecognition,
  requestMicrophonePermission,
} from "./voice/index.ts";
import {
  createHUD,
  setTargetPhrase,
  setTranscript,
  setStatus,
  showMatchFeedback,
} from "./ui/index.ts";
import { LevelManager } from "./game/index.ts";
import { createRoadScene } from "./scene/index.ts";

// ---------------------------------------------------------------------------
// Level system
// ---------------------------------------------------------------------------

const levelManager = new LevelManager();
const currentLevel = levelManager.getLevel(levelManager.unlockedLevel) ?? levelManager.getLevel(1)!;
const levelPhrases = currentLevel.phrases;

// ---------------------------------------------------------------------------
// Three.js scene
// ---------------------------------------------------------------------------

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();

// Camera: driver/runner perspective looking down the road
const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  200,
);
camera.position.set(0, 3, 8);
camera.lookAt(0, 1, -40);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const roadScene = createRoadScene(scene, { speed: 20 });

const clock = new THREE.Clock();

function animate() {
  const dt = clock.getDelta();
  roadScene.update(dt);
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

// ---------------------------------------------------------------------------
// HUD + Voice Recognition
// ---------------------------------------------------------------------------

const hud = createHUD();

// Pick a random phrase from the current level
let phraseIndex = Math.floor(Math.random() * levelPhrases.length);

function currentPhrase() {
  return levelPhrases[phraseIndex]!;
}

function nextPhrase() {
  phraseIndex = (phraseIndex + 1) % levelPhrases.length;
  const phrase = currentPhrase();
  setTargetPhrase(hud, phrase.text);
  setTranscript(hud, "", false);
  voice.setTargetPhrase(phrase.text);
}

const voice = new VoiceRecognition({
  matchThreshold: 0.8,
  onTranscript(transcript, isFinal) {
    setTranscript(hud, transcript, isFinal);
  },
  onMatch(_phrase, _spoken, sim) {
    showMatchFeedback(hud, sim);
    // After a brief delay, advance to next phrase
    setTimeout(nextPhrase, 1500);
  },
  onError(error) {
    setStatus(hud, `Voice error: ${error}`);
  },
});

// ---------------------------------------------------------------------------
// Startup: request mic permission then begin
// ---------------------------------------------------------------------------

async function init() {
  if (!voice.supported) {
    setStatus(hud, "Web Speech API not supported — try Chrome or Edge");
    setTargetPhrase(hud, "");
    return;
  }

  setStatus(hud, "Requesting microphone access...");

  const granted = await requestMicrophonePermission();
  if (!granted) {
    setStatus(hud, "Microphone access denied — enable it to play");
    return;
  }

  // Set initial phrase and start listening
  const phrase = currentPhrase();
  setTargetPhrase(hud, phrase.text);
  voice.setTargetPhrase(phrase.text);
  voice.start();

  setStatus(hud, "Listening... speak the phrase above!");
}

init();
