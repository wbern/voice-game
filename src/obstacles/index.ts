import * as THREE from "three";

// ── Constants ────────────────────────────────────────────────────────

const ROAD_WIDTH = 6;
const WALL_HEIGHT = 2.5;
const WALL_DEPTH = 0.4;
const SPAWN_Z = -45;
const PLAYER_Z = 4;
const QUEUE_SPACING = 14;

const SHATTER_PIECES = 16;
const SHATTER_DURATION = 0.8;
const MISS_FADE_DURATION = 0.5;

const LEVEL_COLORS = [
  "#e91e63", // Gen Alpha — hot pink
  "#2196f3", // Gen Z — blue
  "#ff9800", // Millennial — orange
  "#4caf50", // Gen X — green
  "#9c27b0", // Boomer — purple
];

// ── Types ────────────────────────────────────────────────────────────

interface ShatterPiece {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
}

interface Obstacle {
  group: THREE.Group;
  wall: THREE.Mesh;
  phrase: string;
  active: boolean;
  shattered: boolean;
  missed: boolean;
  pieces: ShatterPiece[];
  elapsed: number;
}

// ── Texture helpers ──────────────────────────────────────────────────

function darken(hex: string, amount: number): string {
  const c = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.round(((c >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.round(((c >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.round((c & 0xff) * (1 - amount)));
  return `rgb(${r},${g},${b})`;
}

function createWallTexture(
  text: string,
  hint: string,
  color: string,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const c = canvas.getContext("2d")!;

  // Gradient background
  const grad = c.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, color);
  grad.addColorStop(1, darken(color, 0.35));
  c.fillStyle = grad;
  c.fillRect(0, 0, canvas.width, canvas.height);

  // Border
  c.strokeStyle = "rgba(255,255,255,0.4)";
  c.lineWidth = 6;
  c.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);

  // Phrase text
  c.fillStyle = "#ffffff";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.shadowColor = "rgba(0,0,0,0.5)";
  c.shadowBlur = 8;
  const maxW = canvas.width - 80;
  const fontSize = Math.min(90, maxW / (text.length * 0.55));
  c.font = `bold ${fontSize}px "Segoe UI", Arial, sans-serif`;
  c.fillText(text, canvas.width / 2, canvas.height * 0.42, maxW);

  // Hint
  c.shadowBlur = 4;
  c.font = '24px "Segoe UI", Arial, sans-serif';
  c.fillStyle = "rgba(255,255,255,0.7)";
  const hintText = hint.length > 50 ? hint.slice(0, 50) + "\u2026" : hint;
  c.fillText(hintText, canvas.width / 2, canvas.height * 0.68, maxW);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// ── Public helpers ───────────────────────────────────────────────────

export function getLevelColor(level: number): string {
  return LEVEL_COLORS[(level - 1) % LEVEL_COLORS.length] ?? LEVEL_COLORS[0]!;
}

// ── ObstacleManager ──────────────────────────────────────────────────

export class ObstacleManager {
  private scene: THREE.Scene;
  private obstacles: Obstacle[] = [];
  private color = LEVEL_COLORS[0]!;
  private pulseTime = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  setColor(color: string): void {
    this.color = color;
  }

  getActiveCount(): number {
    return this.obstacles.filter((o) => !o.shattered && !o.missed).length;
  }

  /** Spawn an initial queue of obstacles (up to 3). */
  spawnQueue(phrases: Array<{ text: string; hint: string }>): void {
    const count = Math.min(phrases.length, 3);
    for (let i = 0; i < count; i++) {
      const p = phrases[i]!;
      this.createWall(p.text, p.hint, SPAWN_Z - i * QUEUE_SPACING, i === 0);
    }
  }

  /** Add a single obstacle to the back of the queue. */
  addToQueue(text: string, hint: string): void {
    const live = this.obstacles.filter((o) => !o.shattered && !o.missed);
    const backZ =
      live.length > 0
        ? Math.min(...live.map((o) => o.group.position.z)) - QUEUE_SPACING
        : SPAWN_Z - QUEUE_SPACING;
    this.createWall(text, hint, backZ, false);
  }

  /** Shatter the active obstacle (phrase matched). */
  shatterActive(): void {
    const obs = this.findActive();
    if (!obs) return;

    obs.shattered = true;
    obs.active = false;
    obs.wall.visible = false;

    const wallColor = new THREE.Color(this.color);
    const pieceW = (ROAD_WIDTH - 0.5) / 4;
    const pieceH = WALL_HEIGHT / 4;
    const pieceGeo = new THREE.BoxGeometry(pieceW, pieceH, WALL_DEPTH);

    for (let i = 0; i < SHATTER_PIECES; i++) {
      const mat = new THREE.MeshLambertMaterial({
        color: wallColor,
        transparent: true,
        opacity: 1,
      });
      const mesh = new THREE.Mesh(pieceGeo, mat);
      mesh.position.set(
        obs.group.position.x + (Math.random() - 0.5) * (ROAD_WIDTH - 1),
        WALL_HEIGHT * Math.random() + 0.3,
        obs.group.position.z,
      );
      this.scene.add(mesh);

      obs.pieces.push({
        mesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 6,
          Math.random() * 5 + 3,
          Math.random() * 6 + 3,
        ),
        spin: new THREE.Vector3(
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 8,
        ),
      });
    }

    this.promoteNext();
  }

  /** Visual miss on the active obstacle (phrase expired). */
  missActive(): void {
    const obs = this.findActive();
    if (!obs) return;

    obs.missed = true;
    obs.active = false;

    // Flash red
    const mats = obs.wall.material as THREE.MeshLambertMaterial[];
    for (const m of mats) {
      if (m.map) {
        m.map.dispose();
        m.map = null;
      }
      m.color.set(0xff0000);
      m.emissive.set(0x440000);
    }

    this.promoteNext();
  }

  /** Tick obstacle movement, shatter particles, and fade animations. */
  update(dt: number, timeRatio: number): void {
    this.pulseTime += dt;

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i]!;

      // ── Shatter animation ──
      if (obs.shattered) {
        obs.elapsed += dt;
        if (obs.elapsed >= SHATTER_DURATION) {
          this.removeAt(i);
          continue;
        }
        const alpha = 1 - obs.elapsed / SHATTER_DURATION;
        for (const p of obs.pieces) {
          p.velocity.y -= 12 * dt;
          p.mesh.position.addScaledVector(p.velocity, dt);
          p.mesh.rotation.x += p.spin.x * dt;
          p.mesh.rotation.y += p.spin.y * dt;
          p.mesh.rotation.z += p.spin.z * dt;
          (p.mesh.material as THREE.MeshLambertMaterial).opacity = Math.max(
            0,
            alpha,
          );
        }
        continue;
      }

      // ── Miss fade ──
      if (obs.missed) {
        obs.elapsed += dt;
        if (obs.elapsed >= MISS_FADE_DURATION) {
          this.removeAt(i);
          continue;
        }
        const alpha = 1 - obs.elapsed / MISS_FADE_DURATION;
        const mats = obs.wall.material as THREE.MeshLambertMaterial[];
        for (const m of mats) m.opacity = alpha;
        obs.group.position.z += 15 * dt;
        continue;
      }

      // ── Active obstacle: timer-driven approach ──
      if (obs.active) {
        const progress = 1 - timeRatio; // 0 → 1 as time runs out
        const targetZ = SPAWN_Z + (PLAYER_Z - SPAWN_Z) * progress;
        // Smooth lerp to avoid position snaps on promotion
        obs.group.position.z +=
          (targetZ - obs.group.position.z) * Math.min(1, dt * 6);

        // Pulse glow
        const pulse = 0.15 + 0.1 * Math.sin(this.pulseTime * 4);
        const mats = obs.wall.material as THREE.MeshLambertMaterial[];
        for (const m of mats) {
          m.emissive.set(this.color);
          m.emissiveIntensity = pulse;
        }
      }
      // Queue obstacles hold position until promoted
    }
  }

  /** Remove all obstacles and clean up resources. */
  clear(): void {
    while (this.obstacles.length > 0) this.removeAt(0);
  }

  // ── Internal ───────────────────────────────────────────────────────

  private createWall(
    text: string,
    hint: string,
    z: number,
    active: boolean,
  ): void {
    const group = new THREE.Group();

    const geo = new THREE.BoxGeometry(ROAD_WIDTH - 0.5, WALL_HEIGHT, WALL_DEPTH);
    const tex = createWallTexture(text, hint, this.color);

    const opacity = active ? 1.0 : 0.6;
    const faceMat = new THREE.MeshLambertMaterial({
      map: tex,
      transparent: true,
      opacity,
    });
    const sideMat = new THREE.MeshLambertMaterial({
      color: new THREE.Color(this.color),
      transparent: true,
      opacity,
    });

    // Material order: [+x, -x, +y, -y, +z (front), -z (back)]
    const wall = new THREE.Mesh(geo, [
      sideMat,
      sideMat,
      sideMat,
      sideMat,
      faceMat,
      faceMat.clone(),
    ]);
    wall.position.y = WALL_HEIGHT / 2 + 0.05;
    group.add(wall);

    group.position.z = z;
    this.scene.add(group);

    this.obstacles.push({
      group,
      wall,
      phrase: text,
      active,
      shattered: false,
      missed: false,
      pieces: [],
      elapsed: 0,
    });
  }

  private findActive(): Obstacle | undefined {
    return this.obstacles.find((o) => o.active);
  }

  private promoteNext(): void {
    const next = this.obstacles.find(
      (o) => !o.active && !o.shattered && !o.missed,
    );
    if (next) {
      next.active = true;
      // Full opacity for active wall
      const mats = next.wall.material as THREE.MeshLambertMaterial[];
      for (const m of mats) m.opacity = 1.0;
    }
  }

  private removeAt(index: number): void {
    const obs = this.obstacles[index]!;
    this.scene.remove(obs.group);

    // Clean up shatter pieces
    for (const p of obs.pieces) {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
    }

    // Clean up wall materials + textures
    const mats = obs.wall.material;
    if (Array.isArray(mats)) {
      for (const m of mats) {
        const lm = m as THREE.MeshLambertMaterial;
        if (lm.map) lm.map.dispose();
        lm.dispose();
      }
    }
    obs.wall.geometry.dispose();

    this.obstacles.splice(index, 1);
  }
}
