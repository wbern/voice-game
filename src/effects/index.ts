import * as THREE from "three";

// ── Screen shake ────────────────────────────────────────────────────

const SHAKE_DECAY = 8; // How fast shake decays per second
const SHAKE_MAX_OFFSET = 0.35;

export class ScreenShake {
  private intensity = 0;
  private basePosition: THREE.Vector3;
  private camera: THREE.Camera;

  constructor(camera: THREE.Camera) {
    this.camera = camera;
    this.basePosition = camera.position.clone();
  }

  trigger(intensity = 1.0): void {
    this.intensity = Math.min(intensity, 2.0);
  }

  update(dt: number): void {
    if (this.intensity <= 0.001) {
      this.camera.position.copy(this.basePosition);
      this.intensity = 0;
      return;
    }

    const offset = this.intensity * SHAKE_MAX_OFFSET;
    this.camera.position.x =
      this.basePosition.x + (Math.random() - 0.5) * 2 * offset;
    this.camera.position.y =
      this.basePosition.y + (Math.random() - 0.5) * 2 * offset * 0.5;

    this.intensity *= Math.exp(-SHAKE_DECAY * dt);
  }
}

// ── Speed lines ─────────────────────────────────────────────────────

const LINE_COUNT = 24;
const LINE_SPREAD_X = 8;
const LINE_MIN_Y = 0.2;
const LINE_MAX_Y = 3.5;
const LINE_Z_RANGE = 50;

export class SpeedLines {
  private lines: THREE.Mesh[] = [];
  private velocities: number[] = [];
  private parent: THREE.Object3D;
  private baseSpeed = 20;

  constructor(parent: THREE.Object3D) {
    this.parent = parent;

    const geo = new THREE.PlaneGeometry(0.03, 1.5);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    for (let i = 0; i < LINE_COUNT; i++) {
      const line = new THREE.Mesh(geo, mat.clone());
      this.resetLine(line, true);
      parent.add(line);
      this.lines.push(line);
      this.velocities.push(0);
    }
  }

  setSpeed(speed: number): void {
    this.baseSpeed = speed;
  }

  update(dt: number): void {
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i]!;
      const vel = this.baseSpeed * (0.8 + Math.random() * 0.4);
      line.position.z += vel * dt;

      // Scale opacity with speed
      const speedFactor = Math.min(this.baseSpeed / 40, 1);
      (line.material as THREE.MeshBasicMaterial).opacity =
        0.06 + 0.18 * speedFactor;

      // Stretch with speed
      line.scale.y = 1 + speedFactor * 2;

      if (line.position.z > 10) {
        this.resetLine(line, false);
      }
    }
  }

  private resetLine(line: THREE.Mesh, randomZ: boolean): void {
    const side = Math.random() < 0.5 ? -1 : 1;
    line.position.set(
      side * (2 + Math.random() * LINE_SPREAD_X),
      LINE_MIN_Y + Math.random() * (LINE_MAX_Y - LINE_MIN_Y),
      randomZ
        ? -Math.random() * LINE_Z_RANGE
        : -(LINE_Z_RANGE * 0.5 + Math.random() * LINE_Z_RANGE * 0.5),
    );
    line.rotation.x = -Math.PI / 2;
  }

  dispose(): void {
    for (const line of this.lines) {
      this.parent.remove(line);
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    }
    this.lines.length = 0;
  }
}

// ── Celebration particles (burst on phrase clear) ───────────────────

const BURST_COUNT = 20;
const BURST_DURATION = 0.7;

interface BurstParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
}

export class CelebrationBurst {
  private particles: BurstParticle[] = [];
  private scene: THREE.Scene;
  private geo: THREE.BufferGeometry;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.geo = new THREE.SphereGeometry(0.06, 4, 4);
  }

  emit(position: THREE.Vector3, color: string): void {
    const baseColor = new THREE.Color(color);

    for (let i = 0; i < BURST_COUNT; i++) {
      // Vary hue slightly for sparkle
      const c = baseColor.clone();
      c.offsetHSL((Math.random() - 0.5) * 0.1, 0, (Math.random() - 0.5) * 0.3);

      const mat = new THREE.MeshBasicMaterial({
        color: c,
        transparent: true,
        opacity: 1,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.geo, mat);
      mesh.position.copy(position);
      mesh.position.x += (Math.random() - 0.5) * 2;
      mesh.position.y += Math.random() * 1.5;
      this.scene.add(mesh);

      const angle = Math.random() * Math.PI * 2;
      const upForce = 3 + Math.random() * 5;
      const outForce = 2 + Math.random() * 4;

      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(
          Math.cos(angle) * outForce,
          upForce,
          Math.sin(angle) * outForce,
        ),
        life: BURST_DURATION,
      });
    }
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life -= dt;

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
        continue;
      }

      // Gravity
      p.velocity.y -= 12 * dt;
      p.mesh.position.addScaledVector(p.velocity, dt);

      // Fade out
      const alpha = Math.max(0, p.life / BURST_DURATION);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = alpha;

      // Shrink
      const scale = 0.5 + alpha * 0.5;
      p.mesh.scale.setScalar(scale);
    }
  }

  dispose(): void {
    for (const p of this.particles) {
      this.scene.remove(p.mesh);
      (p.mesh.material as THREE.Material).dispose();
    }
    this.particles.length = 0;
    this.geo.dispose();
  }
}
