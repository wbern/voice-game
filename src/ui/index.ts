// UI/HUD overlay: menus, score, live transcript

import { GameEngine, LEVELS } from "../game";
import type { GameStore } from "../game";

// ── Styles ───────────────────────────────────────────────────────────

const OVERLAY_STYLES = `
  #game-ui {
    position: fixed;
    inset: 0;
    pointer-events: none;
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    color: #fff;
    z-index: 10;
  }
  #game-ui * {
    pointer-events: auto;
  }

  /* ── HUD (top bar) ──────────────────────────────────────── */
  .hud {
    display: none;
    justify-content: space-between;
    align-items: center;
    padding: 16px 24px;
    background: linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 100%);
  }
  .hud.visible { display: flex; }
  .hud-left, .hud-right { display: flex; gap: 20px; align-items: center; }
  .hud-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 60px;
  }
  .hud-stat .label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
    opacity: 0.7;
  }
  .hud-stat .value {
    font-size: 22px;
    font-weight: 700;
  }
  .hud-level {
    font-size: 14px;
    font-weight: 600;
    text-align: center;
    opacity: 0.9;
  }
  .hud-level .level-name {
    font-size: 18px;
    font-weight: 700;
  }

  /* Lives as hearts */
  .lives-display {
    display: flex;
    gap: 4px;
    font-size: 20px;
  }
  .life { opacity: 1; transition: opacity 0.3s; }
  .life.lost { opacity: 0.2; }

  /* Combo indicator */
  .combo-display {
    font-size: 18px;
    font-weight: 700;
    color: #ffd700;
    transition: transform 0.15s;
  }
  .combo-display.pop { transform: scale(1.4); }

  /* ── Phrase area (center) ───────────────────────────────── */
  .phrase-area {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    display: none;
  }
  .phrase-area.visible { display: block; }
  .phrase-text {
    font-size: 42px;
    font-weight: 800;
    text-shadow: 0 2px 12px rgba(0,0,0,0.8);
    margin-bottom: 8px;
    transition: transform 0.15s, color 0.15s;
  }
  .phrase-hint {
    font-size: 16px;
    opacity: 0.6;
    font-style: italic;
  }

  /* Live transcript */
  .transcript {
    font-size: 18px;
    margin-top: 16px;
    min-height: 28px;
    opacity: 0.7;
    font-style: italic;
    transition: opacity 0.2s;
  }
  .transcript.final { opacity: 1; font-style: normal; }

  /* Timer bar */
  .timer-bar-container {
    width: 300px;
    max-width: 80vw;
    height: 6px;
    background: rgba(255,255,255,0.2);
    border-radius: 3px;
    margin: 16px auto 0;
    overflow: hidden;
  }
  .timer-bar {
    height: 100%;
    background: #4ade80;
    border-radius: 3px;
    transition: background 0.3s;
  }
  .timer-bar.warning { background: #facc15; }
  .timer-bar.danger { background: #ef4444; }

  /* ── Countdown overlay ──────────────────────────────────── */
  .countdown-overlay {
    position: absolute;
    inset: 0;
    display: none;
    justify-content: center;
    align-items: center;
    background: rgba(0,0,0,0.7);
  }
  .countdown-overlay.visible { display: flex; }
  .countdown-number {
    font-size: 120px;
    font-weight: 900;
    animation: countPulse 0.6s ease-out;
  }
  @keyframes countPulse {
    0% { transform: scale(2); opacity: 0; }
    50% { opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }

  /* ── Menu overlay ───────────────────────────────────────── */
  .menu-overlay {
    position: absolute;
    inset: 0;
    display: none;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background: rgba(0,0,0,0.8);
    gap: 24px;
  }
  .menu-overlay.visible { display: flex; }
  .menu-title {
    font-size: 48px;
    font-weight: 900;
    background: linear-gradient(135deg, #a78bfa, #60a5fa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .menu-subtitle {
    font-size: 18px;
    opacity: 0.6;
    margin-top: -12px;
  }
  .menu-btn {
    padding: 14px 40px;
    font-size: 18px;
    font-weight: 700;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: transform 0.1s, box-shadow 0.1s;
    color: #fff;
  }
  .menu-btn:hover { transform: scale(1.05); }
  .menu-btn:active { transform: scale(0.97); }
  .btn-play {
    background: linear-gradient(135deg, #7c3aed, #3b82f6);
    box-shadow: 0 4px 20px rgba(124,58,237,0.4);
  }
  .btn-secondary {
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.2);
  }
  .high-score-display {
    font-size: 14px;
    opacity: 0.5;
  }
  .voice-status {
    font-size: 13px;
    opacity: 0.4;
    margin-top: -8px;
  }

  /* ── Game Over overlay ──────────────────────────────────── */
  .gameover-overlay {
    position: absolute;
    inset: 0;
    display: none;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background: rgba(0,0,0,0.85);
    gap: 16px;
  }
  .gameover-overlay.visible { display: flex; }
  .gameover-title {
    font-size: 52px;
    font-weight: 900;
    color: #ef4444;
  }
  .gameover-title.victory { color: #4ade80; }
  .gameover-stats {
    display: flex;
    gap: 32px;
    margin: 16px 0;
  }
  .gameover-stat {
    text-align: center;
  }
  .gameover-stat .label {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 1px;
    opacity: 0.6;
  }
  .gameover-stat .value {
    font-size: 32px;
    font-weight: 700;
  }
  .new-highscore {
    color: #ffd700;
    font-size: 18px;
    font-weight: 700;
    display: none;
  }
  .new-highscore.visible { display: block; }

  /* ── Pause overlay ──────────────────────────────────────── */
  .pause-overlay {
    position: absolute;
    inset: 0;
    display: none;
    justify-content: center;
    align-items: center;
    background: rgba(0,0,0,0.7);
  }
  .pause-overlay.visible { display: flex; }
  .pause-text {
    font-size: 48px;
    font-weight: 900;
    opacity: 0.8;
  }

  /* ── Hit/Miss feedback ──────────────────────────────────── */
  .feedback {
    position: absolute;
    top: 40%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 28px;
    font-weight: 800;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s, transform 0.3s;
  }
  .feedback.show {
    opacity: 1;
    transform: translate(-50%, -70%);
  }
  .feedback.hit { color: #4ade80; }
  .feedback.miss { color: #ef4444; }
`;

