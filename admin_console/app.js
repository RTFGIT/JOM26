/**
 * JOM26 Admin Console Application
 */

// State management
const state = {
  currentUser: null,
  submissions: [],
  filteredSubmissions: [],
  auditLog: [],
  totals: { total: 0, goal: 100000, percentage: 0 },
  currentPage: 1,
  pageSize: 50,
  sortBy: 'created_at',
  sortDesc: true,
  filters: {
    search: '',
    userType: ''
  }
};

// UI Elements
const elements = {
  loginScreen: document.getElementById('login-screen'),
  adminScreen: document.getElementById('admin-screen'),
  loginForm: document.getElementById('login-form'),
  loginError: document.getElementById('login-error'),
  logoutBtn: document.getElementById('logout-btn'),
  userEmail: document.getElementById('user-email'),
  
  totalTokens: document.getElementById('total-tokens'),
  goalValue: document.getElementById('goal-value'),
  percentageComplete: document.getElementById('percentage-complete'),
  tokensToGoal: document.getElementById('tokens-to-goal'),
  totalSubmissions: document.getElementById('total-submissions'),
  
  goalForm: document.getElementById('goal-form'),
  newGoal: document.getElementById('new-goal'),
  
  adjustmentForm: document.getElementById('adjustment-form'),
  adjustmentValue: document.getElementById('adjustment-value'),
  adjustmentReason: document.getElementById('adjustment-reason'),
  
  searchInput: document.getElementById('search-input'),
  userTypeFilter: document.getElementById('user-type-filter'),
  exportCsvBtn: document.getElementById('export-csv'),
  refreshBtn: document.getElementById('refresh-data'),
  
  submissionsTable: document.getElementById('submissions-table'),
  submissionsTbody: document.getElementById('submissions-tbody'),
  auditTbody: document.getElementById('audit-tbody'),
  
  prevPage: document.getElementById('prev-page'),
  nextPage: document.getElementById('next-page'),
  pageInfo: document.getElementById('page-info')
};

/**
 * Initialize the application
 */
function init() {
  // Auth state observer
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      // Check if user has admin claim
      const tokenResult = await user.getIdTokenResult();
      if (tokenResult.claims.admin) {
        state.currentUser = user;
        showAdminScreen();
      } else {
        showError('Access denied. You do not have admin privileges.');
        auth.signOut();
      }
    } else {
      showLoginScreen();
    }
  });
  
  // Event listeners
  elements.loginForm.addEventListener('submit', handleLogin);
  elements.logoutBtn.addEventListener('click', handleLogout);
  elements.goalForm.addEventListener('submit', handleUpdateGoal);
  elements.adjustmentForm.addEventListener('submit', handleAdjustTokens);
  elements.exportCsvBtn.addEventListener('click', handleExportCsv);
  elements.refreshBtn.addEventListener('click', loadAllData);
  
  elements.searchInput.addEventListener('input', debounce(handleFilterChange, 300));
  elements.userTypeFilter.addEventListener('change', handleFilterChange);
  
  elements.prevPage.addEventListener('click', () => changePage(-1));
  elements.nextPage.addEventListener('click', () => changePage(1));
  
  // Table sorting
  elements.submissionsTable.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => handleSort(th.dataset.sort));
  });
}

/**
 * Authentication handlers
 */
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  try {
    elements.loginError.textContent = '';
    await auth.signInWithEmailAndPassword(email, password);
  } catch (error) {
    showError(error.message);
  }
}

function handleLogout() {
  auth.signOut();
}

function showError(message) {
  elements.loginError.textContent = message;
}

function showLoginScreen() {
  elements.loginScreen.classList.add('active');
  elements.adminScreen.classList.remove('active');
}

async function showAdminScreen() {
  elements.loginScreen.classList.remove('active');
  elements.adminScreen.classList.add('active');
  elements.userEmail.textContent = state.currentUser.email;
  
  await loadAllData();
}

/**
 * Data loading
 */
async function loadAllData() {
  await Promise.all([
    loadTotals(),
    loadSubmissions(),
    loadAuditLog()
  ]);
}

