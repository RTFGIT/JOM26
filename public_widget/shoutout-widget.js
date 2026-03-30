/**
 * JOM26 Shout Out Widget (Carousel)
 *
 * Carousel layout: [prev · CURRENT NAME / Type · next]
 *   • The current entry is centred — full opacity, full scale.
 *   • The previous entry peeks in from the left — 40% opacity, scaled down.
 *   • The next entry peeks in from the right — 40% opacity, scaled down.
 *   • Opacity transitions smoothly: 40% → 100% as an item enters centre,
 *     and 100% → 40% as it moves to the left position.
 *   • Each slot shows the organisation name on one line and the type
 *     (School / Community / Organisation) in smaller text below it.
 *
 * Data source: Firestore `public/shoutouts` (public read, no auth required).
 */

import { db } from './widget-config.js';
import { doc, onSnapshot, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ── Config ───────────────────────────────────────────────────────────────────
const HOLD_MS = 3500;   // ms each entry stays in the centre
const ANIM_MS = 450;    // must match the CSS transition duration

// ── Banned words (loaded once, used to filter display) ───────────────────────
let bannedWords = [];
(async function loadBannedWords() {
  try {
    const snap = await getDoc(doc(db, 'public', 'banned-words'));
    if (snap.exists() && Array.isArray(snap.data().words)) {
      bannedWords = snap.data().words;
    }
  } catch (e) { /* ignore — show all if list can't be loaded */ }
})();

function isBanned(name) {
  const lower = name.toLowerCase();
  return bannedWords.some(word => lower.includes(word));
}

// ── State ────────────────────────────────────────────────────────────────────
let entries     = [];
let currIdx     = 0;
let isAnimating = false;
let rotateTimer = null;

// ── Helpers ───────────────────────────────────────────────────────────────────
function getEntry(offset) {
  if (!entries.length) return null;
  const n = entries.length;
  return entries[((currIdx + offset) % n + n) % n];
}

/**
 * Populates a slot element with a .c-name div and (if present) a .c-type div.
 * DOM construction avoids any XSS risk from user-supplied names.
 */
function setSlotContent(el, entry) {
  el.innerHTML = '';
  if (!entry) return;

  const nameEl = document.createElement('div');
  nameEl.className = 'c-name';
  nameEl.textContent = entry.name;
  el.appendChild(nameEl);

  if (entry.type) {
    const typeEl = document.createElement('div');
    typeEl.className = 'c-type';
    typeEl.textContent = entry.type.charAt(0).toUpperCase() + entry.type.slice(1);
    el.appendChild(typeEl);
  }
}

function getSlot(pos) {
  return viewport.querySelector(`.c-slot[data-pos="${pos}"]`);
}

// ── DOM: carousel viewport and 4-slot pool ────────────────────────────────────
const viewport = document.getElementById('carousel-viewport');
const emptyEl  = document.getElementById('shoutout-empty');

const slotEls = ['exit', 'prev', 'curr', 'next'].map(pos => {
  const el = document.createElement('div');
  el.className = 'c-slot';
  el.setAttribute('data-pos', pos);
  viewport.appendChild(el);
  return el;
});

// ── Render helpers ────────────────────────────────────────────────────────────
function renderSlots() {
  const has = entries.length > 0;
  emptyEl.style.display = has ? 'none' : 'flex';

  if (!has) {
    slotEls.forEach(s => { s.innerHTML = ''; });
    return;
  }

  setSlotContent(getSlot('prev'), getEntry(-1));
  setSlotContent(getSlot('curr'), getEntry(0));
  setSlotContent(getSlot('next'), getEntry(1));
  setSlotContent(getSlot('exit'), null);
}

// ── Carousel rotation ──────────────────────────────────────────────────────────
function rotate() {
  if (isAnimating || entries.length < 2) {
    scheduleNextRotation();
    return;
  }
  isAnimating = true;

  // Step 1: Instantly snap the "exit" slot to off-screen right ("enter"),
  //         load it with the content of the upcoming entry.
  const exitSlot = getSlot('exit');
  exitSlot.classList.remove('animating');
  exitSlot.setAttribute('data-pos', 'enter');
  setSlotContent(exitSlot, getEntry(2));

  // Step 2: Force layout reflow so the instant snap registers before transitions.
  viewport.getBoundingClientRect();

  // Step 3: Enable transitions, then shift all positions one step left.
  //         CSS handles opacity (0.4 ↔ 1.0) and scale smoothly.
  slotEls.forEach(s => s.classList.add('animating'));

  getSlot('prev').setAttribute('data-pos', 'exit');
  getSlot('curr').setAttribute('data-pos', 'prev');
  getSlot('next').setAttribute('data-pos', 'curr');
  getSlot('enter').setAttribute('data-pos', 'next');

  // Step 4: After transition, advance index and clean up.
  setTimeout(() => {
    currIdx = (currIdx + 1) % entries.length;

    const nowExit = getSlot('exit');
    nowExit.classList.remove('animating');
    setSlotContent(nowExit, null);

    slotEls.forEach(s => s.classList.remove('animating'));
    isAnimating = false;
    scheduleNextRotation();
  }, ANIM_MS);
}

function scheduleNextRotation() {
  clearTimeout(rotateTimer);
  if (entries.length >= 1) {
    rotateTimer = setTimeout(rotate, HOLD_MS);
  }
}

// ── Firestore listener ────────────────────────────────────────────────────────
onSnapshot(doc(db, 'public', 'shoutouts'), (snap) => {
  clearTimeout(rotateTimer);

  if (!snap.exists()) {
    entries = [];
    if (!isAnimating) renderSlots();
    scheduleNextRotation();
    return;
  }

  const raw = (snap.data().entries || []).filter(e => e && e.name && !isBanned(e.name));
  raw.sort((a, b) => (a.ts || 0) - (b.ts || 0));

  entries = raw;
  if (entries.length > 0) {
    currIdx = Math.min(currIdx, entries.length - 1);
  }

  if (!isAnimating) renderSlots();
  scheduleNextRotation();
});