// ── UI Manager ───────────────────────────────────────────────────────

export class GameUI {
  private root: HTMLDivElement;
  private engine: GameEngine;
  private unsubscribers: (() => void)[] = [];

  // Element refs
  private hud!: HTMLElement;
  private scoreValue!: HTMLElement;
  private livesDisplay!: HTMLElement;
  private comboDisplay!: HTMLElement;
  private levelDisplay!: HTMLElement;
  private phraseArea!: HTMLElement;
  private phraseText!: HTMLElement;
  private phraseHint!: HTMLElement;
  private transcriptEl!: HTMLElement;
  private timerBar!: HTMLElement;
  private countdownOverlay!: HTMLElement;
  private countdownNumber!: HTMLElement;
  private menuOverlay!: HTMLElement;
  private highScoreMenu!: HTMLElement;
  private voiceStatus!: HTMLElement;
  private gameoverOverlay!: HTMLElement;
  private gameoverTitle!: HTMLElement;
  private gameoverScore!: HTMLElement;
  private gameoverCombo!: HTMLElement;
  private gameoverLevel!: HTMLElement;
  private newHighscore!: HTMLElement;
  private pauseOverlay!: HTMLElement;
  private feedback!: HTMLElement;

  constructor(engine: GameEngine) {
    this.engine = engine;
    this.root = document.createElement("div");
    this.root.id = "game-ui";
    this.injectStyles();
    this.buildDOM();
    document.body.appendChild(this.root);
    this.bindEvents();
    this.setupKeyboard();
    this.showMenu();
  }

