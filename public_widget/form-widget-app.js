/**
 * JOM26 Form Widget - Standalone with PostMessage
 */

console.log('[JOM26] Form widget loading...');

// Default pledge options — shared across all user types.
// These are overridden at runtime if Firestore doc public/pledge-options exists.
var defaultPledgeOptions = [
  "Just one more... In your Shopping Basket",
  "Just one more... In your Garden",
  "Just one more... Extra Veg On your Plate",
  "Just one more... As your meal",
  "Just one more... As a Snack"
];

// Live pledge options — starts as defaults, replaced by Firestore data when available
var livePledgeOptions = defaultPledgeOptions.slice();

// Pathway field configurations
// Fields sharing the same `row` key are rendered side-by-side in a .form-row div.
// Shared pledge-approach field appended to every pathway
const PLEDGE_APPROACH_FIELD = { id: 'pledge_approach', label: 'How will you approach your pledge?', type: 'textarea', required: false };

const pathwayFields = {
  individual: [
    PLEDGE_APPROACH_FIELD
  ],
  family: [
    { id: 'participants_count', label: 'How many family members are taking part?', type: 'number', required: true, min: 1, max: 20 },
    { id: 'children_count', label: 'How many children?', type: 'number', required: true, min: 0, max: 20 },
    // Dynamic child age fields are rendered by renderChildAgeFields() — not in this config
    PLEDGE_APPROACH_FIELD
  ],
  school: [
    { id: 'school_name',  label: 'School Name',       type: 'text',   required: true },
    { id: 'class_name',   label: 'Class/Year Group',   type: 'text',   required: true,  row: 'sc1' },
    { id: 'class_size',   label: 'Number of Students', type: 'number', required: true,  row: 'sc1', min: 1, max: 100 },
    PLEDGE_APPROACH_FIELD
  ],
  organisation: [
    { id: 'org_name', label: 'Organisation Name', type: 'text',   required: true,  row: 'or1' },
    { id: 'org_type', label: 'Organisation Type', type: 'select', required: true,  row: 'or1',
      options: ['Business', 'Non-profit', 'Government', 'Healthcare', 'Education', 'Other'] },
    { id: 'org_size', label: 'Number of Participants', type: 'number', required: false, min: 1, max: 1000 },
    PLEDGE_APPROACH_FIELD
  ],
  community: [
    { id: 'group_name', label: 'Group Name', type: 'text',   required: true, row: 'co1' },
    { id: 'group_size', label: 'Group Size', type: 'number', required: true, row: 'co1', min: 1, max: 100 },
    PLEDGE_APPROACH_FIELD
  ],
  other: [
    { id: 'description', label: 'Description', type: 'textarea', required: false },
    PLEDGE_APPROACH_FIELD
  ]
};

// Download resource ZIP archives per user type — served from the GitHub repo.
// Paths are relative to the repo root on GitHub Pages.
// When adding/removing files from a folder, re-zip the folder to update.
const DOWNLOAD_URLS = {
  individual:   '/JOM26/Resources_downloads/individuals.zip',
  family:       '/JOM26/Resources_downloads/families-resources.zip',
  school:       '/JOM26/Resources_downloads/schools-resources.zip',
  organisation: '/JOM26/Resources_downloads/organisations-resources.zip',
  community:    '/JOM26/Resources_downloads/community_groups-resources.zip',
  other:        '/JOM26/Resources_downloads/other-resources.zip'
};

// Widget state
const widgetState = {
  currentStep: 1,
  userType: null,
  formData: {}
};

// End-card auto-reset timers
var endCardResetTimer = null;
var endCardCountdownInterval = null;

/**
 * Step navigation
 */
function nextStep() {
  if (widgetState.currentStep === 3) {
    return;
  }
  
  widgetState.currentStep++;
  showStep(widgetState.currentStep);
}

function prevStep() {
  widgetState.currentStep--;
  showStep(widgetState.currentStep);
}

