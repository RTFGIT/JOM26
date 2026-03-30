
import { db } from './widget-config.js';
import { doc, onSnapshot, getDoc, setDoc, increment } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let previousBoxCounts = null;

export function startBoxTotaliserListener(updateFn) {
  const ref = doc(db, 'public', 'totaliser');
  
  return onSnapshot(ref, (snap) => {
    const data = snap.data() || { 
      box1: 0, 
      box2: 0, 
      box3: 0, 
      box4: 0, 
      box5: 0,
      total_tokens: 0 
    };
    
    const boxCounts = {
      1: data.box1 || 0,
      2: data.box2 || 0,
      3: data.box3 || 0,
      4: data.box4 || 0,
      5: data.box5 || 0
    };
    
    const total = data.total_tokens || 
      (boxCounts[1] + boxCounts[2] + boxCounts[3] + boxCounts[4] + boxCounts[5]);
    
    // Calculate per-box increase since last snapshot so the patch widget
    // can trigger the correct number of token animations per box.
    const delta = {};
    let isUpdate = false;
    if (previousBoxCounts !== null) {
      for (let i = 1; i <= 5; i++) {
        const diff = (boxCounts[i] || 0) - (previousBoxCounts[i] || 0);
        if (diff > 0) {
          delta[i] = diff;
          isUpdate = true;
        }
      }
    }

    previousBoxCounts = { ...boxCounts };

    updateFn({ boxCounts, total, isUpdate, delta });
  });
}

export function startCelebrationConfigListener(updateFn) {
  const ref = doc(db, 'public', 'celebration-config');
  return onSnapshot(ref, (snap) => {
    const data = snap.data() || {};
    updateFn({
      mode1Enabled:   data.mode1_enabled   ?? false,
      mode1Threshold: data.mode1_threshold ?? 25,
      mode2Enabled:   data.mode2_enabled   ?? false,
      mode2Threshold: data.mode2_threshold ?? 100
    });
  });
}

// ── Launch config listener — real-time holding/live state from admin console ──
export function startLaunchConfigListener(updateFn) {
  const ref = doc(db, 'public', 'launch-config');
  return onSnapshot(ref, (snap) => {
    const data = snap.data() || {};
    updateFn({
      campaignLive:  data.campaign_live ?? false,
      launchDate:    data.launch_date   ?? '2026-04-01',
      launchTime:    data.launch_time   ?? '09:00',
      holdingInterest: data.holding_interest ?? 0
    });
  });
}

// ── Increment holding interest counter — called when user clicks "Add Veg" ──
export async function incrementHoldingInterest() {
  const ref = doc(db, 'public', 'launch-config');
  try {
    await setDoc(ref, { holding_interest: increment(1) }, { merge: true });
  } catch (err) {
    console.error('[JOM26] Failed to increment holding interest:', err);
  }
}

export async function fetchSubmissionCount() {
  // Reads submission_count from public/totaliser — no auth required.
  // The submissions collection itself now requires auth for reads (security rule),
  // so we track the count here instead to keep the patch widget working publicly.
  const snap = await getDoc(doc(db, 'public', 'totaliser'));
  return snap.exists() ? (snap.data().submission_count || 0) : 0;
}