  /** Update the live voice transcript display */
  setTranscript(text: string, isFinal: boolean): void {
    this.transcriptEl.textContent = text;
    this.transcriptEl.classList.toggle("final", isFinal);
  }

  /** Update the voice status message */
  setVoiceStatus(text: string): void {
    this.voiceStatus.textContent = text;
  }

  destroy(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.root.remove();
    document.querySelector("#game-ui-styles")?.remove();
  }

  // ── DOM construction ───────────────────────────────────────────

  private injectStyles(): void {
    const style = document.createElement("style");
    style.id = "game-ui-styles";
    style.textContent = OVERLAY_STYLES;
    document.head.appendChild(style);
  }

  private buildDOM(): void {
    this.root.innerHTML = `
      <!-- HUD -->
      <div class="hud">
        <div class="hud-left">
          <div class="hud-stat">
            <span class="label">Score</span>
            <span class="value score-value">0</span>
          </div>
          <div class="combo-display"></div>
        </div>
        <div class="hud-level">
          <div class="level-name"></div>
          <div class="level-progress"></div>
        </div>
        <div class="hud-right">
          <div class="lives-display"></div>
          <button class="menu-btn btn-secondary" style="padding:6px 14px;font-size:13px"
                  data-action="pause">| |</button>
        </div>
      </div>

      <!-- Phrase area -->
      <div class="phrase-area">
        <div class="phrase-text"></div>
        <div class="phrase-hint"></div>
        <div class="transcript"></div>
        <div class="timer-bar-container">
          <div class="timer-bar" style="width:100%"></div>
        </div>
      </div>

      <!-- Feedback -->
      <div class="feedback"></div>

      <!-- Countdown -->
      <div class="countdown-overlay">
        <div class="countdown-number">3</div>
      </div>

      <!-- Menu -->
      <div class="menu-overlay visible">
        <div class="menu-title">Voice Game</div>
        <div class="menu-subtitle">Say the slang to score!</div>
        <button class="menu-btn btn-play" data-action="start">Start Game</button>
        <div class="high-score-display"></div>
        <div class="voice-status"></div>
      </div>

      <!-- Game Over -->
      <div class="gameover-overlay">
        <div class="gameover-title">Game Over</div>
        <div class="gameover-stats">
          <div class="gameover-stat">
            <span class="label">Score</span>
            <span class="value gameover-score">0</span>
          </div>
          <div class="gameover-stat">
            <span class="label">Best Combo</span>
            <span class="value gameover-combo">0</span>
          </div>
          <div class="gameover-stat">
            <span class="label">Level</span>
            <span class="value gameover-level">1</span>
          </div>
        </div>
        <div class="new-highscore">New High Score!</div>
        <button class="menu-btn btn-play" data-action="restart">Play Again</button>
        <button class="menu-btn btn-secondary" data-action="menu">Menu</button>
      </div>

      <!-- Pause -->
      <div class="pause-overlay">
        <div class="pause-text">PAUSED</div>
      </div>
    `;

    // Cache refs
    this.hud = this.root.querySelector(".hud")!;
    this.scoreValue = this.root.querySelector(".score-value")!;
    this.livesDisplay = this.root.querySelector(".lives-display")!;
    this.comboDisplay = this.root.querySelector(".combo-display")!;
    this.levelDisplay = this.root.querySelector(".hud-level")!;
    this.phraseArea = this.root.querySelector(".phrase-area")!;
    this.phraseText = this.root.querySelector(".phrase-text")!;
    this.phraseHint = this.root.querySelector(".phrase-hint")!;
    this.transcriptEl = this.root.querySelector(".transcript")!;
    this.timerBar = this.root.querySelector(".timer-bar")!;
    this.countdownOverlay = this.root.querySelector(".countdown-overlay")!;
    this.countdownNumber = this.root.querySelector(".countdown-number")!;
    this.menuOverlay = this.root.querySelector(".menu-overlay")!;
    this.highScoreMenu = this.root.querySelector(".high-score-display")!;
    this.voiceStatus = this.root.querySelector(".voice-status")!;
    this.gameoverOverlay = this.root.querySelector(".gameover-overlay")!;
    this.gameoverTitle = this.root.querySelector(".gameover-title")!;
    this.gameoverScore = this.root.querySelector(".gameover-score")!;
    this.gameoverCombo = this.root.querySelector(".gameover-combo")!;
    this.gameoverLevel = this.root.querySelector(".gameover-level")!;
    this.newHighscore = this.root.querySelector(".new-highscore")!;
    this.pauseOverlay = this.root.querySelector(".pause-overlay")!;
    this.feedback = this.root.querySelector(".feedback")!;
  }

