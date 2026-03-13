const video = document.getElementById("camera-feed") as HTMLVideoElement;
const fallback = document.getElementById("camera-fallback") as HTMLDivElement;

export async function initCamera(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 1080 },
        height: { ideal: 1920 },
      },
      audio: false,
    });
    video.srcObject = stream;
    return true;
  } catch {
    showFallback();
    return false;
  }
}

function showFallback(): void {
  video.style.display = "none";
  fallback.style.display = "block";
}
