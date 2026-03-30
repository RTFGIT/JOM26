
// Firestore submission + totaliser update (Option C)
import { db } from './widget-config.js';
import {
  collection, addDoc, getDoc,
  serverTimestamp, doc, runTransaction, setDoc, arrayUnion
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

console.log('[JOM26] form-widget-submit.js loaded, db available:', !!db);

// Only these types are eligible for the shout-out feature
const SHOUTOUT_TYPES = ['school', 'organisation', 'community'];

// Banned words cache — loaded once, used to filter shoutout names
let bannedWordsCache = null;

async function loadBannedWords() {
  if (bannedWordsCache !== null) return bannedWordsCache;
  try {
    const snap = await getDoc(doc(db, 'public', 'banned-words'));
    bannedWordsCache = snap.exists() && Array.isArray(snap.data().words)
      ? snap.data().words
      : [];
  } catch (err) {
    console.warn('[JOM26] Could not load banned words:', err);
    bannedWordsCache = [];
  }
  return bannedWordsCache;
}

function containsBannedWord(text, bannedWords) {
  const lower = text.toLowerCase();
  return bannedWords.some(word => lower.includes(word));
}

function calculateTokens(userType, participantsCount) {
  switch (String(userType || '').toLowerCase()) {
    case 'individual':
    case 'other':
      return 1;
    case 'family':
    case 'school':
    case 'organisation':
    case 'community':
      return Math.min(100, Math.max(1, Number(participantsCount || 1)));
    default:
      return 1;
  }
}

export async function submitPledge({
  name, email, pledge, userType, familySize, participantsCount,
  childrenCount, childrenAges, pledgeApproach,
  newsletter, boxNumber, shoutout, displayName
}) {
  // Note: duplicate email check removed — submissions are now auth-read-only,
  // so an unauthenticated query would be denied. Duplicates can be filtered
  // at export time in the admin console.

  const tokens = calculateTokens(userType, participantsCount || familySize);
  const boxNum = parseInt(boxNumber) || 1;

  // 1) Write submission document
  await addDoc(collection(db, 'submissions'), {
    name:               name || null,
    email,
    pledge,
    user_type:          userType,
    participants_count: participantsCount ? Number(participantsCount) : null,
    children_count:     childrenCount ? Number(childrenCount) : null,
    children_ages:      childrenAges || null,
    pledge_approach:    pledgeApproach || null,
    box_number:         boxNum,
    tokens,
    newsletter_opt_in:  Boolean(newsletter),
    shoutout_opt_in:    Boolean(shoutout),
    created_at:         serverTimestamp()
  });

  // 2) Atomic increment of box-specific counter, total_tokens, and submission_count
  const totalRef = doc(db, 'public', 'totaliser');
  const boxKey   = `box${boxNum}`;

  await runTransaction(db, async (t) => {
    const snap    = await t.get(totalRef);
    const current = snap.exists() ? (snap.data() || {}) : {};

    const currentBoxCount    = current[boxKey]          || 0;
    const currentTotal       = current.total_tokens      || 0;
    const currentSubmissions = current.submission_count  || 0;

    // Use set+merge so the document is created automatically if it doesn't exist yet.
    // submission_count lives here (not on the submissions collection) so the patch
    // widget can read it without requiring auth.
    t.set(totalRef, {
      [boxKey]:          currentBoxCount    + tokens,
      total_tokens:      currentTotal       + tokens,
      submission_count:  currentSubmissions + 1
    }, { merge: true });
  });

  // 3) If the user opted in to the shout-out, append their group name to public/shoutouts.
  //    We verify the user type server-side here so non-eligible types can never appear
  //    even if somehow the checkbox value were tampered with.
  //    Names containing banned words are silently skipped (no error to the user).
  if (shoutout && displayName && SHOUTOUT_TYPES.includes(userType)) {
    const bannedWords = await loadBannedWords();
    if (!containsBannedWord(displayName, bannedWords)) {
      const shoutoutsRef = doc(db, 'public', 'shoutouts');
      await setDoc(shoutoutsRef, {
        entries: arrayUnion({
          name: displayName,
          type: userType,
          ts:   Math.floor(Date.now() / 1000)   // Unix seconds — used by widget to detect "new" arrivals
        })
      }, { merge: true });
    }
  }

  return { tokens, boxNumber: boxNum };
}

/**
 * Load pledge options from Firestore (public/pledge-options).
 * Returns an array of strings, or null if the document doesn't exist.
 */
export async function loadPledgeOptions() {
  try {
    const snap = await getDoc(doc(db, 'public', 'pledge-options'));
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.options) && data.options.length > 0) {
        return data.options;
      }
    }
  } catch (err) {
    console.warn('[JOM26] Could not load pledge options from Firestore:', err);
  }
  return null;
}

// Global hook for Option C (F1): your existing form-widget-app.js can call this
window.JOM = window.JOM || {};
window.JOM.submitPledgeWithFirestore = async (payload) => submitPledge(payload);
