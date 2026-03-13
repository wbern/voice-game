// UI/HUD overlay: menus, score, live transcript

export interface HUDElements {
  container: HTMLDivElement;
  targetPhrase: HTMLDivElement;
  transcript: HTMLDivElement;
  status: HTMLDivElement;
  matchFeedback: HTMLDivElement;
}

/** Create the HUD overlay and append to document body */
export function createHUD(): HUDElements {
  const container = document.createElement("div");
  container.id = "hud";
  Object.assign(container.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: "100",
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    color: "#fff",
  });

  // Target phrase display (top center)
  const targetPhrase = document.createElement("div");
  targetPhrase.id = "target-phrase";
  Object.assign(targetPhrase.style, {
    position: "absolute",
    top: "40px",
    left: "50%",
    transform: "translateX(-50%)",
    fontSize: "28px",
    fontWeight: "700",
    textAlign: "center",
    textShadow: "0 2px 8px rgba(0,0,0,0.7)",
    padding: "12px 24px",
    background: "rgba(0,0,0,0.5)",
    borderRadius: "12px",
    maxWidth: "90%",
  });
  container.appendChild(targetPhrase);

  // Live transcript (bottom center)
  const transcript = document.createElement("div");
  transcript.id = "transcript";
  Object.assign(transcript.style, {
    position: "absolute",
    bottom: "100px",
    left: "50%",
    transform: "translateX(-50%)",
    fontSize: "20px",
    textAlign: "center",
    textShadow: "0 1px 4px rgba(0,0,0,0.7)",
    padding: "8px 20px",
    background: "rgba(0,0,0,0.4)",
    borderRadius: "8px",
    maxWidth: "90%",
    minHeight: "36px",
    transition: "opacity 0.2s",
    opacity: "0.8",
  });
  container.appendChild(transcript);

  // Status bar (bottom)
  const status = document.createElement("div");
  status.id = "status";
  Object.assign(status.style, {
    position: "absolute",
    bottom: "20px",
    left: "50%",
    transform: "translateX(-50%)",
    fontSize: "14px",
    textAlign: "center",
    opacity: "0.6",
    textShadow: "0 1px 2px rgba(0,0,0,0.5)",
  });
  container.appendChild(status);

  // Match feedback (center, shown briefly on match)
  const matchFeedback = document.createElement("div");
  matchFeedback.id = "match-feedback";
  Object.assign(matchFeedback.style, {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%) scale(0.8)",
    fontSize: "48px",
    fontWeight: "900",
    textAlign: "center",
    textShadow: "0 4px 16px rgba(0,0,0,0.5)",
    opacity: "0",
    transition: "opacity 0.3s, transform 0.3s",
    pointerEvents: "none",
  });
  container.appendChild(matchFeedback);

  document.body.appendChild(container);

  return { container, targetPhrase, transcript, status, matchFeedback };
}

/** Update the target phrase display */
export function setTargetPhrase(hud: HUDElements, phrase: string): void {
  hud.targetPhrase.textContent = phrase ? `Say: "${phrase}"` : "";
}

/** Update the live transcript display */
export function setTranscript(
  hud: HUDElements,
  text: string,
  isFinal: boolean,
): void {
  hud.transcript.textContent = text;
  hud.transcript.style.opacity = isFinal ? "1" : "0.7";
  hud.transcript.style.fontStyle = isFinal ? "normal" : "italic";
}

/** Update the status text */
export function setStatus(hud: HUDElements, text: string): void {
  hud.status.textContent = text;
}

/** Flash match feedback briefly */
export function showMatchFeedback(hud: HUDElements, similarity: number): void {
  const label = similarity >= 0.95 ? "PERFECT!" : "MATCHED!";
  const color = similarity >= 0.95 ? "#00ff88" : "#44bbff";
  hud.matchFeedback.textContent = label;
  hud.matchFeedback.style.color = color;
  hud.matchFeedback.style.opacity = "1";
  hud.matchFeedback.style.transform = "translate(-50%, -50%) scale(1)";

  setTimeout(() => {
    hud.matchFeedback.style.opacity = "0";
    hud.matchFeedback.style.transform = "translate(-50%, -50%) scale(0.8)";
  }, 1200);
}
