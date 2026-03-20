/**
 * JOM26 Shout Out Widget
 *
 * Reads from public/shoutouts (Firestore, no auth required).
 * - New entries (arrived after this page loaded) are shown first.
 * - Once the new queue is exhausted, all entries cycle in a loop.
 * - Only school / organisation / community types are ever written here.
 */

import { db } from './widget-config.js';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ── Config ───────────────────────────────────────────────────────────────────
const HOLD_MS   = 4000;   // how long each name stays visible
const FADE_MS   = 420;    // fade in / fade out duration
const PAUSE_MS  = 380;    // silent gap between names

const TYPE_LABELS = {
  school:       '🏫 School',
  organisation: '🏢 Organisation',
  community:    '🌱 Community Group',
};

// ── State ────────────────────────────────────────────────────────────────────
// Unix seconds when this widget session started — used to classify "new" entries
const SESSION_START = Math.floor(Date.now() / 1000);

let allEntries = [];   // every entry, sorted oldest → newest
let newQueue   = [];   // entries that arrived after SESSION_START, not yet shown
let cycleIdx   = 0;    // round-robin pointer into allEntries
let running    = false;

// ── Elements ─────────────────────────────────────────────────────────────────
const nameEl  = document.getElementById('shoutout-name');
const typeEl  = document.getElementById('shoutout-type');
const emptyEl = document.getElementById('shoutout-empty');

// ── Helpers ──────────────────────────────────────────────────────────────────
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Cross-browser, reflow-safe fade for a single element.
 * Works by disabling the transition, snapping to fromOpacity/fromY,
 * forcing a reflow, then re-enabling the transition.
 */
function fade(el, fromOpacity, toOpacity, fromY, toY) {
  return new Promise(resolve => {
    el.style.transition = 'none';
    el.style.opacity    = fromOpacity;
    el.style.transform  = `translateY(${fromY}px)`;
    // Force reflow so the browser registers the starting state
    void el.offsetHeight;
    el.style.transition = `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`;
    el.style.opacity    = toOpacity;
    el.style.transform  = `translateY(${toY}px)`;
    setTimeout(resolve, FADE_MS);
  });
}

// ── Queue management ─────────────────────────────────────────────────────────
function getNextEntry() {
  // New arrivals take priority so live submissions appear immediately
  if (newQueue.length > 0) return newQueue.shift();
  // Then cycle through all entries indefinitely
  if (allEntries.length === 0) return null;
  const entry = allEntries[cycleIdx % allEntries.length];
  cycleIdx++;
  return entry;
}

// ── Display loop ─────────────────────────────────────────────────────────────
async function showLoop() {
  while (true) {
    const entry = getNextEntry();

    if (!entry) {
      // No entries available — stop and show empty placeholder
      running    = false;
      emptyEl.style.display = 'block';
      break;
    }

    emptyEl.style.display = 'none';

    // Populate content (invisible at this point)
    nameEl.textContent = entry.name || '—';
    typeEl.textContent = TYPE_LABELS[entry.type] || '';

    // Fade name in (from below)
    await fade(nameEl, 0, 1, 8, 0);

    // Fade type label in simultaneously — apply directly without another reflow trick
    typeEl.style.transition = `opacity ${FADE_MS}ms ease`;
    typeEl.style.opacity    = '0.8';

    // Hold
    await wait(HOLD_MS);

    // Fade both out (name floats upward)
    typeEl.style.transition = `opacity ${FADE_MS}ms ease`;
    typeEl.style.opacity    = '0';
    await fade(nameEl, 1, 0, 0, -8);

    // Brief silent pause before next name
    await wait(PAUSE_MS);
  }
}

function start() {
  if (running || allEntries.length === 0) return;
  running = true;
  showLoop();
}

// ── Firestore listener ───────────────────────────────────────────────────────
onSnapshot(doc(db, 'public', 'shoutouts'), (snap) => {
  if (!snap.exists()) {
    emptyEl.style.display = 'block';
    return;
  }

  const raw = (snap.data().entries || []).filter(e => e && e.name);

  // Sort chronologically (oldest first) so the cycle is consistent
  raw.sort((a, b) => (a.ts || 0) - (b.ts || 0));

  // Detect entries that arrived after this widget session started
  const knownKeys = new Set(allEntries.map(e => `${e.name}::${e.ts}`));
  raw
    .filter(e => (e.ts || 0) > SESSION_START)
    .filter(e => !knownKeys.has(`${e.name}::${e.ts}`))
    .forEach(e => newQueue.push(e));

  allEntries = raw;
  start();
});
