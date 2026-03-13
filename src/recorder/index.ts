// Screen recording: composites camera + Three.js canvas + game audio into WebM
// Uses MediaRecorder API with canvas.captureStream() for video

export class GameRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private compositeCanvas: HTMLCanvasElement;
  private compositeCtx: CanvasRenderingContext2D;
  private recording = false;
  private animationId: number | null = null;
  private audioDestination: MediaStreamAudioDestinationNode | null = null;

  constructor(
    private gameCanvas: HTMLCanvasElement,
    private cameraVideo: HTMLVideoElement,
  ) {
    this.compositeCanvas = document.createElement("canvas");
    this.compositeCtx = this.compositeCanvas.getContext("2d")!;
  }

  get isRecording(): boolean {
    return this.recording;
  }

  /** Connect audio routing. Call after AudioContext is initialized. */
  connectAudio(destination: MediaStreamAudioDestinationNode): void {
    this.audioDestination = destination;
  }

  start(): void {
    if (this.recording) return;

    this.compositeCanvas.width = this.gameCanvas.width;
    this.compositeCanvas.height = this.gameCanvas.height;

    const videoStream = this.compositeCanvas.captureStream(30);

    const tracks = [...videoStream.getTracks()];
    if (this.audioDestination) {
      tracks.push(...this.audioDestination.stream.getAudioTracks());
    }
    const combinedStream = new MediaStream(tracks);

    this.startCompositing();

    const mimeType = getSupportedMimeType();
    this.mediaRecorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: 2_500_000,
    });

    this.chunks = [];
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };

    this.mediaRecorder.start(100);
    this.recording = true;
  }

  stop(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === "inactive") {
        this.recording = false;
        this.stopCompositing();
        resolve(new Blob([]));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mime = this.mediaRecorder?.mimeType || "video/webm";
        const blob = new Blob(this.chunks, { type: mime });
        this.chunks = [];
        this.recording = false;
        this.stopCompositing();
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  // ── Compositing loop ────────────────────────────────────────────────

  private startCompositing(): void {
    const draw = () => {
      const ctx = this.compositeCtx;
      const w = this.compositeCanvas.width;
      const h = this.compositeCanvas.height;

      // Draw camera feed (mirrored to match CSS scaleX(-1))
      if (this.cameraVideo.readyState >= 2) {
        ctx.save();
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(this.cameraVideo, 0, 0, w, h);
        ctx.restore();
      } else {
        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, "#1a1a2e");
        grad.addColorStop(0.5, "#16213e");
        grad.addColorStop(1, "#0f3460");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }

      // Draw Three.js canvas on top (alpha-transparent where no 3D content)
      ctx.drawImage(this.gameCanvas, 0, 0, w, h);

      this.animationId = requestAnimationFrame(draw);
    };

    this.animationId = requestAnimationFrame(draw);
  }

  private stopCompositing(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
}

// ── Format detection ──────────────────────────────────────────────────

function getSupportedMimeType(): string {
  const types = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || "video/webm";
}

// ── Share / download helpers ──────────────────────────────────────────

export async function shareRecording(blob: Blob): Promise<boolean> {
  const ext = blob.type.includes("mp4") ? "mp4" : "webm";
  const file = new File([blob], `voice-game-${Date.now()}.${ext}`, {
    type: blob.type,
  });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        title: "Voice Game",
        text: "Check out my Voice Game score!",
        files: [file],
      });
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

export function downloadRecording(blob: Blob): void {
  const ext = blob.type.includes("mp4") ? "mp4" : "webm";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `voice-game-${Date.now()}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
