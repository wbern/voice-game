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

  // -- Road surface --
  const roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_LENGTH);
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0;
  scene.add(road);

  // -- Shoulder lines (white edges of road) --
  const shoulderGeo = new THREE.PlaneGeometry(SHOULDER_WIDTH, ROAD_LENGTH);
  const shoulderMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
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
