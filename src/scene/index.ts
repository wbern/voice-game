import * as THREE from "three";

/** Configuration for the road scene. */
export interface RoadSceneConfig {
  /** Forward scroll speed (units/sec). Default 20. */
  speed?: number;
}

const ROAD_WIDTH = 4;
const ROAD_LENGTH = 30;

// ── Procedural wood texture ─────────────────────────────────────────

function createWoodTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Base light wood color
  ctx.fillStyle = "#c8a876";
  ctx.fillRect(0, 0, size, size);

  // Wood grain lines (horizontal — runs across road width)
  ctx.strokeStyle = "rgba(160, 110, 60, 0.2)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 30; i++) {
    const y = Math.random() * size;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x < size; x += 4) {
      ctx.lineTo(x, y + (Math.random() - 0.5) * 1.5);
    }
    ctx.stroke();
  }

  // Plank divider lines (horizontal = across the road at intervals along its length)
  ctx.strokeStyle = "rgba(101, 67, 33, 0.4)";
  ctx.lineWidth = 2;
  const plankCount = 6;
  for (let i = 1; i < plankCount; i++) {
    const y = (i / plankCount) * size;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  // Subtle noise for natural look
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 10;
    data[i] = Math.max(0, Math.min(255, data[i]! + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1]! + noise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2]! + noise));
  }
  ctx.putImageData(imageData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 6);
  return tex;
}

/** Build the 3D road scene: wooden plank road + bouncing ball avatar. */
export function createRoadScene(
  scene: THREE.Scene,
  config: RoadSceneConfig = {},
): { update: (dt: number) => void; setSpeed: (s: number) => void } {
  let speed = config.speed ?? 20;

  // Transparent background — camera feed shows through
  scene.background = null;

  // -- Wooden road surface --
  const roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_LENGTH);
  const woodTex = createWoodTexture();
  const roadMat = new THREE.MeshLambertMaterial({ map: woodTex });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0;
  scene.add(road);

  // Thin dark edges for road definition
  const edgeGeo = new THREE.PlaneGeometry(0.06, ROAD_LENGTH);
  const edgeMat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
  for (const side of [-1, 1]) {
    const edge = new THREE.Mesh(edgeGeo, edgeMat);
    edge.rotation.x = -Math.PI / 2;
    edge.position.set((side * ROAD_WIDTH) / 2, 0.005, 0);
    scene.add(edge);
  }

  // -- Bouncing ball avatar --
  const ballGeo = new THREE.SphereGeometry(0.35, 16, 16);
  const ballMat = new THREE.MeshPhongMaterial({
    color: 0xff6b35,
    emissive: 0x331500,
    shininess: 80,
  });
  const ball = new THREE.Mesh(ballGeo, ballMat);
  ball.position.set(0, 0.5, 3);
  scene.add(ball);

  // -- Lighting --
  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffffff, 0.6);
  sun.position.set(3, 10, 5);
  scene.add(sun);

  // -- Animation state --
  let scrollOffset = 0;
  let bounceTime = 0;

  function update(dt: number) {
    scrollOffset += speed * dt;
    bounceTime += dt;

    // Scroll wood texture for movement feel
    woodTex.offset.y = scrollOffset * 0.15;

    // Bounce ball with sine wave
    ball.position.y = 0.5 + Math.abs(Math.sin(bounceTime * 5)) * 0.5;
    ball.rotation.x += dt * 3;
  }

  function setSpeed(s: number) {
    speed = s;
  }

  return { update, setSpeed };
}