function showStep(stepNumber) {
  // If navigating away from the end card, cancel its countdown
  if (stepNumber !== 4 && endCardResetTimer) {
    clearTimeout(endCardResetTimer);
    clearInterval(endCardCountdownInterval);
    endCardResetTimer = null;
    endCardCountdownInterval = null;
  }

  document.querySelectorAll('.form-step').forEach(step => {
    step.classList.remove('active');
    step.setAttribute('aria-hidden', 'true');
  });

  var activeStep = document.querySelector(`.form-step[data-step="${stepNumber}"]`);
  activeStep.classList.add('active');
  activeStep.removeAttribute('aria-hidden');

  // Set the download resources link based on the user type
  if (stepNumber === 4) {
    var dlBtn = document.getElementById('download-resources-btn');
    if (dlBtn) {
      dlBtn.href = DOWNLOAD_URLS[widgetState.userType] || '#';
    }
  }

  // Notify parent of new content height so the iframe resizes dynamically
  setTimeout(notifyHeight, 50);
}

/**
 * Shared auto-message and URL used by all social-share helpers.
 */
var SHARE_TEXT = 'Join the Just One More Campaign and make your Veg Pledge today! foodwiseleeds.org/project/just-one-more #justonemore';
var SHARE_URL  = 'https://foodwiseleeds.org/project/just-one-more';

/**
 * Show a toast telling the user the message has been copied to their
 * clipboard, personalised with the platform name.
 */
function showShareToast(platform) {
  var toast = document.getElementById('share-toast');
  if (!toast) return;
  toast.textContent = 'Message copied to clipboard \u2014 paste it into your ' + platform + ' post!';
  toast.style.display = 'block';
  setTimeout(function () { toast.style.display = 'none'; }, 4000);
}

/**
 * Copy the share message to the clipboard, then show the toast.
 * Returns a Promise so callers can chain after the copy completes.
 */
function copyShareText(platform) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(SHARE_TEXT).then(function () {
      showShareToast(platform);
    });
  }
  // Fallback: still show toast even if clipboard API unavailable
  showShareToast(platform);
  return Promise.resolve();
}

/**
 * Share-popup helpers
 * Facebook, Instagram and LinkedIn no longer support pre-filling post
 * text via URL parameters. Instead we show an in-widget popup with the
 * message in a copyable text box plus a button to open the platform.
 */
var SHARE_URLS = {
  Facebook:  'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(SHARE_URL),
  Instagram: 'https://www.instagram.com/',
  LinkedIn:  'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(SHARE_URL)
};

var SHARE_COLOURS = {
  Facebook:  '#1877F2',
  Instagram: '#E1306C',
  LinkedIn:  '#0A66C2'
};

function openSharePopup(platform) {
  var overlay  = document.getElementById('share-popup-overlay');
  var title    = document.getElementById('share-popup-title');
  var nameSpan = document.getElementById('share-popup-platform-name');
  var textarea = document.getElementById('share-popup-textarea');
  var goBtn    = document.getElementById('share-popup-go-btn');
  var copyBtn  = document.getElementById('share-popup-copy-btn');

  title.textContent    = 'Share to ' + platform;
  nameSpan.textContent = platform;
  textarea.value       = SHARE_TEXT;
  goBtn.textContent    = 'Open ' + platform;
  goBtn.href           = SHARE_URLS[platform] || '#';
  goBtn.style.background = SHARE_COLOURS[platform] || '#027f7e';
  copyBtn.textContent  = 'Copy Message';
  copyBtn.classList.remove('copied');

  overlay.classList.add('visible');
  // Auto-select the text so the user can Ctrl+C immediately
  textarea.focus();
  textarea.select();
}

function closeSharePopup(event) {
  // If called from overlay click, only close when clicking the overlay itself
  if (event && event.target !== document.getElementById('share-popup-overlay')) return;
  document.getElementById('share-popup-overlay').classList.remove('visible');
}

