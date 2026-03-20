/**
 * JOM26 Token Boxes Widget - Standalone with PostMessage
 */

// State
let boxState = {
  boxCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  total: 0,
  submissions: 0
};

// ── Celebration checkpoint state ─────────────────────────────────────
let celebrationConfig = {
  mode1Enabled: false,
  mode1Threshold: 25,
  mode2Enabled: false,
  mode2Threshold: 100
};
let prevCelebCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
let prevCelebTotal = 0;
let celebrationInitialized = false;

/**
 * Initialize
 */
function init() {
  updateDisplay();
  
  // Request initial state from parent/siblings
  if (window.parent !== window) {
    window.parent.postMessage({ type: 'REQUEST_UPDATE' }, '*');
  }
}

/**
 * Update display — sets counters to their current boxState values.
 * This is used for Firestore sync (initial load + corrections).
 * The per-token count-up animation is handled by _tickCounter() in
 * token-boxes-standalone.js, which increments +1 on each token landing.
 */
function updateDisplay() {
  const total = Object.values(boxState.boxCounts).reduce((a, b) => a + b, 0);

  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById(`box${i}-count`);
    if (el) {
      el.textContent = (boxState.boxCounts[i] || 0).toLocaleString();
    }
  }

  const totalEl = document.getElementById('total-tokens');
  if (totalEl) {
    totalEl.textContent = total.toLocaleString();
  }

  const submissionsEl = document.getElementById('total-submissions');
  if (submissionsEl) {
    submissionsEl.textContent = boxState.submissions.toLocaleString();
  }

  // Update token boxes canvas
  if (window.tokenBoxes) {
    tokenBoxes.update(boxState.boxCounts, total);
  }
}

/**
 * Add tokens to a specific box (for demo or from submissions)
 */
function addTokens(boxNumber, amount) {
  boxNumber = Math.min(5, Math.max(1, boxNumber));
  boxState.boxCounts[boxNumber] = (boxState.boxCounts[boxNumber] || 0) + amount;
  boxState.submissions += 1;
  updateDisplay();
  
  // Broadcast update to other widgets
  broadcastUpdate();
}

/**
 * Update box counts
 */
function updateBoxCounts(newBoxCounts) {
  boxState.boxCounts = newBoxCounts;
  updateDisplay();
  broadcastUpdate();
}

/**
 * Broadcast state to other widgets
 */
function broadcastUpdate() {
  const total = Object.values(boxState.boxCounts).reduce((a, b) => a + b, 0);
  
  const message = {
    type: 'BOXES_UPDATE',
    boxCounts: boxState.boxCounts,
    total: total,
    submissions: boxState.submissions
  };
  
  // Send to parent window
  if (window.parent !== window) {
    window.parent.postMessage(message, '*');
  }
  
  // Broadcast to siblings
  window.postMessage(message, '*');
}

/**
 * Listen for messages from form widget or parent
 */
window.addEventListener('message', (event) => {
  const data = event.data;
  
  if (data.type === 'PLEDGE_SUBMITTED') {
    // Animation handled by token-boxes-standalone.js.
    // Counter is intentionally NOT updated here — Firestore's onSnapshot
    // (syncFromFirestore) is the sole source of truth for the counter.
    // Calling addTokens here would cause a 2x count because Firestore's
    // optimistic local writes fire onSnapshot BEFORE the postMessage arrives.
  } else if (data.type === 'BOXES_UPDATE') {
    // Another box widget updated - sync state
    boxState.boxCounts = data.boxCounts || boxState.boxCounts;
    boxState.total = data.total;
    boxState.submissions = data.submissions || boxState.submissions;
    updateDisplay();
  } else if (data.type === 'UPDATE_BOXES') {
    // Manual update from parent (for demo controls)
    if (data.boxCounts) boxState.boxCounts = data.boxCounts;
    updateDisplay();
  } else if (data.type === 'SET_CELEBRATION_CONFIG') {
    // Celebration config from parent demo controls (via postMessage)
    celebrationConfig = { ...celebrationConfig, ...data.config };
    console.log('[JOM26] Celebration config updated via postMessage:', celebrationConfig);
  } else if (data.type === 'REQUEST_UPDATE') {
    broadcastUpdate();
  }
});

