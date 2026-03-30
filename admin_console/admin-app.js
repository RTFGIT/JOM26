/**
 * JOM26 Admin Console
 * Firebase Email/Password Auth + Firestore submissions viewer + CSV export
 * Admin accounts are managed in Firebase Console → Authentication → Users.
 * No email addresses are stored in this file.
 */

import { initializeApp }          from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, collection, getDocs, query, orderBy, doc, getDoc, setDoc, onSnapshot }
                                   from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged }
                                   from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

// ─────────────────────────────────────────────────────────────────────────────
// Firebase initialisation
// ─────────────────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            'AIzaSyC8pzBOqExWyNNx3OOssPAAmC8XgcobO8M',
  authDomain:        'rtfjom26.firebaseapp.com',
  projectId:         'rtfjom26',
  storageBucket:     'rtfjom26.firebasestorage.app',
  messagingSenderId: '901133745338',
  appId:             '1:901133745338:web:6cbf4a556108b599879683',
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────
let allSubmissions = [];   // raw data from Firestore
let sortKey        = 'created_at';
let sortDir        = 'desc';  // 'asc' | 'desc'

// ─────────────────────────────────────────────────────────────────────────────
// DOM refs
// ─────────────────────────────────────────────────────────────────────────────
const loginScreen     = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const signInBtn       = document.getElementById('sign-in-btn');
const signOutBtn      = document.getElementById('sign-out-btn');
const loginError      = document.getElementById('login-error');
const userEmailEl     = document.getElementById('user-email');
const tableWrapper    = document.getElementById('table-body-wrapper');
const tableCount      = document.getElementById('table-count');
const searchInput     = document.getElementById('search-input');
const filterBox       = document.getElementById('filter-box');
const filterType      = document.getElementById('filter-type');
const filterNewsletter= document.getElementById('filter-newsletter');
const filterDupes     = document.getElementById('filter-dupes');
const exportAllBtn    = document.getElementById('export-all-btn');
const exportNewsBtn   = document.getElementById('export-newsletter-btn');
const refreshBtn      = document.getElementById('refresh-btn');

// ─────────────────────────────────────────────────────────────────────────────
// Auth — Email / Password
// ─────────────────────────────────────────────────────────────────────────────
signInBtn.addEventListener('click', async () => {
  const email    = document.getElementById('admin-email').value.trim();
  const password = document.getElementById('admin-password').value;

  if (!email || !password) {
    showLoginError('Please enter your email address and password.');
    return;
  }

  loginError.style.display = 'none';
  signInBtn.textContent = 'Signing in…';
  signInBtn.disabled = true;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged will handle the rest
  } catch (err) {
    const friendlyMsg =
      err.code === 'auth/wrong-password'      ||
      err.code === 'auth/user-not-found'      ||
      err.code === 'auth/invalid-credential'  ||
      err.code === 'auth/invalid-email'
        ? 'Incorrect email or password. Please try again.'
        : 'Sign-in failed. Please check your connection and try again.';
    showLoginError(friendlyMsg);
    signInBtn.textContent = 'Sign In';
    signInBtn.disabled = false;
  }
});

// Allow pressing Enter in the password field to submit
document.getElementById('admin-password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') signInBtn.click();
});
document.getElementById('admin-email').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('admin-password').focus();
});

signOutBtn.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showLogin();
    return;
  }

  // Access is controlled entirely by Firebase Authentication.
  // Add / remove admin users in Firebase Console → Authentication → Users.
  showDashboard(user.email);
  await loadSubmissions();
  loadCelebrationConfig();
  loadPledgeOptions();
  loadBannedWords();
  loadLaunchConfig();
});

function showLogin() {
  loginScreen.style.display     = 'flex';
  dashboardScreen.style.display = 'none';
  signInBtn.textContent = 'Sign In';
  signInBtn.disabled = false;
}