function copyFromPopup() {
  var textarea = document.getElementById('share-popup-textarea');
  var copyBtn  = document.getElementById('share-popup-copy-btn');
  textarea.select();

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(textarea.value).then(function () {
      copyBtn.textContent = 'Copied!';
      copyBtn.classList.add('copied');
    });
  } else {
    // Fallback for older browsers
    document.execCommand('copy');
    copyBtn.textContent = 'Copied!';
    copyBtn.classList.add('copied');
  }
}

function shareToFacebook()  { openSharePopup('Facebook');  }
function shareToInstagram() { openSharePopup('Instagram'); }
function shareToLinkedIn()  { openSharePopup('LinkedIn');  }

// Types that are eligible for the shout-out feature
const SHOUTOUT_TYPES = ['school', 'organisation', 'community'];

/**
 * Pathway selection
 */
function selectPathway(event, type) {
  event.preventDefault();
  widgetState.userType = type;

  document.querySelectorAll('.pathway-card').forEach(card => {
    card.classList.remove('selected');
  });
  event.currentTarget.classList.add('selected');

  updatePledgeOptions(type);
  generatePathwayFields(type);

  // Show / hide the shout-out opt-in checkbox
  const shoutoutGroup = document.getElementById('shoutout-opt-in-group');
  if (shoutoutGroup) {
    shoutoutGroup.style.display = SHOUTOUT_TYPES.includes(type) ? 'flex' : 'none';
    if (!SHOUTOUT_TYPES.includes(type)) {
      const cb = document.getElementById('shoutout');
      if (cb) cb.checked = false;
    }
  }

  setTimeout(() => {
    widgetState.currentStep = 3;
    showStep(3);
  }, 300);
}

/**
 * Update pledge dropdown based on user type
 */
function updatePledgeOptions(type) {
  const select = document.getElementById('pledge');
  const options = livePledgeOptions;

  select.innerHTML = '<option value="">Select a box...</option>';
  options.forEach((option, index) => {
    const optionEl = document.createElement('option');
    optionEl.value = index + 1;
    optionEl.textContent = option;
    select.appendChild(optionEl);
  });
}

/**
 * Render a single field to an HTML string
 */
function renderField(field) {
  const req  = field.required ? ' required aria-required="true"' : '';
  const star = field.required ? ' *' : '';
  const minA = field.min !== undefined ? ` min="${field.min}"` : '';
  const maxA = field.max !== undefined ? ` max="${field.max}"` : '';

  if (field.type === 'select') {
    const opts = field.options.map(o => `<option value="${o}">${o}</option>`).join('');
    return `<div class="form-group">
      <label for="${field.id}">${field.label}${star}</label>
      <select id="${field.id}"${req}><option value="">Select...</option>${opts}</select>
    </div>`;
  }
  if (field.type === 'textarea') {
    return `<div class="form-group">
      <label for="${field.id}">${field.label}${star}</label>
      <textarea id="${field.id}" rows="3"${req}></textarea>
    </div>`;
  }
  return `<div class="form-group">
    <label for="${field.id}">${field.label}${star}</label>
    <input type="${field.type}" id="${field.id}"${req}${minA}${maxA}>
  </div>`;
}

/**
 * Render dynamic child-age inputs — one number field per child.
 * Called when the #children_count input changes. Fields are placed
 * inside #children-ages-container, displayed in rows of 2.
 */
function renderChildAgeFields(count) {
  var container = document.getElementById('children-ages-container');
  if (!container) return;

  count = Math.max(0, Math.min(20, parseInt(count) || 0));
  if (count === 0) { container.innerHTML = ''; setTimeout(notifyHeight, 50); return; }

  var html = [];
  for (var c = 0; c < count; c++) {
    var idx = c + 1;
    // Open a .form-row for every pair (odd index opens, even index closes)
    if (c % 2 === 0) html.push('<div class="form-row">');
    html.push(
      '<div class="form-group">' +
        '<label for="child_age_' + idx + '">Child ' + idx + ' Age</label>' +
        '<input type="number" id="child_age_' + idx + '" min="0" max="18" placeholder="Age">' +
      '</div>'
    );
    // Close the row after the second item, or if this is the last child
    if (c % 2 === 1 || c === count - 1) html.push('</div>');
  }
  container.innerHTML = html.join('');
  // Notify parent iframe to resize now that the form content has changed
  setTimeout(notifyHeight, 50);
}

