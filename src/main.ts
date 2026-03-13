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
import { level1Phrases } from "./levels/index.ts";

// ---------------------------------------------------------------------------
// Three.js scene (existing setup)
// ---------------------------------------------------------------------------

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
camera.position.set(0, 5, 10);
camera.lookAt(0, 0, 0);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

// ---------------------------------------------------------------------------
// HUD + Voice Recognition
// ---------------------------------------------------------------------------

const hud = createHUD();

// Pick a random phrase from level 1 for demo
let phraseIndex = Math.floor(Math.random() * level1Phrases.length);

function currentPhrase() {
  return level1Phrases[phraseIndex]!;
}

function nextPhrase() {
  phraseIndex = (phraseIndex + 1) % level1Phrases.length;
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