function showLoginError(msg) {
  loginError.textContent   = msg;
  loginError.style.display = 'block';
}

function showDashboard(email) {
  loginScreen.style.display     = 'none';
  dashboardScreen.style.display = 'block';
  loginError.style.display      = 'none';
  userEmailEl.textContent       = email;
}

// ─────────────────────────────────────────────────────────────────────────────
// Load submissions from Firestore
// ─────────────────────────────────────────────────────────────────────────────
async function loadSubmissions() {
  tableWrapper.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading submissions…</p>
    </div>`;
  tableCount.textContent = 'Loading…';

  try {
    const q    = query(collection(db, 'submissions'), orderBy('created_at', 'desc'));
    const snap = await getDocs(q);
    allSubmissions = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    updateStats();
    renderTable();
  } catch (err) {
    console.error('Failed to load submissions:', err);
    tableWrapper.innerHTML = `
      <div class="empty-state">
        <div class="icon">⚠️</div>
        <p>Failed to load submissions. Check your connection and try refreshing.</p>
      </div>`;
    tableCount.textContent = 'Error loading data';
  }
}

refreshBtn.addEventListener('click', loadSubmissions);

// ─────────────────────────────────────────────────────────────────────────────
// Stats
// ─────────────────────────────────────────────────────────────────────────────
function updateStats() {
  const total      = allSubmissions.length;
  const tokens     = allSubmissions.reduce((s, r) => s + (Number(r.tokens) || 0), 0);
  const newsletter = allSubmissions.filter(r => r.newsletter_opt_in).length;

  // Duplicate detection across ALL submissions
  const emailCounts = {};
  allSubmissions.forEach(r => {
    const e = (r.email || '').toLowerCase();
    emailCounts[e] = (emailCounts[e] || 0) + 1;
  });
  const dupeCount = Object.values(emailCounts).filter(c => c > 1).length;

  const boxTotals = { 1:0, 2:0, 3:0, 4:0, 5:0 };
  allSubmissions.forEach(r => {
    const b = parseInt(r.box_number);
    if (b >= 1 && b <= 5) boxTotals[b]++;
  });

  document.getElementById('stat-submissions').textContent = total.toLocaleString();
  document.getElementById('stat-tokens').textContent      = tokens.toLocaleString();
  document.getElementById('stat-newsletter').textContent  = newsletter.toLocaleString();
  document.getElementById('stat-duplicates').textContent  = dupeCount.toLocaleString();
  for (let i = 1; i <= 5; i++) {
    document.getElementById(`stat-box${i}`).textContent = boxTotals[i].toLocaleString();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter + sort
// ─────────────────────────────────────────────────────────────────────────────
function getFiltered() {
  const search    = searchInput.value.trim().toLowerCase();
  const boxVal    = filterBox.value;
  const typeVal   = filterType.value.toLowerCase();
  const newsOnly  = filterNewsletter.checked;
  const dupesOnly = filterDupes.checked;

  // Build duplicate email set
  const emailCounts = {};
  allSubmissions.forEach(r => {
    const e = (r.email || '').toLowerCase();
    emailCounts[e] = (emailCounts[e] || 0) + 1;
  });
  const dupeEmails = new Set(
    Object.entries(emailCounts).filter(([,c]) => c > 1).map(([e]) => e)
  );

  let rows = allSubmissions.filter(r => {
    if (search) {
      const name  = (r.name  || '').toLowerCase();
      const email = (r.email || '').toLowerCase();
      if (!name.includes(search) && !email.includes(search)) return false;
    }
    if (boxVal  && String(r.box_number) !== boxVal)             return false;
    if (typeVal && (r.user_type || '').toLowerCase() !== typeVal) return false;
    if (newsOnly  && !r.newsletter_opt_in)                      return false;
    if (dupesOnly && !dupeEmails.has((r.email || '').toLowerCase())) return false;
    return true;
  });

  // Sort
  rows = rows.sort((a, b) => {
    let va = a[sortKey], vb = b[sortKey];
    if (sortKey === 'created_at') {
      va = va?.seconds ?? 0;
      vb = vb?.seconds ?? 0;
    } else if (typeof va === 'string') {
      va = va.toLowerCase();
      vb = (vb || '').toLowerCase();
    } else {
      va = va ?? 0;
      vb = vb ?? 0;
    }
    if (va < vb) return sortDir === 'asc' ?  -1 : 1;
    if (va > vb) return sortDir === 'asc' ?   1 : -1;
    return 0;
  });

  return { rows, dupeEmails };
}

// ─────────────────────────────────────────────────────────────────────────────
// Render table
// ─────────────────────────────────────────────────────────────────────────────
const COLUMNS = [
  { key: 'created_at',        label: 'Date / Time' },
  { key: 'name',              label: 'Name' },
  { key: 'email',             label: 'Email' },
  { key: 'user_type',         label: 'Type' },
  { key: 'participants_count', label: 'Participants' },
  { key: 'box_number',        label: 'Box' },
  { key: 'tokens',            label: 'Tokens' },
  { key: 'pledge_approach',   label: 'Approach' },
  { key: 'newsletter_opt_in', label: 'Newsletter' },
];

function renderTable() {
  const { rows, dupeEmails } = getFiltered();

  tableCount.textContent = `${rows.length.toLocaleString()} of ${allSubmissions.length.toLocaleString()} submission${allSubmissions.length !== 1 ? 's' : ''}`;

  if (rows.length === 0) {
    tableWrapper.innerHTML = `
      <div class="empty-state">
        <div class="icon">📭</div>
        <p>No submissions match the current filters.</p>
      </div>`;
    return;
  }

  const headerCells = COLUMNS.map(col => {
    const cls = col.key === sortKey ? `sort-${sortDir}` : '';
    return `<th class="${cls}" data-key="${col.key}">${col.label}</th>`;
  }).join('');

  const bodyRows = rows.map(r => {
    const isDupe   = dupeEmails.has((r.email || '').toLowerCase());
    const rowClass = isDupe ? 'duplicate-row' : '';
    const date = r.created_at?.seconds
      ? new Date(r.created_at.seconds * 1000).toLocaleString('en-GB', {
          day:'2-digit', month:'short', year:'numeric',
          hour:'2-digit', minute:'2-digit'
        })
      : '—';

    const dupeBadge = isDupe ? `<span class="badge badge-dup">DUP</span>` : '';

    return `<tr class="${rowClass}">
      <td style="white-space:nowrap">${date}</td>
      <td>${escapeHtml(r.name || '—')}</td>
      <td>${escapeHtml(r.email || '—')}${dupeBadge}</td>
      <td><span class="type-chip">${escapeHtml(String(r.user_type || '—'))}</span></td>
      <td style="text-align:center">${escapeHtml(String(r.participants_count ?? '—'))}</td>
      <td style="text-align:center"><span class="badge badge-box">Box ${escapeHtml(String(r.box_number ?? '?'))}</span></td>
      <td style="text-align:center">${escapeHtml(String(r.tokens ?? '—'))}</td>
      <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(r.pledge_approach || '')}">${escapeHtml(r.pledge_approach || '—')}</td>
      <td style="text-align:center">
        <span class="badge ${r.newsletter_opt_in ? 'badge-yes' : 'badge-no'}">
          ${r.newsletter_opt_in ? 'Yes' : 'No'}
        </span>
      </td>
    </tr>`;
  }).join('');

  tableWrapper.innerHTML = `
    <div class="table-scroll">
      <table>
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>`;

  // Sort on header click
  tableWrapper.querySelectorAll('thead th').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.key;
      if (sortKey === key) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortKey = key;
        sortDir = key === 'created_at' ? 'desc' : 'asc';
      }
      renderTable();
    });
  });
}

// Re-render on filter changes
[searchInput, filterBox, filterType, filterNewsletter, filterDupes].forEach(el => {
  el.addEventListener('input',  renderTable);
  el.addEventListener('change', renderTable);
});

// ─────────────────────────────────────────────────────────────────────────────
// CSV Export
// ─────────────────────────────────────────────────────────────────────────────
exportAllBtn.addEventListener('click', () => {
  const { rows } = getFiltered();
  downloadCSV(rows, `JOM26_submissions_${dateStamp()}.csv`);
});

exportNewsBtn.addEventListener('click', () => {
  const { rows } = getFiltered();
  const newsRows = rows.filter(r => r.newsletter_opt_in);
  downloadCSV(newsRows, `JOM26_newsletter_${dateStamp()}.csv`);
});

function downloadCSV(rows, filename) {
  if (rows.length === 0) {
    alert('No rows to export with the current filters.');
    return;
  }

  const headers = [
    'Date', 'Name', 'Email', 'Type', 'Participants', 'Box', 'Tokens', 'Pledge Approach', 'Newsletter'
  ];

  const csvRows = rows.map(r => {
    const date = r.created_at?.seconds
      ? new Date(r.created_at.seconds * 1000).toISOString()
      : '';
    return [
      date,
      r.name             || '',
      r.email            || '',
      r.user_type        || '',
      r.participants_count ?? '',
      r.box_number       ?? '',
      r.tokens           ?? '',
      r.pledge_approach  || '',
      r.newsletter_opt_in ? 'Yes' : 'No',
    ].map(csvEscape).join(',');
  });

  const content = [headers.join(','), ...csvRows].join('\n');
  const blob    = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href        = url;
  a.download    = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// Celebration checkpoint config
// ─────────────────────────────────────────────────────────────────────────────
async function loadCelebrationConfig() {
  try {
    const snap = await getDoc(doc(db, 'public', 'celebration-config'));
    const data = snap.exists() ? snap.data() : {};
    document.getElementById('mode1-enabled').checked   = data.mode1_enabled   ?? false;
    document.getElementById('mode1-threshold').value    = data.mode1_threshold ?? 25;
    document.getElementById('mode2-enabled').checked    = data.mode2_enabled   ?? false;
    document.getElementById('mode2-threshold').value    = data.mode2_threshold ?? 100;
  } catch (err) {
    console.error('Failed to load celebration config:', err);
  }
}

document.getElementById('save-celebration-btn').addEventListener('click', async () => {
  const btn    = document.getElementById('save-celebration-btn');
  const status = document.getElementById('celebration-save-status');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  const config = {
    mode1_enabled:   document.getElementById('mode1-enabled').checked,
    mode1_threshold: parseInt(document.getElementById('mode1-threshold').value) || 25,
    mode2_enabled:   document.getElementById('mode2-enabled').checked,
    mode2_threshold: parseInt(document.getElementById('mode2-threshold').value) || 100,
  };

  try {
    await setDoc(doc(db, 'public', 'celebration-config'), config);
    status.textContent = '✓ Saved!';
    status.style.color = '#2E7D32';
  } catch (err) {
    status.textContent = 'Error saving';
    status.style.color = '#C62828';
    console.error('Failed to save celebration config:', err);
  }

  btn.disabled = false;
  btn.textContent = 'Save';
  setTimeout(() => { status.textContent = ''; }, 3000);
});

// ─────────────────────────────────────────────────────────────────────────────
// Pledge options config
// ─────────────────────────────────────────────────────────────────────────────
const pledgeOptionsList  = document.getElementById('pledge-options-list');
const addPledgeOptionBtn = document.getElementById('add-pledge-option-btn');
const savePledgeOptsBtn  = document.getElementById('save-pledge-options-btn');
const pledgeOptStatus    = document.getElementById('pledge-options-save-status');

function renderPledgeOptionRow(value) {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex; gap:0.5rem; align-items:center;';
  row.innerHTML = `
    <input type="text" value="${escapeHtml(value)}"
      style="flex:1; padding:0.5rem 0.75rem; border:2px solid #E0E0E0; border-radius:8px; font-size:0.9rem; font-family:inherit;"
      class="pledge-option-input">
    <button type="button" class="btn btn-sm" style="background:#FFEBEE; color:#C62828; border:none; cursor:pointer;"
      onclick="this.parentElement.remove()">✕</button>`;
  pledgeOptionsList.appendChild(row);
}

async function loadPledgeOptions() {
  try {
    const snap = await getDoc(doc(db, 'public', 'pledge-options'));
    const data = snap.exists() ? snap.data() : {};
    const opts = Array.isArray(data.options) ? data.options : [
      'Just one more... In your Shopping Basket',
      'Just one more... In your Garden',
      'Just one more... Extra Veg On your Plate',
      'Just one more... As your meal',
      'Just one more... As a Snack'
    ];
    pledgeOptionsList.innerHTML = '';
    opts.forEach(o => renderPledgeOptionRow(o));
  } catch (err) {
    console.error('Failed to load pledge options:', err);
  }
}

addPledgeOptionBtn.addEventListener('click', () => {
  renderPledgeOptionRow('');
  // Focus the new input
  const inputs = pledgeOptionsList.querySelectorAll('.pledge-option-input');
  if (inputs.length) inputs[inputs.length - 1].focus();
});

savePledgeOptsBtn.addEventListener('click', async () => {
  savePledgeOptsBtn.disabled = true;
  savePledgeOptsBtn.textContent = 'Saving…';

  const inputs = pledgeOptionsList.querySelectorAll('.pledge-option-input');
  const options = Array.from(inputs).map(i => i.value.trim()).filter(v => v.length > 0);

  if (options.length === 0) {
    pledgeOptStatus.textContent = 'Add at least one option';
    pledgeOptStatus.style.color = '#C62828';
    savePledgeOptsBtn.disabled = false;
    savePledgeOptsBtn.textContent = 'Save Pledge Options';
    setTimeout(() => { pledgeOptStatus.textContent = ''; }, 3000);
    return;
  }

  try {
    await setDoc(doc(db, 'public', 'pledge-options'), { options });
    pledgeOptStatus.textContent = '✓ Saved!';
    pledgeOptStatus.style.color = '#2E7D32';
  } catch (err) {
    pledgeOptStatus.textContent = 'Error saving';
    pledgeOptStatus.style.color = '#C62828';
    console.error('Failed to save pledge options:', err);
  }

  savePledgeOptsBtn.disabled = false;
  savePledgeOptsBtn.textContent = 'Save Pledge Options';
  setTimeout(() => { pledgeOptStatus.textContent = ''; }, 3000);
});

// ─────────────────────────────────────────────────────────────────────────────
// Banned words (shoutout filter)
// ─────────────────────────────────────────────────────────────────────────────
const bannedWordsInput  = document.getElementById('banned-words-input');
const saveBannedWordsBtn = document.getElementById('save-banned-words-btn');
const bannedWordsStatus  = document.getElementById('banned-words-save-status');

async function loadBannedWords() {
  try {
    const snap = await getDoc(doc(db, 'system', 'banned-words'));
    const data = snap.exists() ? snap.data() : {};
    const words = Array.isArray(data.words) ? data.words : [];
    bannedWordsInput.value = words.join('\n');
  } catch (err) {
    console.error('Failed to load banned words:', err);
  }
}

saveBannedWordsBtn.addEventListener('click', async () => {
  saveBannedWordsBtn.disabled = true;
  saveBannedWordsBtn.textContent = 'Saving…';

  const words = bannedWordsInput.value
    .split('\n')
    .map(w => w.trim().toLowerCase())
    .filter(w => w.length > 0);

  // Deduplicate
  const unique = [...new Set(words)];

  try {
    // Save to system (admin-only) and public (widget-readable) copies
    await setDoc(doc(db, 'system', 'banned-words'), { words: unique });
    await setDoc(doc(db, 'public', 'banned-words'), { words: unique });
    bannedWordsInput.value = unique.join('\n');
    bannedWordsStatus.textContent = '✓ Saved!';
    bannedWordsStatus.style.color = '#2E7D32';
  } catch (err) {
    bannedWordsStatus.textContent = 'Error saving';
    bannedWordsStatus.style.color = '#C62828';
    console.error('Failed to save banned words:', err);
  }

  saveBannedWordsBtn.disabled = false;
  saveBannedWordsBtn.textContent = 'Save Banned Words';
  setTimeout(() => { bannedWordsStatus.textContent = ''; }, 3000);
});

// ─────────────────────────────────────────────────────────────────────────────
// Launch config (holding screen / go-live controls)
// ─────────────────────────────────────────────────────────────────────────────
const campaignLiveEl   = document.getElementById('campaign-live');
const launchDateEl     = document.getElementById('launch-date');
const launchTimeEl     = document.getElementById('launch-time');
const liveIndicatorEl  = document.getElementById('campaign-live-indicator');
const holdingCountEl   = document.getElementById('holding-interest-count');
const saveLaunchBtn    = document.getElementById('save-launch-btn');
const goLiveBtn        = document.getElementById('go-live-btn');
const revertHoldingBtn = document.getElementById('revert-holding-btn');
const launchStatusEl   = document.getElementById('launch-save-status');

// Set minimum date/time to now so admin can't schedule in the past
function enforceMinDateTime() {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  launchDateEl.setAttribute('min', todayStr);

  // If selected date is today, enforce min time too
  if (launchDateEl.value === todayStr) {
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    launchTimeEl.setAttribute('min', hh + ':' + mm);
  } else {
    launchTimeEl.removeAttribute('min');
  }
}

launchDateEl.addEventListener('change', enforceMinDateTime);
launchTimeEl.addEventListener('change', enforceMinDateTime);

// Determine effective live state: flag OR past launch time
function isEffectivelyLive(data) {
  if (data.campaign_live) return true;
  const d = data.launch_date || '2099-12-31';
  const t = data.launch_time || '09:00';
  return new Date() >= new Date(d + 'T' + t);
}

function updateLiveUI(data) {
  const live = isEffectivelyLive(data);

  // Indicator badge
  if (live) {
    liveIndicatorEl.textContent = 'LIVE';
    liveIndicatorEl.style.background = '#E8F5E9';
    liveIndicatorEl.style.color = '#2E7D32';
  } else {
    liveIndicatorEl.textContent = 'HOLDING';
    liveIndicatorEl.style.background = '#FFF3E0';
    liveIndicatorEl.style.color = '#E65100';
  }

  // Show the relevant action button, hide the other
  goLiveBtn.style.display        = live ? 'none' : '';
  revertHoldingBtn.style.display = live ? '' : 'none';

  // Checkbox reflects the Firestore flag
  campaignLiveEl.checked = data.campaign_live ?? false;
}

async function loadLaunchConfig() {
  try {
    const snap = await getDoc(doc(db, 'public', 'launch-config'));
    const data = snap.exists() ? snap.data() : {};
    launchDateEl.value = data.launch_date ?? '2026-04-01';
    launchTimeEl.value = data.launch_time ?? '09:00';
    updateLiveUI(data);
    enforceMinDateTime();
  } catch (err) {
    console.error('Failed to load launch config:', err);
  }

  // Real-time listener — keeps UI in sync across multiple admin sessions
  onSnapshot(doc(db, 'public', 'launch-config'), (snap) => {
    const data = snap.data() || {};
    holdingCountEl.textContent = (data.holding_interest || 0).toLocaleString();
    launchDateEl.value = data.launch_date ?? launchDateEl.value;
    launchTimeEl.value = data.launch_time ?? launchTimeEl.value;
    updateLiveUI(data);
    enforceMinDateTime();
  });
}

// Checkbox change — just a preview, doesn't save until Save is clicked
campaignLiveEl.addEventListener('change', () => {
  const previewData = {
    campaign_live: campaignLiveEl.checked,
    launch_date: launchDateEl.value,
    launch_time: launchTimeEl.value
  };
  updateLiveUI(previewData);
});

saveLaunchBtn.addEventListener('click', async () => {
  // Validate date/time not in the past (unless going live now)
  if (!campaignLiveEl.checked) {
    const target = new Date(launchDateEl.value + 'T' + launchTimeEl.value);
    if (target <= new Date()) {
      launchStatusEl.textContent = 'Launch date/time must be in the future';
      launchStatusEl.style.color = '#C62828';
      setTimeout(() => { launchStatusEl.textContent = ''; }, 4000);
      return;
    }
  }

  saveLaunchBtn.disabled = true;
  saveLaunchBtn.textContent = 'Saving…';

  const config = {
    campaign_live: campaignLiveEl.checked,
    launch_date:   launchDateEl.value,
    launch_time:   launchTimeEl.value,
  };

  try {
    await setDoc(doc(db, 'public', 'launch-config'), config, { merge: true });
    launchStatusEl.textContent = '✓ Saved!';
    launchStatusEl.style.color = '#2E7D32';
  } catch (err) {
    launchStatusEl.textContent = 'Error saving';
    launchStatusEl.style.color = '#C62828';
    console.error('Failed to save launch config:', err);
  }

  saveLaunchBtn.disabled = false;
  saveLaunchBtn.textContent = 'Save Launch Settings';
  setTimeout(() => { launchStatusEl.textContent = ''; }, 3000);
});

revertHoldingBtn.addEventListener('click', async () => {
  if (!confirm('Revert to holding screen? All widgets will switch back to pre-launch mode.')) return;

  revertHoldingBtn.disabled = true;
  revertHoldingBtn.textContent = 'Reverting…';

  // Set campaign_live false AND push the launch date into the future
  // so the auto-launch-by-time logic doesn't immediately re-launch
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const futureDate = tomorrow.toISOString().slice(0, 10);

  try {
    await setDoc(doc(db, 'public', 'launch-config'), {
      campaign_live: false,
      launch_date: futureDate,
      launch_time: launchTimeEl.value
    }, { merge: true });
    launchStatusEl.textContent = '⏪ Reverted to holding — launch date set to ' + futureDate;
    launchStatusEl.style.color = '#E65100';
  } catch (err) {
    launchStatusEl.textContent = 'Error reverting';
    launchStatusEl.style.color = '#C62828';
    console.error('Failed to revert to holding:', err);
  }

  revertHoldingBtn.disabled = false;
  revertHoldingBtn.textContent = '⏪ Revert to Holding';
  setTimeout(() => { launchStatusEl.textContent = ''; }, 5000);
});

goLiveBtn.addEventListener('click', async () => {
  if (!confirm('Go live now? This will switch all widgets from holding screen to live campaign mode.')) return;

  goLiveBtn.disabled = true;
  goLiveBtn.textContent = 'Going live…';

  try {
    await setDoc(doc(db, 'public', 'launch-config'), { campaign_live: true }, { merge: true });
    launchStatusEl.textContent = '🚀 Campaign is LIVE!';
    launchStatusEl.style.color = '#2E7D32';
  } catch (err) {
    launchStatusEl.textContent = 'Error going live';
    launchStatusEl.style.color = '#C62828';
    console.error('Failed to go live:', err);
  }

  goLiveBtn.disabled = false;
  goLiveBtn.textContent = '🚀 Go Live Now';
  setTimeout(() => { launchStatusEl.textContent = ''; }, 5000);
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function csvEscape(val) {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}