  // ── Event binding ──────────────────────────────────────────────

  private bindEvents(): void {
    // Button clicks
    this.root.addEventListener("click", (e) => {
      const target = (e.target as HTMLElement).closest("[data-action]") as HTMLElement | null;
      if (!target) return;
      const action = target.dataset.action;
      if (action === "start" || action === "restart") this.engine.startGame();
      else if (action === "menu") this.engine.returnToMenu();
      else if (action === "pause") this.engine.togglePause();
    });

    // Game events
    this.unsubscribers.push(
      this.engine.on("stateChange", (s) => this.onStateChange(s)),
      this.engine.on("scoreChange", (s) => this.updateScore(s)),
      this.engine.on("livesChange", (s) => this.updateLives(s)),
      this.engine.on("comboChange", (s) => this.updateCombo(s)),
      this.engine.on("phraseChange", (s) => this.updatePhrase(s)),
      this.engine.on("levelChange", (s) => this.updateLevel(s)),
      this.engine.on("countdownTick", (s) => this.updateCountdown(s)),
      this.engine.on("phraseTimeTick", (s) => this.updateTimer(s)),
      this.engine.on("highScoreChange", (s) => this.updateHighScore(s)),
      this.engine.on("phraseHit", () => this.showFeedback("hit")),
      this.engine.on("phraseMiss", () => this.showFeedback("miss")),
    );
  }

