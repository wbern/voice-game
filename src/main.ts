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
import { ScreenShake, CelebrationBurst } from "./effects/index.ts";

// ── WebGPU gate ─────────────────────────────────────────────────────

function checkWebGPU(): boolean {
  if ((navigator as Navigator & { gpu?: unknown }).gpu !== undefined) return true;

  // Show full-screen unsupported message
  document.body.innerHTML = "";
  const msg = document.createElement("div");
  msg.style.cssText = [
    "position:fixed",
    "inset:0",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "background:#1a1a2e",
    "color:#fff",
    "font-family:system-ui,-apple-system,sans-serif",
    "font-size:1.25rem",
    "text-align:center",
    "padding:2rem",
    "line-height:1.6",
  ].join(";");
  msg.textContent =
    "Your device does not support WebGPU. Please use a recent version of Chrome, Safari 26+, or Edge.";
  document.body.appendChild(msg);
  return false;
}

if (!checkWebGPU()) {
  throw new Error("WebGPU not supported");
}

// ── Three.js setup ───────────────────────────────────────────────────

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();

// Camera: elevated view looking down at the wooden shelf road (lower ~40% of screen)
const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);
camera.position.set(0, 3, 7);
camera.lookAt(0, 0.5, -10);

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

// ── Visual effects ──────────────────────────────────────────────────

const screenShake = new ScreenShake(camera);
const celebrationBurst = new CelebrationBurst(scene);

// Screen shake on miss
engine.on("phraseMiss", () => screenShake.trigger(1.0));

// Celebration burst on hit
engine.on("phraseHit", (s) => {
  const color = getLevelColor(s.currentLevel);
  // Burst at approximate active obstacle position
  celebrationBurst.emit(new THREE.Vector3(0, 1.5, 0), color);
});

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
  onProgress(progress) {
    const pct = Math.round(progress * 100);
    if (pct < 100) {
      ui.setVoiceStatus(`Loading speech model... ${pct}%`);
    } else {
      ui.setVoiceStatus("Speech model ready");
    }
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
    if (!voice.isRunning) void voice.start();
    ui.setMicActive(true);
  } else if (s.state === "PAUSED" || s.state === "GAME_OVER" || s.state === "MENU") {
    voice.stop();
    ui.setMicActive(false);
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

// ── Startup: request mic permission + preload model ──────────────────

async function init() {
  initCamera();

  ui.setVoiceStatus("Requesting microphone access...");
  const granted = await requestMicrophonePermission();
  if (!granted) {
    ui.setVoiceStatus("Microphone access denied — enable it to play");
    return;
  }

  // Start loading the Whisper model in the background so it's ready when
  // the player hits play. The progress callback updates the UI.
  ui.setVoiceStatus("Loading speech model...");
  await voice.loadModel();
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
  screenShake.update(dt);
  celebrationBurst.update(dt);
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);