/**
 * Generate dynamic pathway fields — fields sharing the same `row` key
 * are wrapped in a .form-row div so they sit side by side.
 */
function generatePathwayFields(type) {
  const container = document.getElementById('pathway-fields');
  const fields = pathwayFields[type] || [];

  if (fields.length === 0) {
    container.innerHTML = '';
    return;
  }

  const html = [];
  let i = 0;
  while (i < fields.length) {
    const f = fields[i];
    if (f.row !== undefined) {
      const rowKey = f.row;
      const rowFields = [];
      while (i < fields.length && fields[i].row === rowKey) rowFields.push(fields[i++]);
      html.push(`<div class="form-row">${rowFields.map(renderField).join('')}</div>`);
    } else {
      html.push(renderField(f));
      i++;
    }
  }

  // For family pathway: insert a container for dynamic child-age fields
  // right after the children_count input
  if (type === 'family') {
    html.splice(2, 0, '<div id="children-ages-container"></div>');
  }

  container.innerHTML = html.join('');

  // Attach listener to children_count to dynamically generate age fields
  if (type === 'family') {
    var ccInput = document.getElementById('children_count');
    if (ccInput) {
      ccInput.addEventListener('input', function () {
        renderChildAgeFields(this.value);
      });
    }
  }
}

/**
 * Form submission
 */
document.getElementById('pledge-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Extract the actual participant count for each group pathway type
  let participantsCount = null;
  if (widgetState.userType === 'family') {
    participantsCount = parseInt(document.getElementById('participants_count')?.value) || 1;
  } else if (widgetState.userType === 'school') {
    participantsCount = parseInt(document.getElementById('class_size')?.value) || null;
  } else if (widgetState.userType === 'organisation') {
    participantsCount = parseInt(document.getElementById('org_size')?.value) || null;
  } else if (widgetState.userType === 'community') {
    participantsCount = parseInt(document.getElementById('group_size')?.value) || null;
  }

  const familySize = widgetState.userType === 'family' ? participantsCount : null;

  let boxNumber = parseInt(document.getElementById('pledge').value) || 1;

  // For shout-out, prefer the group/school/org name over the contact's personal name
  let displayName = document.getElementById('name').value.trim();
  if (widgetState.userType === 'school') {
    displayName = document.getElementById('school_name')?.value?.trim() || displayName;
  } else if (widgetState.userType === 'organisation') {
    displayName = document.getElementById('org_name')?.value?.trim() || displayName;
  } else if (widgetState.userType === 'community') {
    displayName = document.getElementById('group_name')?.value?.trim() || displayName;
  }

  // Family-specific fields
  const childrenCount = widgetState.userType === 'family'
    ? parseInt(document.getElementById('children_count')?.value) || null
    : null;

  // Collect individual child ages as an array
  var childrenAges = null;
  if (widgetState.userType === 'family' && childrenCount > 0) {
    childrenAges = [];
    for (var ca = 1; ca <= childrenCount; ca++) {
      var ageEl = document.getElementById('child_age_' + ca);
      childrenAges.push(ageEl ? (parseInt(ageEl.value) || null) : null);
    }
  }

  // Free text pledge approach (all pathways)
  const pledgeApproach = document.getElementById('pledge_approach')?.value?.trim() || null;

  const payload = {
    name: document.getElementById('name').value.trim(),
    email: document.getElementById('email').value.trim(),
    pledge: document.getElementById('pledge').value,
    userType: widgetState.userType,
    familySize: familySize,
    participantsCount: participantsCount,
    childrenCount: childrenCount,
    childrenAges: childrenAges,
    pledgeApproach: pledgeApproach,
    newsletter: document.getElementById('newsletter').checked,
    boxNumber: boxNumber,
    shoutout: document.getElementById('shoutout')?.checked || false,
    displayName: displayName,
  };

  let tokens;
  let useFirestore = false;

  if (window.JOM?.submitPledgeWithFirestore) {
    try {
      const result = await window.JOM.submitPledgeWithFirestore(payload);
      tokens = result.tokens;
      boxNumber = result.boxNumber || boxNumber;
      useFirestore = true;

      const msg = {
        type: 'PLEDGE_SUBMITTED',
        tokens: tokens,
        boxNumber: boxNumber,
        data: payload
      };

      // Send to parent page (which forwards to patch iframe)
      if (window.parent !== window) {
        window.parent.postMessage(msg, '*');
      }
      // Also send to own window for same-page listeners
      window.postMessage(msg, '*');
      
    } catch (err) {
      console.error('Firestore submission failed:', err);
      alert('Failed to submit to database. Using local mode instead.');
    }
  }

  if (!useFirestore) {
    tokens = participantsCount || 1;
    
    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'PLEDGE_SUBMITTED',
        tokens: tokens,
        boxNumber: boxNumber,
        data: payload
      }, '*');
    }
    
    window.postMessage({
      type: 'PLEDGE_SUBMITTED',
      tokens: tokens,
      boxNumber: boxNumber,
      data: payload
    }, '*');
  }
  
  // Show the end card BEFORE resetting state so the download URL
  // is set correctly based on the user type.
  showStep(4);
  startEndCardCountdown();

  // Now reset form fields and state (step 4 has no inputs)
  document.getElementById('pledge-form').reset();
  widgetState.userType = null;
  widgetState.formData = {};

  // Scroll the parent page to the top so the token animation is visible
  scrollParentToTop();
});

