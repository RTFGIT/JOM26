/**
 * Token Boxes Visualisation
 * Canvas is position:absolute inside .boxes-container and covers the full
 * widget area. Veggie token images (6 varieties, random) fall from above
 * and land in their target box.
 *
 * Animation loop is on-demand: starts when tokens are spawned, stops when
 * all tokens have landed. No continuous background loop (no sky/clouds).
 */

class TokenBoxes {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');

    this.boxCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    this.total = 0;

    this.fallingTokens = [];
    this._animating = false;

    // ── Animation suppression (first-one-wins: postMessage vs Firestore) ──
    // Whichever path fires first for a given box claims the animation;
    // the second path within 10 s is a no-op.
    this.recentlyAnimated = {};

    // ── Holding mode (pre-launch) state ─────────────────────────────
    this.holdingMode = false;
    this.pileTokens = [];
    this.pileGrowthTimer = 0;
    this.eruptionPhase = 'none'; // 'none' | 'rumble' | 'erupting' | 'clearing'
    this.rumbleStartTime = 0;
    this.eruptionTokens = [];
    this._holdingAnimating = false;
    this._holdingFrame = 0;
    this.onEruptionComplete = null; // callback when eruption finishes

    // ── Configurable design dimensions (overridden by setMobileLayout) ──
    this.designWidth  = 1284;
    this.designHeight = 544;
    this.skyH         = 331;
    this._updateVolcano();

    // ── Preload all veggie token images ──────────────────────────────
    this.tokenImages = this._loadTokenImages();

    // ── postMessage listener ──────────────────────────────────────────
    window.addEventListener('message', (event) => {
      const data = event.data;
      if (!data || !data.type) return;

      if (data.type === 'PLEDGE_SUBMITTED') {
        const boxNum = data.boxNumber || 1;
        const count  = data.tokens || 1;
        const lastAnimated = this.recentlyAnimated[boxNum] || 0;
        if (Date.now() - lastAnimated < 10000) return;
        this.recentlyAnimated[boxNum] = Date.now();
        this.triggerBurst(boxNum, count);
      } else if (data.type === 'TRIGGER_CELEBRATION') {
        const boxNum = Math.min(5, Math.max(1, data.boxNumber || 1));
        console.log('[JOM26] postMessage → triggerCelebration box', boxNum);
        this.triggerCelebration(boxNum);
      } else if (data.type === 'TRIGGER_CELEBRATION_ALL') {
        console.log('[JOM26] postMessage → triggerCelebrationAll');
        this.triggerCelebrationAll();
      } else if (data.type === 'ADD_TO_PILE') {
        if (this.holdingMode) {
          this.addToPile(data.count || 3);
        }
      } else if (data.type === 'SET_HOLDING_MODE') {
        if (data.holding) {
          this.enterHoldingMode();
        } else {
          this.triggerEruption();
        }
      }
    });

    // Kept for backward-compat: external code can push updates this way.
    window.onTokenBoxesUpdate = ({ boxCounts, total }) => {
      this.boxCounts = boxCounts || this.boxCounts;
      this.total = total;
    };

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  // ── Token image loader ───────────────────────────────────────────────
  _loadTokenImages() {
    const names = [
      'Token 1 - Carrot.png',
      'Token 2 - Pea pod.png',
      'Token 3 - Mushroom.png',
      'Token 4 - Corn.png',
      'Token 5 - Tomato.png',
      'Token 6 - Cabbage.png',
      'Token 7 - Aubergine.png',
      'Token 8 - Bell Pepper.png',
      'Token 9 - Squash.png',
      'Token 10 - Sweet Potato.png',
    ];
    return names.map(name => {
      const img = new Image();
      img.src = `assets/${name}`;
      return img;
    });
  }

  // ── Canvas sizing ────────────────────────────────────────────────────
  resize() {
    const ratio  = window.devicePixelRatio || 1;
    const width  = this.designWidth;
    const height = this.designHeight;

    this.canvas.width  = width  * ratio;
    this.canvas.height = height * ratio;
    this.canvas.style.width  = width  + 'px';
    this.canvas.style.height = height + 'px';

    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.width  = width;
    this.height = height;
  }