async function loadTotals() {
  try {
    const getTotals = functions.httpsCallable('getTotals');
    const result = await getTotals();
    state.totals = result.data;
    
    // Update UI
    elements.totalTokens.textContent = state.totals.total.toLocaleString();
    elements.goalValue.textContent = state.totals.goal.toLocaleString();
    elements.percentageComplete.textContent = state.totals.percentage.toFixed(1) + '%';
    elements.tokensToGoal.textContent = state.totals.tokens_to_goal.toLocaleString();
    
    // Update vegetable patch
    if (window.vegPatch) {
      vegPatch.update(state.totals.total, state.totals.goal);
    }
  } catch (error) {
    console.error('Error loading totals:', error);
  }
}

async function loadSubmissions() {
  try {
    const snapshot = await db.collection('submissions')
      .orderBy('created_at', 'desc')
      .limit(1000)
      .get();
    
    state.submissions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    elements.totalSubmissions.textContent = state.submissions.length.toLocaleString();
    
    applyFilters();
  } catch (error) {
    console.error('Error loading submissions:', error);
    elements.submissionsTbody.innerHTML = '<tr><td colspan="8" class="error">Error loading submissions</td></tr>';
  }
}

async function loadAuditLog() {
  try {
    const snapshot = await db.collection('audit')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();
    
    state.auditLog = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    renderAuditLog();
  } catch (error) {
    console.error('Error loading audit log:', error);
  }
}

/**
 * Filtering and sorting
 */
function applyFilters() {
  let filtered = [...state.submissions];
  
  // Search filter
  if (state.filters.search) {
    const search = state.filters.search.toLowerCase();
    filtered = filtered.filter(sub => 
      sub.name?.toLowerCase().includes(search) ||
      sub.email?.toLowerCase().includes(search)
    );
  }
  
  // User type filter
  if (state.filters.userType) {
    filtered = filtered.filter(sub => sub.user_type === state.filters.userType);
  }
  
  // Sort
  filtered.sort((a, b) => {
    let aVal = a[state.sortBy];
    let bVal = b[state.sortBy];
    
    // Handle timestamps
    if (aVal?.toDate) aVal = aVal.toDate();
    if (bVal?.toDate) bVal = bVal.toDate();
    
    if (aVal < bVal) return state.sortDesc ? 1 : -1;
    if (aVal > bVal) return state.sortDesc ? -1 : 1;
    return 0;
  });
  
  state.filteredSubmissions = filtered;
  state.currentPage = 1;
  renderSubmissions();
}

function handleFilterChange() {
  state.filters.search = elements.searchInput.value;
  state.filters.userType = elements.userTypeFilter.value;
  applyFilters();
}

function handleSort(column) {
  if (state.sortBy === column) {
    state.sortDesc = !state.sortDesc;
  } else {
    state.sortBy = column;
    state.sortDesc = true;
  }
  applyFilters();
}

function changePage(delta) {
  const totalPages = Math.ceil(state.filteredSubmissions.length / state.pageSize);
  state.currentPage = Math.max(1, Math.min(totalPages, state.currentPage + delta));
  renderSubmissions();
}

/**
 * Rendering
 */
function renderSubmissions() {
  const start = (state.currentPage - 1) * state.pageSize;
  const end = start + state.pageSize;
  const pageData = state.filteredSubmissions.slice(start, end);
  
  if (pageData.length === 0) {
    elements.submissionsTbody.innerHTML = '<tr><td colspan="8" class="loading">No submissions found</td></tr>';
    return;
  }
  
  elements.submissionsTbody.innerHTML = pageData.map(sub => `
    <tr>
      <td>${formatDate(sub.created_at)}</td>
      <td>${escapeHtml(sub.name)}</td>
      <td>${escapeHtml(sub.email)}</td>
      <td><span class="badge badge-info">${sub.user_type}</span></td>
      <td>${escapeHtml(sub.pledge)}</td>
      <td><strong>${sub.tokens || 0}</strong></td>
      <td>${formatDetails(sub)}</td>
      <td>${sub.newsletter_opt_in ? '✅' : '—'}</td>
    </tr>
  `).join('');
  
  // Update pagination
  const totalPages = Math.ceil(state.filteredSubmissions.length / state.pageSize);
  elements.pageInfo.textContent = `Page ${state.currentPage} of ${totalPages}`;
  elements.prevPage.disabled = state.currentPage === 1;
  elements.nextPage.disabled = state.currentPage === totalPages;
}