/* ── Read Aloud (Web Speech API) ──────────────────────────────────── */

var _readAloudUtterance = null;
var _readAloudElements = [];
var _readAloudIndex = -1;

/**
 * Collect all readable text elements from the current visible step.
 * Returns an array of { el, text } objects in DOM order.
 */
function _getReadableElements() {
  var activeStep = document.querySelector('.form-step.active');
  if (!activeStep) return [];

  // Selectors for elements we want to read, in DOM order
  var selectors = 'h2, p:not(.sr-only):not(.reset-countdown-text), .pathway-card .label, label, .btn-primary, .btn-back, .btn-action, .share-label, .share-btn, .end-card-subtitle, option:checked, .pledge-start-btn';
  var nodes = activeStep.querySelectorAll(selectors);
  var items = [];

  nodes.forEach(function (el) {
    // Skip hidden elements
    if (el.offsetParent === null && !el.closest('.form-step.active')) return;
    // Skip sr-only elements (already spoken as labels)
    if (el.classList.contains('sr-only')) return;

    var text = '';
    // For buttons/links use aria-label first, then visible text
    if (el.getAttribute('aria-label')) {
      text = el.getAttribute('aria-label');
    } else {
      text = el.textContent.trim();
    }
    // Skip empty / SVG-only
    if (!text || text.length < 2) return;
    // Avoid duplicates (e.g. button text already captured via label)
    if (items.length > 0 && items[items.length - 1].text === text) return;

    items.push({ el: el, text: text });
  });

  return items;
}

/**
 * Highlight the element being read and remove highlight from previous.
 */
