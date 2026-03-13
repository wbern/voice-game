import * as THREE from "three";
import { GameEngine } from "./game";
import { GameUI } from "./ui";
import {
  VoiceRecognition,
  requestMicrophonePermission,
} from "./voice/index.ts";
import { createRoadScene } from "./scene/index.ts";

// ── Three.js setup ───────────────────────────────────────────────────

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

// ── Game engine + UI ─────────────────────────────────────────────────

const engine = new GameEngine();
const ui = new GameUI(engine);

// Expose engine on window for debugging
(window as unknown as Record<string, unknown>).gameEngine = engine;

// Adjust road speed based on game speed
engine.on("phraseChange", (s) => {
  roadScene.setSpeed(20 * s.speed);
});

// ── Voice recognition integration ────────────────────────────────────

const voice = new VoiceRecognition({
  matchThreshold: 0.8,
  onTranscript(transcript, isFinal) {
    ui.setTranscript(transcript, isFinal);
  },
  onMatch(_phrase, _spoken, _sim) {
    engine.phraseHit();
  },
  onError(error) {
    ui.setVoiceStatus(`Voice error: ${error}`);
  },
});

// Update voice target whenever the game phrase changes
engine.on("phraseChange", (s) => {
  if (s.currentPhrase) {
    voice.setTargetPhrase(s.currentPhrase.text);
  }
});

// Start/stop voice recognition based on game state
engine.on("stateChange", (s) => {
  if (s.state === "PLAYING") {
    if (!voice.isRunning) voice.start();
  } else if (s.state === "PAUSED" || s.state === "GAME_OVER" || s.state === "MENU") {
    voice.stop();
  }
});

// ── Startup: request mic permission ──────────────────────────────────

async function init() {
  if (!voice.supported) {
    ui.setVoiceStatus("Web Speech API not supported — try Chrome or Edge");
    return;
  }

  ui.setVoiceStatus("Requesting microphone access...");
  const granted = await requestMicrophonePermission();
  if (!granted) {
    ui.setVoiceStatus("Microphone access denied — enable it to play");
    return;
  }
  ui.setVoiceStatus("Microphone ready");
}

init();

// ── Render loop ──────────────────────────────────────────────────────

function animate() {
  const dt = clock.getDelta();
  roadScene.update(dt);
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);
