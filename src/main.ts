import * as THREE from "three";
import { GameEngine } from "./game";
import { GameUI } from "./ui";
import {
  VoiceRecognition,
  requestMicrophonePermission,
} from "./voice/index.ts";
import { createRoadScene } from "./scene/index.ts";
import { initCamera } from "./camera";
import { GameRecorder, shareRecording, downloadRecording } from "./recorder";
import { createRecordingDestination } from "./audio";
import { ObstacleManager, getLevelColor } from "./obstacles/index.ts";

// ── Three.js setup ───────────────────────────────────────────────────

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
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

// ── Obstacle system ──────────────────────────────────────────────────

const obstacles = new ObstacleManager(scene);

// Set obstacle color when level changes
engine.on("levelChange", (s) => {
  obstacles.clear();
  obstacles.setColor(getLevelColor(s.currentLevel));
});

// Spawn / extend obstacle queue when phrase changes
engine.on("phraseChange", (s) => {
  if (s.state !== "PLAYING") return;

  if (obstacles.getActiveCount() === 0) {
    // First phrase or after level clear — build full queue
    const queue: Array<{ text: string; hint: string }> = [];
    for (let i = 0; i < 3; i++) {
      const p = s.levelPhrases[s.currentPhraseIndex + i];
      if (p) queue.push(p);
    }
    obstacles.spawnQueue(queue);
  } else {
    // Add upcoming phrase to back of queue
    const ahead = s.currentPhraseIndex + 2;
    const p = s.levelPhrases[ahead];
    if (p) obstacles.addToQueue(p.text, p.hint);
  }
});

// Shatter on hit, flash red on miss
engine.on("phraseHit", () => obstacles.shatterActive());
engine.on("phraseMiss", () => obstacles.missActive());

// Clear obstacles when leaving play
engine.on("stateChange", (s) => {
  if (s.state === "GAME_OVER" || s.state === "MENU") {
    obstacles.clear();
  }
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

// ── Screen recording ─────────────────────────────────────────────────

const cameraVideo = document.getElementById("camera-feed") as HTMLVideoElement;
const recorder = new GameRecorder(renderer.domElement, cameraVideo);

// Start recording on countdown, stop on game over
let audioConnected = false;
engine.on("stateChange", (s) => {
  if (s.state === "COUNTDOWN") {
    // Connect audio once (AudioContext must exist after user gesture)
    if (!audioConnected) {
      const audioDest = createRecordingDestination();
      if (audioDest) recorder.connectAudio(audioDest);
      audioConnected = true;
    }
    recorder.start();
    ui.setRecording(true);
  } else if (s.state === "GAME_OVER" && recorder.isRecording) {
    recorder.stop().then((blob) => {
      ui.setRecording(false);
      if (blob.size > 0) {
        ui.setRecordingBlob(blob);
      }
    });
  } else if (s.state === "MENU") {
    ui.setRecording(false);
    ui.setRecordingBlob(null);
  }
});

// Wire share/download actions
ui.onShareAction(async (blob) => {
  const shared = await shareRecording(blob);
  if (!shared) downloadRecording(blob);
});

ui.onDownloadAction((blob) => {
  downloadRecording(blob);
});

// ── Startup: request mic permission ──────────────────────────────────

async function init() {
  initCamera();

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
  const s = engine.getState();
  const timeRatio =
    s.phraseTimeTotal > 0 ? s.phraseTimeRemaining / s.phraseTimeTotal : 1;

  roadScene.update(dt);
  obstacles.update(dt, timeRatio);
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);
