import * as THREE from "three";

/** Configuration for the road scene. */
export interface RoadSceneConfig {
  /** Forward scroll speed (units/sec). Default 20. */
  speed?: number;
}

const ROAD_WIDTH = 6;
const ROAD_LENGTH = 100;
const LANE_MARKING_WIDTH = 0.15;
const LANE_MARKING_LENGTH = 3;
const LANE_MARKING_GAP = 4;
const SHOULDER_WIDTH = 0.3;

// ── Procedural road texture ─────────────────────────────────────────

function createAsphaltTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Base dark grey
  ctx.fillStyle = "#2a2a2a";
  ctx.fillRect(0, 0, size, size);

  // Speckled grain for asphalt look
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 20;
    data[i] = Math.max(0, Math.min(255, data[i]! + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1]! + noise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2]! + noise));
  }
  ctx.putImageData(imageData, 0, 0);

  // Subtle horizontal cracks
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const y = Math.random() * size;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x < size; x += 8) {
      ctx.lineTo(x, y + (Math.random() - 0.5) * 3);
    }
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 16);
  return tex;
}

/** Build the 3D road scene: road surface, lane markings, shoulders, horizon sky. */
export function createRoadScene(
  scene: THREE.Scene,
  config: RoadSceneConfig = {},
): { update: (dt: number) => void; setSpeed: (s: number) => void } {
  let speed = config.speed ?? 20;

  // -- Sky gradient background --
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0xc8ddf0, 60, 120);

  // -- Ground plane (desert/grass on sides of road) --
  const groundGeo = new THREE.PlaneGeometry(200, ROAD_LENGTH * 2);
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x4a7c3f });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  scene.add(ground);

  // -- Road surface with asphalt texture --
  const roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_LENGTH);
  const asphaltTex = createAsphaltTexture();
  const roadMat = new THREE.MeshLambertMaterial({ map: asphaltTex });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0;
  scene.add(road);

  // -- Shoulder lines (white edges of road) --
  const shoulderGeo = new THREE.PlaneGeometry(SHOULDER_WIDTH, ROAD_LENGTH);
  const shoulderMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
  const leftShoulder = new THREE.Mesh(shoulderGeo, shoulderMat);
  leftShoulder.rotation.x = -Math.PI / 2;
  leftShoulder.position.set(-ROAD_WIDTH / 2 + SHOULDER_WIDTH / 2, 0.005, 0);
  scene.add(leftShoulder);

  const rightShoulder = new THREE.Mesh(shoulderGeo, shoulderMat);
  rightShoulder.rotation.x = -Math.PI / 2;
  rightShoulder.position.set(ROAD_WIDTH / 2 - SHOULDER_WIDTH / 2, 0.005, 0);
  scene.add(rightShoulder);

  // -- Dashed center line markings --
  const markingGeo = new THREE.PlaneGeometry(
    LANE_MARKING_WIDTH,
    LANE_MARKING_LENGTH,
  );
  const markingMat = new THREE.MeshLambertMaterial({ color: 0xffcc00 });

  const totalSpan = LANE_MARKING_LENGTH + LANE_MARKING_GAP;
  const markingCount = Math.ceil(ROAD_LENGTH / totalSpan) + 2;
  const markings: THREE.Mesh[] = [];

  for (let i = 0; i < markingCount; i++) {
    const m = new THREE.Mesh(markingGeo, markingMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, 0.005, -ROAD_LENGTH / 2 + i * totalSpan);
    scene.add(m);
    markings.push(m);
  }

  // -- Lighting --
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffffff, 0.8);
  sun.position.set(5, 20, -10);
  scene.add(sun);

  // -- Scroll offset for tiling --
  let scrollOffset = 0;

  function update(dt: number) {
    scrollOffset += speed * dt;

    // Scroll road texture for movement feel
    asphaltTex.offset.y = scrollOffset * 0.15;

    // Wrap lane markings to create infinite scroll
    const wrapLen = markingCount * totalSpan;
    for (const m of markings) {
      // Shift marking forward (towards camera) by scrollOffset, wrap around
      const base = m.userData["baseZ"] as number | undefined;
      if (base === undefined) {
        m.userData["baseZ"] = m.position.z;
      }
      const bz = (m.userData["baseZ"] as number) ?? m.position.z;
      let z = bz + (scrollOffset % wrapLen);
      // Keep markings within visible range
      const halfRange = wrapLen / 2;
      while (z > halfRange) z -= wrapLen;
      while (z < -halfRange) z += wrapLen;
      m.position.z = z;
    }
  }

  function setSpeed(s: number) {
    speed = s;
  }

  return { update, setSpeed };
}