function renderAuditLog() {
  if (state.auditLog.length === 0) {
    elements.auditTbody.innerHTML = '<tr><td colspan="4" class="loading">No audit entries</td></tr>';
    return;
  }
  
  elements.auditTbody.innerHTML = state.auditLog.map(entry => `
    <tr>
      <td>${formatDate(entry.timestamp)}</td>
      <td><span class="badge badge-info">${entry.action}</span></td>
      <td>${escapeHtml(entry.user_email)}</td>
      <td>${formatAuditDetails(entry)}</td>
    </tr>
  `).join('');
}

function formatDetails(sub) {
  const details = [];
  if (sub.participants_count) details.push(`${sub.participants_count} people`);
  if (sub.school_name) details.push(escapeHtml(sub.school_name));
  if (sub.class_name) details.push(escapeHtml(sub.class_name));
  if (sub.class_size) details.push(`${sub.class_size} students`);
  if (sub.org_name) details.push(escapeHtml(sub.org_name));
  if (sub.group_name) details.push(escapeHtml(sub.group_name));
  return details.join(', ') || '—';
}

function formatAuditDetails(entry) {
  switch (entry.action) {
    case 'update_goal':
      return `Goal: ${entry.old_goal || '?'} → ${entry.new_goal}`;
    case 'adjust_tokens':
      return `${entry.adjustment > 0 ? '+' : ''}${entry.adjustment} (${entry.old_total} → ${entry.new_total})<br><em>${escapeHtml(entry.reason)}</em>`;
    default:
      return '—';
  }
}

/**
 * Admin actions
 */
async function handleUpdateGoal(e) {
  e.preventDefault();
  const newGoal = parseInt(elements.newGoal.value);
  
  if (!newGoal || newGoal <= 0) {
    alert('Please enter a valid goal');
    return;
  }
  
  try {
    const updateGoal = functions.httpsCallable('updateGoal');
    await updateGoal({ goal: newGoal, old_goal: state.totals.goal });
    
    alert('Goal updated successfully!');
    elements.newGoal.value = '';
    await loadAllData();
  } catch (error) {
    alert('Error updating goal: ' + error.message);
  }
}

async function handleAdjustTokens(e) {
  e.preventDefault();
  const adjustment = parseInt(elements.adjustmentValue.value);
  const reason = elements.adjustmentReason.value;
  
  if (!adjustment || adjustment === 0) {
    alert('Please enter a non-zero adjustment');
    return;
  }
  
  if (!reason || reason.length < 10) {
    alert('Please provide a reason (minimum 10 characters)');
    return;
  }
  
  if (!confirm(`Adjust tokens by ${adjustment > 0 ? '+' : ''}${adjustment}?\n\nReason: ${reason}`)) {
    return;
  }
  
  try {
    const adjustTokens = functions.httpsCallable('adjustTokens');
    await adjustTokens({ adjustment, reason });
    
    alert('Tokens adjusted successfully!');
    elements.adjustmentValue.value = '';
    elements.adjustmentReason.value = '';
    await loadAllData();
  } catch (error) {
    alert('Error adjusting tokens: ' + error.message);
  }
}

/**
 * CSV Export
 */
function handleExportCsv() {
  const headers = [
    'Date',
    'Name',
    'Email',
    'User Type',
    'Pledge',
    'Tokens',
    'Newsletter',
    'Participants',
    'School Name',
    'Class Name',
    'Class Size',
    'Org Name',
    'Org Type',
    'Org Size',
    'Group Name',
    'Group Size'
  ];
  
  const rows = state.filteredSubmissions.map(sub => [
    formatDate(sub.created_at),
    sub.name,
    sub.email,
    sub.user_type,
    sub.pledge,
    sub.tokens || 0,
    sub.newsletter_opt_in ? 'Yes' : 'No',
    sub.participants_count || '',
    sub.school_name || '',
    sub.class_name || '',
    sub.class_size || '',
    sub.org_name || '',
    sub.org_type || '',
    sub.org_size || '',
    sub.group_name || '',
    sub.group_size || ''
  ]);
  
  const csvContent = [
    headers.map(h => `"${h}"`).join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `jom26_submissions_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Utility functions
 */
function formatDate(timestamp) {
  if (!timestamp) return '—';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', init);