  private setupKeyboard(): void {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "p") {
        this.engine.togglePause();
      }
      if (e.key === "Enter") {
        const state = this.engine.getState().state;
        if (state === "MENU") this.engine.startGame();
        else if (state === "GAME_OVER") this.engine.startGame();
      }
    };
    document.addEventListener("keydown", handler);
    this.unsubscribers.push(() => document.removeEventListener("keydown", handler));
  }

  // ── State transitions ─────────────────────────────────────────

  private hideAll(): void {
    this.hud.classList.remove("visible");
    this.phraseArea.classList.remove("visible");
    this.countdownOverlay.classList.remove("visible");
    this.menuOverlay.classList.remove("visible");
    this.gameoverOverlay.classList.remove("visible");
    this.pauseOverlay.classList.remove("visible");
  }

  private onStateChange(s: Readonly<GameStore>): void {
    this.hideAll();
    switch (s.state) {
      case "MENU": this.showMenu(); break;
      case "COUNTDOWN": this.showCountdown(s); break;
      case "PLAYING": this.showPlaying(s); break;
      case "PAUSED": this.showPaused(s); break;
      case "GAME_OVER": this.showGameOver(s); break;
    }
  }

  private showMenu(): void {
    this.menuOverlay.classList.add("visible");
    const hs = this.engine.getState().highScore;
    this.highScoreMenu.textContent = hs > 0 ? `High Score: ${hs}` : "";
  }

  private showCountdown(s: Readonly<GameStore>): void {
    this.countdownOverlay.classList.add("visible");
    this.countdownNumber.textContent = String(s.countdown);
  }

  private showPlaying(s: Readonly<GameStore>): void {
    this.hud.classList.add("visible");
    this.phraseArea.classList.add("visible");
    this.updateScore(s);
    this.updateLives(s);
    this.updateCombo(s);
    this.updateLevel(s);
  }

  private showPaused(s: Readonly<GameStore>): void {
    this.hud.classList.add("visible");
    this.pauseOverlay.classList.add("visible");
    this.updateScore(s);
    this.updateLives(s);
  }

  private showGameOver(s: Readonly<GameStore>): void {
    this.gameoverOverlay.classList.add("visible");
    const victory = s.currentLevel > LEVELS.length ||
      (s.currentLevel === LEVELS.length && s.phrasesCleared >= this.engine.config.phrasesPerLevel);
    this.gameoverTitle.textContent = victory ? "You Win!" : "Game Over";
    this.gameoverTitle.className = victory ? "gameover-title victory" : "gameover-title";
    this.gameoverScore.textContent = String(s.score);
    this.gameoverCombo.textContent = `${s.maxCombo}x`;
    this.gameoverLevel.textContent = String(s.currentLevel);
    this.newHighscore.classList.toggle("visible", s.score >= s.highScore && s.score > 0);
  }

  // ── HUD updates ────────────────────────────────────────────────

  private updateScore(s: Readonly<GameStore>): void {
    this.scoreValue.textContent = String(s.score);
  }

  private updateLives(s: Readonly<GameStore>): void {
    const maxLives = this.engine.config.initialLives;
    let html = "";
    for (let i = 0; i < maxLives; i++) {
      html += `<span class="life${i >= s.lives ? " lost" : ""}">&#9829;</span>`;
    }
    this.livesDisplay.innerHTML = html;
  }

  private updateCombo(s: Readonly<GameStore>): void {
    if (s.combo > 1) {
      this.comboDisplay.textContent = `${s.combo}x`;
      this.comboDisplay.classList.add("pop");
      setTimeout(() => this.comboDisplay.classList.remove("pop"), 150);
    } else {
      this.comboDisplay.textContent = "";
    }
  }

  private updatePhrase(s: Readonly<GameStore>): void {
    if (s.currentPhrase) {
      this.phraseText.textContent = s.currentPhrase.text;
      this.phraseHint.textContent = s.currentPhrase.hint;
      this.transcriptEl.textContent = "";
      this.transcriptEl.classList.remove("final");
    }
  }

  private updateLevel(s: Readonly<GameStore>): void {
    const levelIndex = Math.min(s.currentLevel - 1, LEVELS.length - 1);
    const levelInfo = LEVELS[levelIndex]!;
    this.levelDisplay.querySelector(".level-name")!.textContent =
      `Level ${s.currentLevel}: ${levelInfo.name}`;
    this.levelDisplay.querySelector(".level-progress")!.textContent =
      `${s.phrasesCleared} / ${this.engine.config.phrasesPerLevel}`;
  }

  private updateCountdown(s: Readonly<GameStore>): void {
    this.countdownNumber.textContent = s.countdown > 0 ? String(s.countdown) : "GO!";
    // Re-trigger animation
    this.countdownNumber.style.animation = "none";
    void this.countdownNumber.offsetHeight; // force reflow
    this.countdownNumber.style.animation = "";
  }

  private updateTimer(s: Readonly<GameStore>): void {
    const pct = s.phraseTimeTotal > 0
      ? Math.max(0, s.phraseTimeRemaining / s.phraseTimeTotal) * 100
      : 100;
    this.timerBar.style.width = `${pct}%`;
    this.timerBar.classList.remove("warning", "danger");
    if (pct < 25) this.timerBar.classList.add("danger");
    else if (pct < 50) this.timerBar.classList.add("warning");
  }

  private updateHighScore(s: Readonly<GameStore>): void {
    this.highScoreMenu.textContent = s.highScore > 0 ? `High Score: ${s.highScore}` : "";
  }

  // ── Feedback flash ─────────────────────────────────────────────

  private feedbackTimeout = 0;

  private showFeedback(type: "hit" | "miss"): void {
    clearTimeout(this.feedbackTimeout);
    this.feedback.className = `feedback ${type}`;
    this.feedback.textContent = type === "hit" ? "Nice!" : "Miss!";
    requestAnimationFrame(() => {
      this.feedback.classList.add("show");
    });
    this.feedbackTimeout = window.setTimeout(() => {
      this.feedback.classList.remove("show");
    }, 600);
  }
}