function _highlightReadAloud(index) {
  // Remove previous highlight
  var prev = document.querySelector('.read-aloud-highlight');
  if (prev) prev.classList.remove('read-aloud-highlight');

  if (index >= 0 && index < _readAloudElements.length) {
    var el = _readAloudElements[index].el;
    el.classList.add('read-aloud-highlight');
    // Scroll into view within the widget
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

/**
 * Speak the next element in the queue.
 */
function _speakNext() {
  _readAloudIndex++;
  if (_readAloudIndex >= _readAloudElements.length) {
    stopReadAloud();
    return;
  }

  _highlightReadAloud(_readAloudIndex);

  var item = _readAloudElements[_readAloudIndex];
  _readAloudUtterance = new SpeechSynthesisUtterance(item.text);
  _readAloudUtterance.rate = 0.95;
  _readAloudUtterance.pitch = 1;
  _readAloudUtterance.lang = 'en-GB';

  _readAloudUtterance.onend = function () {
    _speakNext();
  };
  _readAloudUtterance.onerror = function () {
    _speakNext();
  };

  speechSynthesis.speak(_readAloudUtterance);
}

/**
 * Toggle Read Aloud on/off.
 */
function toggleReadAloud() {
  if (speechSynthesis.speaking || speechSynthesis.pending) {
    stopReadAloud();
  } else {
    startReadAloud();
  }
}

function startReadAloud() {
  if (!('speechSynthesis' in window)) {
    alert('Sorry, your browser does not support text-to-speech.');
    return;
  }

  // Cancel any leftover speech
  speechSynthesis.cancel();

  _readAloudElements = _getReadableElements();
  if (_readAloudElements.length === 0) return;

  _readAloudIndex = -1;

  // Update button state
  var btn = document.getElementById('read-aloud-btn');
  var label = document.getElementById('read-aloud-label');
  if (btn) btn.classList.add('speaking');
  if (label) label.textContent = 'Stop';

  _speakNext();
}

function stopReadAloud() {
  speechSynthesis.cancel();
  _readAloudUtterance = null;
  _readAloudElements = [];
  _readAloudIndex = -1;

  // Remove highlight
  var prev = document.querySelector('.read-aloud-highlight');
  if (prev) prev.classList.remove('read-aloud-highlight');

  // Reset button state
  var btn = document.getElementById('read-aloud-btn');
  var label = document.getElementById('read-aloud-label');
  if (btn) btn.classList.remove('speaking');
  if (label) label.textContent = 'Read Aloud';
}

// Stop reading when navigating between steps
var _origShowStep = showStep;
showStep = function (stepNumber) {
  if (speechSynthesis.speaking || speechSynthesis.pending) {
    stopReadAloud();
  }
  _origShowStep(stepNumber);
};

/**
 * Notify the parent page of the current form content height so the
 * iframe can auto-resize instead of using a fixed height.
 *
 * We measure .widget-container's getBoundingClientRect().height rather
 * than document.scrollHeight: scrollHeight always returns at least
 * clientHeight (the iframe's current CSS height), so it can never report
 * a height smaller than the iframe is already set to — meaning the iframe
 * could never shrink back down after expanding.  getBoundingClientRect()
 * returns the element's actual rendered size, independent of iframe height.
 */
function notifyHeight() {
  var container = document.querySelector('.widget-container');
  var h = container ? Math.ceil(container.getBoundingClientRect().height) : 200;
  try { window.parent.postMessage({ type: 'FORM_HEIGHT', height: h }, '*'); } catch (e) {}
}

/**
 * Scroll the parent page to the top so the user can watch tokens fall
 * into the Veg Patch widget. Called both on submit and from the modal button.
 */
function scrollParentToTop() {
  try { window.parent.postMessage({ type: 'SCROLL_TO_TOP' }, '*'); } catch (e) {}
  try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {}
}

/**
 * End-card countdown — auto-resets the form to step 1 after 15 seconds.
 * Displays a live countdown in #reset-countdown.
 */
function startEndCardCountdown() {
  var seconds = 30;
  var countdownEl = document.getElementById('reset-countdown');

  // Clear any leftover timers from a previous submission
  if (endCardResetTimer) clearTimeout(endCardResetTimer);
  if (endCardCountdownInterval) clearInterval(endCardCountdownInterval);

  if (countdownEl) countdownEl.textContent = seconds;

  endCardCountdownInterval = setInterval(function () {
    seconds -= 1;
    if (countdownEl) countdownEl.textContent = seconds;
    if (seconds <= 0) clearInterval(endCardCountdownInterval);
  }, 1000);

  endCardResetTimer = setTimeout(function () {
    clearInterval(endCardCountdownInterval);
    endCardResetTimer = null;
    endCardCountdownInterval = null;
    widgetState.currentStep = 1;
    showStep(1);
  }, 30000);
}

/* ── Holding mode (pre-launch) ──────────────────────────────────── */

var formHoldingMode = false;
var holdingResetTimer = null;
var holdingCountdownInterval = null;

function holdingModeClick() {
  // Send ADD_TO_PILE to parent (forwarded to patch iframe)
  if (window.parent !== window) {
    window.parent.postMessage({ type: 'ADD_TO_PILE', count: 3 }, '*');
  }

  // Increment holding interest counter in Firestore
  if (typeof window._incrementHoldingInterest === 'function') {
    window._incrementHoldingInterest();
  }

  // Show the holding-end step
  document.querySelectorAll('.form-step').forEach(function (step) {
    step.classList.remove('active');
    step.setAttribute('aria-hidden', 'true');
  });
  var holdingEnd = document.querySelector('.form-step[data-step="holding-end"]');
  if (holdingEnd) {
    holdingEnd.classList.add('active');
    holdingEnd.removeAttribute('aria-hidden');
  }

  startHoldingEndCountdown();
  setTimeout(notifyHeight, 50);
  scrollParentToTop();
}

function startHoldingEndCountdown() {
  var seconds = 15;
  var countdownEl = document.getElementById('holding-reset-countdown');

  if (holdingResetTimer) clearTimeout(holdingResetTimer);
  if (holdingCountdownInterval) clearInterval(holdingCountdownInterval);

  if (countdownEl) countdownEl.textContent = seconds;

  holdingCountdownInterval = setInterval(function () {
    seconds -= 1;
    if (countdownEl) countdownEl.textContent = seconds;
    if (seconds <= 0) clearInterval(holdingCountdownInterval);
  }, 1000);

  holdingResetTimer = setTimeout(function () {
    clearInterval(holdingCountdownInterval);
    holdingResetTimer = null;
    holdingCountdownInterval = null;
    widgetState.currentStep = 1;
    showStep(1);
  }, 15000);
}

function applyFormHoldingMode(holding) {
  var btn = document.querySelector('.pledge-start-btn');
  if (!btn) return;

  if (holding) {
    formHoldingMode = true;
    btn.textContent = 'ADD YOUR VEG TO THE PILE';
    btn.setAttribute('onclick', 'holdingModeClick()');
    btn.setAttribute('aria-label', 'Add your veg to the pile - click to contribute');
  } else {
    formHoldingMode = false;
    btn.textContent = 'MAKE YOUR VEG PLEDGE!';
    btn.setAttribute('onclick', 'nextStep()');
    btn.setAttribute('aria-label', 'Make your veg pledge - click to begin');
    // If showing holding-end step, go back to step 1
    var holdingEnd = document.querySelector('.form-step[data-step="holding-end"]');
    if (holdingEnd && holdingEnd.classList.contains('active')) {
      if (holdingResetTimer) clearTimeout(holdingResetTimer);
      if (holdingCountdownInterval) clearInterval(holdingCountdownInterval);
      widgetState.currentStep = 1;
      showStep(1);
    }
  }
}

// Listen for messages from parent / veg patch widget
window.addEventListener('message', (event) => {
  var data = event.data;
  if (!data) return;

  if (data.type === 'REQUEST_UPDATE') {
    // Veg patch is requesting current state
  } else if (data.type === 'SET_HOLDING_MODE') {
    applyFormHoldingMode(data.holding);
  }
});

console.log('[JOM26] Form widget ready');

// Send initial height once the page has rendered
setTimeout(notifyHeight, 100);