// Request updates from parent if in iframe
if (window.parent !== window) {
  window.parent.postMessage({ type: 'REQUEST_UPDATE' }, '*');
}

/**
 * Celebration checkpoint detection — checks whether any box or the total
 * has crossed a celebration threshold since the last check.
 * Called BEFORE updating boxState so we can compare old vs new.
 */
function checkCelebrationCheckpoints(newBoxCounts, newTotal) {
  // First call: record baseline values, don't trigger (prevents false
  // celebration on page load when counts are already past a threshold).
  if (!celebrationInitialized) {
    for (let i = 1; i <= 5; i++) prevCelebCounts[i] = newBoxCounts[i] || 0;
    prevCelebTotal = newTotal;
    celebrationInitialized = true;
    return;
  }

  if (!window.tokenBoxes) return;

  // Mode 1 — per-box checkpoint
  if (celebrationConfig.mode1Enabled && celebrationConfig.mode1Threshold > 0) {
    const t = celebrationConfig.mode1Threshold;
    for (let i = 1; i <= 5; i++) {
      const oldVal = prevCelebCounts[i] || 0;
      const newVal = newBoxCounts[i] || 0;
      if (Math.floor(newVal / t) > Math.floor(oldVal / t)) {
        console.log('[JOM26] Celebration! Box', i, 'crossed checkpoint', Math.floor(newVal / t) * t);
        window.tokenBoxes.triggerCelebration(i);
      }
    }
  }

  // Mode 2 — total token checkpoint
  if (celebrationConfig.mode2Enabled && celebrationConfig.mode2Threshold > 0) {
    const t = celebrationConfig.mode2Threshold;
    if (Math.floor(newTotal / t) > Math.floor(prevCelebTotal / t)) {
      console.log('[JOM26] Celebration! Total crossed checkpoint', Math.floor(newTotal / t) * t);
      window.tokenBoxes.triggerCelebrationAll();
    }
  }

  // Update previous values
  for (let i = 1; i <= 5; i++) prevCelebCounts[i] = newBoxCounts[i] || 0;
  prevCelebTotal = newTotal;
}

/**
 * Sync box counts from Firestore snapshot — keeps boxState in agreement with
 * the database so any subsequent updateDisplay() call shows the correct values.
 * Called by the Firestore listener in patch.html's inline module script.
 */
function syncFromFirestore(newBoxCounts, newTotal) {
  checkCelebrationCheckpoints(newBoxCounts, newTotal);
  boxState.boxCounts = { ...newBoxCounts };
  boxState.total = newTotal;
  updateDisplay();
}

/**
 * Called by token-boxes-standalone.js when a token lands (demo-local path).
 * Reads the current DOM counter values and checks celebration checkpoints
 * so celebrations work without Firestore.
 */
function onTokenLanded(boxNumber) {
  const counts = {};
  let total = 0;
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById('box' + i + '-count');
    counts[i] = el ? (parseInt(el.textContent.replace(/,/g, ''), 10) || 0) : 0;
    total += counts[i];
  }
  checkCelebrationCheckpoints(counts, total);
}

// Expose functions for external control (demo purposes)
window.JOM26TokenBoxes = {
  addTokens: addTokens,
  updateBoxCounts: updateBoxCounts,
  syncFromFirestore: syncFromFirestore,
  // Update internal boxState without touching DOM counters. Used when
  // token animation will handle the visual count-up via _tickCounter().
  syncStateOnly: (newBoxCounts, newTotal) => {
    boxState.boxCounts = { ...newBoxCounts };
    boxState.total = newTotal;
  },
  setCelebrationConfig: (config) => { celebrationConfig = { ...celebrationConfig, ...config }; },
  onTokenLanded: onTokenLanded,
  setSubmissionsCount: (count) => { boxState.submissions = count; },
  getState: () => ({ ...boxState })
};

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', init);