  // ── Mobile layout switching ─────────────────────────────────────────
  setMobileLayout(config) {
    this.designWidth  = config.width  || 900;
    this.designHeight = config.height || 380;
    this.skyH         = config.skyH   || 200;
    this._updateVolcano();
    this.resize();
  }

  setDesktopLayout() {
    this.designWidth  = 1284;
    this.designHeight = 544;
    this.skyH         = 331;
    this._updateVolcano();
    this.resize();
  }

  _updateVolcano() {
    this._volcano = {
      centerX: this.designWidth / 2,
      mouthY: this.skyH - 11,
      baseY: this.skyH + 139,
      baseHalfWidth: Math.min(380, this.designWidth * 0.3),
    };
    this._volcano.slopeHeight = this._volcano.baseY - this._volcano.mouthY;
  }

  // ── On-demand animation loop ─────────────────────────────────────────
  // Starts when the first token of a burst is added; stops automatically
  // once all tokens have landed, clearing the canvas.
  _startAnimLoop() {
    if (this._animating) return;
    this._animating = true;
    const tick = () => {
      if (this.fallingTokens.length === 0) {
        this._animating = false;
        this.ctx.clearRect(0, 0, this.width, this.height);
        return;
      }
      this.render();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ── Token burst spawner ──────────────────────────────────────────────
  // Every token is animated — no cap. The spawn gap starts wide (400–700 ms
  // for the first few) and progressively tightens for larger bursts so
  // 200 tokens finish in a reasonable time (~30-40 s) without looking
  // like a solid wall of veggies.
  triggerBurst(boxNumber, count) {
    const total = count || 1;
    let cumulativeDelay = 0;
    for (let i = 0; i < total; i++) {
      // Gap ramps down: starts at 400-700ms, shrinks toward 80-150ms
      // as more tokens are queued. The ramp uses the ratio of how far
      // through the burst we are.
      const progress = total > 1 ? i / (total - 1) : 0;  // 0 → 1
      const gapMin = 400 - progress * 320;  // 400 → 80
      const gapRange = 300 - progress * 230; // 300 → 70
      const gap = gapMin + Math.random() * gapRange;
      setTimeout(() => this.animateTokenFall(boxNumber), cumulativeDelay);
      cumulativeDelay += gap;
    }
  }

  animateTokenFall(boxNumber) {
    // Compute box centres directly from CSS layout constants.
    // This avoids getBoundingClientRect() coordinate-space confusion:
    // the canvas is top:0;left:0 inside .boxes-container, so canvas
    // coordinates ARE boxes-container coordinates.
    //   boxes-row margin-top : 191 px  (box-bottom = 364 px = canvas 374 − 10)
    //   gradient rect size   : 156 × 113 px
    //   gap (space-between)  : (1284 − 5×156) / 4 = 126 px
    const BOX_W   = 156;
    const BOX_H   = 113;
    const GAP     = (this.designWidth - 5 * BOX_W) / 4;
    const SKY_H   = this.skyH;
    const idx     = Math.min(5, Math.max(1, boxNumber)) - 1;

    const targetX = BOX_W / 2 + idx * (BOX_W + GAP); // horizontal centre
    const targetY = SKY_H + BOX_H / 2;                // vertical centre of gradient rect

    // Start well above the canvas for a longer, more dramatic fall.
    const startX = targetX + (Math.random() - 0.5) * 60;
    const startY = -80 - Math.random() * 60; // above visible area

    // Pick a random veggie token image.
    const img = this.tokenImages[Math.floor(Math.random() * this.tokenImages.length)];

    const token = {
      x: startX, y: startY,
      targetX, targetY,
      boxNumber,
      img,
      progress: 0,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.18,    // faster spin
      wobbleAmp: 8 + Math.random() * 12,           // horizontal wobble amplitude
      wobbleFreq: 3 + Math.random() * 3,           // wobble frequency
      scaleBase: 1.0,                               // cartoony squash-stretch base
      fallTime: 0,                                  // frame counter for wobble phase
    };

    this.fallingTokens.push(token);
    this._startAnimLoop(); // no-op if loop is already running
  }

  // ── Box bounce trigger ──────────────────────────────────────────────
  // Adds the .bouncing CSS class to the nth .box-wrapper; removes it
  // after the animation ends so it can re-trigger on the next token.
  _bounceBox(boxNumber) {
    const idx = Math.min(5, Math.max(1, boxNumber)) - 1;
    const wrapper = document.querySelectorAll('.box-wrapper')[idx];
    if (!wrapper) return;

    // If already bouncing, restart the animation by removing + re-adding
    wrapper.classList.remove('bouncing');
    // Force a reflow so the browser registers the removal before re-add
    void wrapper.offsetWidth;
    wrapper.classList.add('bouncing');

    // Clean up after animation completes (450 ms matches CSS duration)
    wrapper.addEventListener('animationend', function handler() {
      wrapper.classList.remove('bouncing');
      wrapper.removeEventListener('animationend', handler);
    });
  }

  // ── Counter tick — increments the DOM counter by 1 on each landing ──
  // Tied to the token-landing moment so the number visually ticks up
  // exactly when the veggie drops into the box. Firestore's
  // syncFromFirestore will correct any drift on its next snapshot.
  _tickCounter(boxNumber) {
    const el = document.getElementById('box' + boxNumber + '-count');
    if (el) {
      const cur = parseInt(el.textContent.replace(/,/g, ''), 10) || 0;
      el.textContent = (cur + 1).toLocaleString();
    }
    const totalEl = document.getElementById('total-tokens');
    if (totalEl) {
      const cur = parseInt(totalEl.textContent.replace(/,/g, ''), 10) || 0;
      totalEl.textContent = (cur + 1).toLocaleString();
    }
    // Notify celebration checkpoint detector (for demo-local without Firestore)
    if (window.JOM26TokenBoxes && typeof window.JOM26TokenBoxes.onTokenLanded === 'function') {
      window.JOM26TokenBoxes.onTokenLanded(boxNumber);
    }
  }

  // ── Celebration confetti cannon ──────────────────────────────────────
  // Tokens shoot UPWARD from the box, fan out, pause at apex, then fall
  // back down into the same box. Used when a checkpoint is reached.

  triggerCelebration(boxNumber) {
    const CELEBRATION_COUNT = 10;
    const BOX_W   = 156;
    const BOX_H   = 113;
    const GAP     = (this.designWidth - 5 * BOX_W) / 4;
    const SKY_H   = this.skyH;
    const idx     = Math.min(5, Math.max(1, boxNumber)) - 1;

    const originX = BOX_W / 2 + idx * (BOX_W + GAP);
    const originY = SKY_H + BOX_H / 2;

    for (let i = 0; i < CELEBRATION_COUNT; i++) {
      const img = this.tokenImages[Math.floor(Math.random() * this.tokenImages.length)];

      // Fan spread: random angle from roughly -70° to +70° off vertical
      const angle = (Math.random() - 0.5) * 2.4; // radians, ~±70°
      const launchSpeed = 6 + Math.random() * 4;  // px/frame upward
      const vx = Math.sin(angle) * launchSpeed * 1.2; // horizontal component
      const vy = -Math.cos(angle) * launchSpeed;       // vertical (negative = up)

      const token = {
        celebrationType: true,
        boxNumber,
        originX, originY,
        x: originX, y: originY,
        vx, vy,
        gravity: 0.12 + Math.random() * 0.06,
        phase: 'launch',       // 'launch' → 'peak' → 'fall'
        peakTimer: 0,
        peakDuration: 6 + Math.floor(Math.random() * 6), // 6-11 frames at apex
        img,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.25,
        size: 60 + Math.random() * 24, // 60-84px for variety
        fallTime: 0,
      };

      this.fallingTokens.push(token);
    }

    this._bounceBox(boxNumber);
    this._startAnimLoop();
  }

  triggerCelebrationAll() {
    for (let i = 1; i <= 5; i++) {
      this.triggerCelebration(i);
    }
  }

  // ── Celebration token physics (called from render) ─────────────────
  _advanceCelebrationToken(token) {
    token.fallTime += 1;
    token.rotation += token.rotSpeed;

    if (token.phase === 'launch') {
      // Apply velocity + gravity (gravity decelerates upward movement)
      token.x += token.vx;
      token.y += token.vy;
      token.vy += token.gravity;

      // Horizontal drag — slows spread gradually
      token.vx *= 0.98;

      // Transition to peak when vertical velocity flips to downward
      if (token.vy >= 0) {
        token.phase = 'peak';
        token.peakTimer = 0;
      }
    } else if (token.phase === 'peak') {
      // Brief floating pause at apex with gentle wobble
      token.peakTimer += 1;
      token.x += Math.sin(token.peakTimer * 0.5) * 0.5;
      token.y += Math.sin(token.peakTimer * 0.3) * 0.3;

      if (token.peakTimer >= token.peakDuration) {
        token.phase = 'fall';
        token.vy = 0.5; // start gentle, gravity will accelerate
      }
    } else if (token.phase === 'fall') {
      // Fall back toward box origin with gravity
      token.vy += token.gravity;
      token.y += token.vy;

      // Drift horizontally back toward origin
      token.x += (token.originX - token.x) * 0.04;

      // Landed back in the box
      if (token.y >= token.originY) {
        return true; // signal removal
      }
    }
    return false; // keep going
  }

  // ── Firestore animation trigger ──────────────────────────────────────
  triggerAnimationFromFirestore(boxNumber, amount) {
    const lastAnimated = this.recentlyAnimated[boxNumber] || 0;
    if (Date.now() - lastAnimated < 10000) {
      console.log('[JOM26] Animation suppressed for box', boxNumber, '(already handled)');
      return;
    }
    this.recentlyAnimated[boxNumber] = Date.now();
    console.log('[JOM26] Firestore triggering burst for box', boxNumber, 'amount', amount);
    this.triggerBurst(boxNumber, amount);
  }

  // ── State sync ───────────────────────────────────────────────────────
  update(boxCounts, total) {
    this.boxCounts = boxCounts;
    this.total = total;
  }

  // ══════════════════════════════════════════════════════════════════════
  // ── HOLDING MODE (pre-launch) ─────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════

  // ── Volcano geometry constants ──────────────────────────────────────
  // Triangle shape: apex (mouth) at center top, base spans wide at bottom
  static VOLCANO = {
    centerX: 642,       // canvas center (1284/2)
    mouthY: 320,        // apex of the volcano (mouth) — raised 40px
    baseY: 470,         // bottom of the volcano — raised 40px
    baseHalfWidth: 380, // half-width of the base
    get slopeHeight() { return this.baseY - this.mouthY; }, // 150px
  };

  // Given a Y position on the volcano, return the max X offset from center.
  // The slope starts a margin below the mouth (tokens need room to arc).
  _volcanoWidthAtY(y) {
    const V = this._volcano;
    const slopeStartY = V.mouthY + 25;
    if (y <= slopeStartY) return 0;
    if (y >= V.baseY) return V.baseHalfWidth;
    const t = (y - slopeStartY) / (V.baseY - slopeStartY);
    return V.baseHalfWidth * t;
  }

  enterHoldingMode() {
    if (this.holdingMode) return;
    this.holdingMode = true;
    this.eruptionPhase = 'none';
    this.pileTokens = [];
    this.eruptionTokens = [];
    this.rollingTokens = []; // tokens rolling down the slopes
    this._holdingFrame = 0;
    this.pileGrowthTimer = 0;
    this._buildVolcanoPile(80);
    this._startHoldingAnimLoop();
    console.log('[JOM26] Entered holding mode with', this.pileTokens.length, 'pile tokens');
  }

  // Build initial static pile in a triangular volcano shape
  _buildVolcanoPile(count) {
    const V = this._volcano;
    for (let i = 0; i < count; i++) {
      const img = this.tokenImages[Math.floor(Math.random() * this.tokenImages.length)];
      // Random Y weighted toward the base (more tokens at bottom)
      const t = Math.pow(Math.random(), 0.6); // bias toward 1 (base)
      const y = V.mouthY + t * V.slopeHeight;
      const maxW = this._volcanoWidthAtY(y);
      const x = V.centerX + (Math.random() - 0.5) * 2 * maxW;

      this.pileTokens.push({
        img, x, y,
        size: 40 + Math.random() * 22,
        rotation: Math.random() * Math.PI * 2,
      });
    }
  }

  // Spawn a token from the volcano mouth that rolls down a slope
  _spawnFromMouth() {
    const V = this._volcano;
    const img = this.tokenImages[Math.floor(Math.random() * this.tokenImages.length)];

    // Pop upward from the mouth, then arc to one side
    const goLeft = Math.random() < 0.5;
    // Horizontal kick — strong enough to clear the mouth area
    const hSpeed = (2.5 + Math.random() * 2.5) * (goLeft ? -1 : 1);
    // Upward pop
    const vSpeed = -(2 + Math.random() * 2);

    this.rollingTokens.push({
      img,
      x: V.centerX + (Math.random() - 0.5) * 8,
      y: V.mouthY - 5,
      vx: hSpeed,
      vy: vSpeed,
      gravity: 0.15 + Math.random() * 0.05,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.15,
      size: 40 + Math.random() * 22,
      onSlope: false, // becomes true once touching the slope surface
    });
  }

  addToPile(count) {
    if (!this.holdingMode) return;
    for (let i = 0; i < count; i++) {
      setTimeout(() => this._spawnFromMouth(), i * 200);
    }
  }

  triggerEruption() {
    if (!this.holdingMode || this.eruptionPhase !== 'none') return;
    this.eruptionPhase = 'rumble';
    this.rumbleStartTime = performance.now();
    console.log('[JOM26] Eruption: rumble phase started');
  }

  exitHoldingMode() {
    this.holdingMode = false;
    this.eruptionPhase = 'none';
    this.pileTokens = [];
    this.eruptionTokens = [];
    this.rollingTokens = [];
    this._drainTimer = 0;
    console.log('[JOM26] Holding mode exited');
    if (typeof this.onEruptionComplete === 'function') {
      this.onEruptionComplete();
    }
  }

  _startHoldingAnimLoop() {
    if (this._holdingAnimating) return;
    this._holdingAnimating = true;
    const tick = () => {
      if (!this.holdingMode && this.eruptionTokens.length === 0 && this.rollingTokens.length === 0 && this.fallingTokens.length === 0) {
        this._holdingAnimating = false;
        this.ctx.clearRect(0, 0, this.width, this.height);
        return;
      }
      this._renderHolding();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  _renderHolding() {
    const { ctx, width, height } = this;
    const V = this._volcano;
    this._holdingFrame++;
    ctx.clearRect(0, 0, width, height);

    // ══════════════════════════════════════════════════════════════════
    // Eruption timeline (total ~10s):
    //   rumble    0–2s   — pile shakes with escalating intensity
    //   draining  2–9s   — pile tokens are launched upward from the
    //                      mouth one by one (top-first); the mountain
    //                      visibly shrinks as each token becomes part
    //                      of the upward stream. The last pile token
    //                      IS the last token in the geyser.
    //   clearing  9–10s  — last tokens leave the canvas, boxes appear
    // ══════════════════════════════════════════════════════════════════
    let rumbleOffset = { x: 0, y: 0 };
    const eruptElapsed = this.eruptionPhase !== 'none'
      ? performance.now() - this.rumbleStartTime : 0;

    // Continuous rumble shake for rumble + draining phases
    if (this.eruptionPhase === 'rumble' || this.eruptionPhase === 'draining') {
      const shakeI = Math.min(eruptElapsed / 2000, 1) * 10 + 2;
      rumbleOffset.x = (Math.random() - 0.5) * shakeI;
      rumbleOffset.y = (Math.random() - 0.5) * shakeI * 0.6;
    }

    // Rumble → draining transition at 2s
    if (this.eruptionPhase === 'rumble' && eruptElapsed >= 2000) {
      this.eruptionPhase = 'draining';
      // Settle any rolling tokens into the pile
      for (const rt of this.rollingTokens) {
        this.pileTokens.push({ img: rt.img, x: rt.x, y: rt.y, size: rt.size, rotation: rt.rotation });
      }
      this.rollingTokens = [];
      // Sort pile tokens: lowest Y first (top of volcano) so they drain peak-first
      this.pileTokens.sort((a, b) => a.y - b.y);
      this._drainTimer = 0;
      console.log('[JOM26] Eruption: draining', this.pileTokens.length, 'tokens');
    }

    // ── Draining: launch pile tokens from the mouth upward ──
    // The drain rate is spread so all tokens are consumed over ~7s (2s–9s).
    // Starts slow, accelerates, then tapers for a natural stream.
    if (this.eruptionPhase === 'draining' && this.pileTokens.length > 0) {
      this._drainTimer = (this._drainTimer || 0) + 1;
      // Drain ~1 token every 2-3 frames at 60fps = ~25/sec
      // With ~80-150 tokens, that's 3-6 seconds — fits the 7s window
      const drainPerFrame = 1 + Math.floor(this._drainTimer / 60); // slowly accelerates
      for (let d = 0; d < drainPerFrame && this.pileTokens.length > 0; d++) {
        const pt = this.pileTokens.shift();
        this.eruptionTokens.push({
          img: pt.img, size: pt.size,
          x: V.centerX + (Math.random() - 0.5) * 24,
          y: V.mouthY,
          vx: (Math.random() - 0.5) * 2.5,
          vy: -(10 + Math.random() * 8),
          gravity: 0,
          rotation: pt.rotation || Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.3,
        });
      }
    }

    // ── Ambient growth: spawn from mouth every ~3s (cap 150) ──
    if (this.eruptionPhase === 'none' && this.holdingMode) {
      this.pileGrowthTimer++;
      if (this.pileGrowthTimer >= 180 && this.pileTokens.length < 150) {
        this._spawnFromMouth();
        this.pileGrowthTimer = 0;
      }
    }

    // ── Advance rolling tokens ──
    // Pure ballistic physics — no invisible slope walls.
    // Tokens arc out of the mouth under gravity alone and settle where
    // they land (at the base line or when they lose momentum).
    for (let i = this.rollingTokens.length - 1; i >= 0; i--) {
      const rt = this.rollingTokens[i];

      // Apply gravity + movement
      rt.vy += rt.gravity;
      rt.x += rt.vx;
      rt.y += rt.vy;
      rt.rotation += rt.rotSpeed;

      // Ground collision — settle at the base
      if (rt.y >= V.baseY) {
        rt.y = V.baseY;
        // Clamp x within the base width
        rt.x = V.centerX + Math.max(-V.baseHalfWidth, Math.min(V.baseHalfWidth, rt.x - V.centerX));
        this.pileTokens.push({
          img: rt.img, x: rt.x, y: rt.y,
          size: rt.size, rotation: rt.rotation,
        });
        this.rollingTokens.splice(i, 1);
        continue;
      }

      // Apply air drag so tokens don't fly too far
      rt.vx *= 0.995;

      // If the token has fallen back below its launch height and is slow,
      // settle it where it is (adds to the visible pile surface)
      const speed = Math.sqrt(rt.vx * rt.vx + rt.vy * rt.vy);
      if (speed < 0.5 && rt.y > V.mouthY + 50 && rt.vy >= 0) {
        this.pileTokens.push({
          img: rt.img, x: rt.x, y: rt.y,
          size: rt.size, rotation: rt.rotation,
        });
        this.rollingTokens.splice(i, 1);
      }
    }

    // ── Draw static pile tokens (no movement) ──
    for (const pt of this.pileTokens) {
      ctx.save();
      ctx.translate(pt.x + rumbleOffset.x, pt.y + rumbleOffset.y);
      ctx.rotate(pt.rotation);
      const s = pt.size;
      if (pt.img && pt.img.complete && pt.img.naturalWidth > 0) {
        ctx.drawImage(pt.img, -s / 2, -s / 2, s, s);
      } else {
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // ── Draw rolling tokens ──
    for (const rt of this.rollingTokens) {
      ctx.save();
      ctx.translate(rt.x + rumbleOffset.x, rt.y + rumbleOffset.y);
      ctx.rotate(rt.rotation);
      const s = rt.size;
      if (rt.img && rt.img.complete && rt.img.naturalWidth > 0) {
        ctx.drawImage(rt.img, -s / 2, -s / 2, s, s);
      }
      ctx.restore();
    }

    // ── Draw eruption tokens (flying upward — no gravity, straight off screen) ──
    for (let i = this.eruptionTokens.length - 1; i >= 0; i--) {
      const et = this.eruptionTokens[i];
      et.x += et.vx;
      et.y += et.vy;
      // No gravity — tokens shoot straight up and off the canvas
      et.vx *= 0.995; // very slight horizontal drag for a natural column wobble
      et.rotation += (et.rotSpeed || 0.05) * 3;

      if (et.y < -150) { // off the top of screen
        this.eruptionTokens.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.translate(et.x, et.y);
      ctx.rotate(et.rotation);
      const s = et.size;
      if (et.img && et.img.complete && et.img.naturalWidth > 0) {
        ctx.drawImage(et.img, -s / 2, -s / 2, s, s);
      } else {
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // ── Eruption completion check ──
    // Done when: draining phase, pile empty, all eruption tokens off-screen
    if (this.eruptionPhase === 'draining' && this.pileTokens.length === 0 && this.eruptionTokens.length === 0) {
      this.eruptionPhase = 'clearing';
      console.log('[JOM26] Eruption: all tokens cleared at', Math.round(eruptElapsed), 'ms');
      setTimeout(() => this.exitHoldingMode(), 500);
    }

    // Hard timeout safety net: if eruption has been running for > 12s, force exit
    if (this.eruptionPhase !== 'none' && this.eruptionPhase !== 'clearing' && eruptElapsed > 12000) {
      console.warn('[JOM26] Eruption hard timeout at', Math.round(eruptElapsed), 'ms — forcing exit');
      this.eruptionPhase = 'clearing';
      this.pileTokens = [];
      this.eruptionTokens = [];
      this.rollingTokens = [];
      setTimeout(() => this.exitHoldingMode(), 200);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────
  // Advances all token positions, removes landed tokens, then draws.
  render() {
    const { ctx, width, height } = this;
    // Tokens are only drawn while above the box top (y < SKY_H).
    // Once a token crosses into the box area it is simply not painted —
    // it appears to enter the box and vanish. Physics keep running until
    // progress >= 1 so the counter still increments at the right time.
    const SKY_H = this.skyH + 19; // tokens travel 20 px into the box face before disappearing

    // In holding mode the holding renderer owns the canvas
    if (this.holdingMode) return;

    ctx.clearRect(0, 0, width, height);

    for (let i = this.fallingTokens.length - 1; i >= 0; i--) {
      const token = this.fallingTokens[i];

      // Skip pile-target tokens (handled by _renderHolding)
      if (token.pileTarget) continue;

      // ────────────────────────────────────────────────────────────────
      // CELEBRATION tokens — 3-phase: launch → peak → fall
      // ────────────────────────────────────────────────────────────────
      if (token.celebrationType) {
        const landed = this._advanceCelebrationToken(token);
        if (landed) {
          this.fallingTokens.splice(i, 1);
          this._bounceBox(token.boxNumber);
          continue;
        }

        // Draw celebration token (visible at all Y positions)
        ctx.save();
        ctx.translate(token.x, token.y);

        // Squash-stretch based on vertical speed
        const speed = Math.abs(token.vy || 0);
        const speedFactor = Math.min(speed / 8, 1);
        const sx = 1.0 - speedFactor * 0.12;
        const sy = 1.0 + speedFactor * 0.18;
        ctx.scale(sx, sy);
        ctx.rotate(token.rotation);

        const size = token.size;
        if (token.img && token.img.complete && token.img.naturalWidth > 0) {
          ctx.drawImage(token.img, -size / 2, -size / 2, size, size);
        } else {
          ctx.fillStyle = '#FFD700';
          ctx.beginPath();
          ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        continue;
      }

      // ────────────────────────────────────────────────────────────────
      // NORMAL falling tokens — drop from sky into box
      // ────────────────────────────────────────────────────────────────
      const speed = 0.012; // slower fall

      // ── advance physics ──────────────────────────────────────────────
      token.progress += speed;
      token.fallTime += 1;
      token.rotation += token.rotSpeed;

      // Horizontal wobble — sine wave drift for cartoony sway
      const wobbleX = Math.sin(token.fallTime * 0.08 * token.wobbleFreq) * token.wobbleAmp;
      token.x += (token.targetX + wobbleX - token.x) * speed * 2;

      // Vertical fall with slight ease-in (accelerating feel)
      const fallEase = 0.5 + token.progress * 1.5; // starts slow, speeds up
      token.y += (token.targetY - token.y) * speed * fallEase * 2;

      if (token.progress >= 1) {
        this.fallingTokens.splice(i, 1);
        this.boxCounts[token.boxNumber] = (this.boxCounts[token.boxNumber] || 0) + 1;
        this.total++;
        this._bounceBox(token.boxNumber);
        this._tickCounter(token.boxNumber);
        continue;
      }

      // ── draw only while in the sky area ──────────────────────────────
      if (token.y >= SKY_H) continue; // past box top — skip drawing

      ctx.save();
      ctx.translate(token.x, token.y);

      // Speed-based squash-and-stretch to emulate velocity
      const speedNorm   = Math.min(fallEase / 2.0, 1.0);
      const landingProx = Math.max(0, 1 - (SKY_H - token.y) / 100);

      const stretchY = 1.0 + speedNorm * 0.25 * (1 - landingProx);
      const stretchX = 1.0 - speedNorm * 0.15 * (1 - landingProx);
      const squashY  = 1.0 - landingProx * 0.20;
      const squashX  = 1.0 + landingProx * 0.18;

      const scaleX = stretchX * squashX;
      const scaleY = stretchY * squashY;
      ctx.scale(scaleX, scaleY);
      ctx.rotate(token.rotation);

      const size = 72;
      if (token.img && token.img.complete && token.img.naturalWidth > 0) {
        ctx.drawImage(token.img, -size / 2, -size / 2, size, size);
      } else {
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }
}

// ── Singleton + global hooks ─────────────────────────────────────────────
let tokenBoxes;

window.updateTokenBoxes = function (boxCounts, total) {
  if (tokenBoxes) tokenBoxes.update(boxCounts, total);
};

document.addEventListener('DOMContentLoaded', () => {
  tokenBoxes = new TokenBoxes('tokenCanvas');
  // Expose globally so Firestore path (patch.html inline module) and
  // patch-widget-app.js can call triggerAnimationFromFirestore / update().
  window.tokenBoxes = tokenBoxes;

  if (typeof window.tokenBoxesInit === 'function') {
    window.tokenBoxesInit(tokenBoxes);
  }
});
