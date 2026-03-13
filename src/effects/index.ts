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
