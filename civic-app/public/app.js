/* ============================================================
   CivicConnect — Frontend Single-Page Application
   ============================================================ */

// ============================================================
// STATE
// ============================================================
const state = {
  user: null,
  token: null
};

// ============================================================
// SECURITY — HTML ESCAPING (XSS PREVENTION)
// ============================================================
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============================================================
// UTILITIES
// ============================================================
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function formatDateShort(dateStr) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

function statusBadge(status) {
  const map = {
    'Submitted':    'badge-indigo',
    'Under Review': 'badge-amber',
    'Assigned':     'badge-blue',
    'In Progress':  'badge-purple',
    'Resolved':     'badge-green'
  };
  const cls = map[status] || 'badge-gray';
  return `<span class="badge ${cls}">${esc(status)}</span>`;
}

function starsDisplay(rating) {
  if (!rating) return '<span class="text-muted">Not rated</span>';
  const filled = Math.round(rating);
  return `<span class="stars-display">${'★'.repeat(filled)}${'☆'.repeat(5 - filled)}</span> ${esc(String(rating))}/5`;
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

// ============================================================
// API HELPER
// ============================================================
async function api(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (state.token) opts.headers['Authorization'] = `Bearer ${state.token}`;
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`/api${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
function toast(message, type = 'info') {
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${esc(message)}</span>`;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 4000);
}

// ============================================================
// LOADING
// ============================================================
function setLoading(show) {
  document.getElementById('loading-overlay').classList.toggle('hidden', !show);
}

// ============================================================
// MODAL
// ============================================================
function openModal(title, bodyHtml) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-body').innerHTML = '';
}

// ============================================================
// AUTH SECTION
// ============================================================
function showAuthSection() {
  document.getElementById('auth-section').classList.remove('hidden');
  document.getElementById('main-section').classList.add('hidden');
}

function showMainSection() {
  document.getElementById('auth-section').classList.add('hidden');
  document.getElementById('main-section').classList.remove('hidden');
  buildSidebar();
}

function toggleAuthTab(tab) {
  document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
  document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
  document.querySelectorAll('.auth-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
}

// ============================================================
// SIDEBAR
// ============================================================
function buildSidebar() {
  const role = state.user.role;
  const nav = document.getElementById('sidebar-nav');

  const items = {
    citizen: [
      { icon: '🏠', label: 'Dashboard',         view: 'citizen-dashboard' },
      { icon: '📝', label: 'Submit Complaint',  view: 'submit-complaint' },
      { icon: '📋', label: 'My Complaints',     view: 'my-complaints' }
    ],
    official: [
      { icon: '🏠', label: 'Dashboard',             view: 'official-dashboard' },
      { icon: '📋', label: 'Assigned Complaints',   view: 'official-complaints' }
    ],
    admin: [
      { icon: '📊', label: 'Dashboard',           view: 'admin-dashboard' },
      { icon: '📋', label: 'All Complaints',      view: 'admin-complaints' },
      { icon: '👥', label: 'Users & Officials',   view: 'admin-users' }
    ]
  };

  nav.innerHTML = (items[role] || []).map(item => `
    <button class="nav-item" data-view="${esc(item.view)}">
      <span class="nav-icon">${item.icon}</span>
      <span>${esc(item.label)}</span>
    </button>
  `).join('');

  const initials = state.user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  document.getElementById('sidebar-avatar').textContent = initials;
  document.getElementById('sidebar-user-name').textContent = state.user.name;
  document.getElementById('sidebar-user-role').textContent = capitalize(state.user.role);
  document.getElementById('top-user-name').textContent = state.user.name;
}

function setActiveNav(view) {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
}

function setPageTitle(title) {
  document.getElementById('page-title').textContent = title;
}

// ============================================================
// NAVIGATION
// ============================================================
function navigate(view, data = null) {
  setActiveNav(view);
  const renders = {
    'citizen-dashboard':  renderCitizenDashboard,
    'submit-complaint':   renderSubmitComplaint,
    'my-complaints':      renderMyComplaints,
    'complaint-detail':   () => renderComplaintDetail(data),
    'official-dashboard': renderOfficialDashboard,
    'official-complaints':renderOfficialComplaints,
    'admin-dashboard':    renderAdminDashboard,
    'admin-complaints':   renderAdminComplaints,
    'admin-users':        renderAdminUsers
  };
  if (renders[view]) renders[view]();
}

function defaultView() {
  const map = { citizen: 'citizen-dashboard', official: 'official-dashboard', admin: 'admin-dashboard' };
  navigate(map[state.user.role] || 'citizen-dashboard');
}

function setContent(html) {
  document.getElementById('content-area').innerHTML = html;
}

// ============================================================
// AUTHENTICATION
// ============================================================
function initAuth() {
  const token = localStorage.getItem('cc_token');
  const user  = localStorage.getItem('cc_user');
  if (token && user) {
    try {
      state.token = token;
      state.user  = JSON.parse(user);
      showMainSection();
      defaultView();
    } catch {
      localStorage.clear();
      showAuthSection();
    }
  } else {
    showAuthSection();
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  try {
    setLoading(true);
    const data = await api('POST', '/auth/login', { email, password });
    saveSession(data);
    toast('Welcome back, ' + data.user.name + '!', 'success');
    showMainSection();
    defaultView();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    setLoading(false);
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name     = document.getElementById('reg-name').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const phone    = document.getElementById('reg-phone').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirm  = document.getElementById('reg-confirm').value;

  if (password !== confirm) { toast('Passwords do not match', 'error'); return; }

  try {
    setLoading(true);
    const data = await api('POST', '/auth/register', { name, email, phone, password });
    saveSession(data);
    toast('Account created! Welcome, ' + data.user.name + '.', 'success');
    showMainSection();
    defaultView();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    setLoading(false);
  }
}

function saveSession(data) {
  state.token = data.token;
  state.user  = data.user;
  localStorage.setItem('cc_token', data.token);
  localStorage.setItem('cc_user',  JSON.stringify(data.user));
}

function handleLogout() {
  state.token = null;
  state.user  = null;
  localStorage.removeItem('cc_token');
  localStorage.removeItem('cc_user');
  showAuthSection();
}

// ============================================================
// ────────── CITIZEN VIEWS ────────────────────────────────────
// ============================================================

async function renderCitizenDashboard() {
  setPageTitle('Dashboard');
  setContent('<div class="loading-placeholder">Loading…</div>');
  try {
    const complaints = await api('GET', '/complaints');
    const total    = complaints.length;
    const pending  = complaints.filter(c => c.status !== 'Resolved').length;
    const resolved = complaints.filter(c => c.status === 'Resolved').length;
    const recent   = complaints.slice(0, 6);

    setContent(`
      <div class="page-header">
        <div>
          <h2>Welcome back, ${esc(state.user.name)} 👋</h2>
          <p>Track and manage your civic complaints</p>
        </div>
        <button class="btn btn-primary" data-view="submit-complaint">+ New Complaint</button>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon primary">📋</div>
          <div class="stat-info">
            <span class="stat-value">${total}</span>
            <span class="stat-label">Total Complaints</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon warning">⏳</div>
          <div class="stat-info">
            <span class="stat-value">${pending}</span>
            <span class="stat-label">Pending</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon success">✅</div>
          <div class="stat-info">
            <span class="stat-value">${resolved}</span>
            <span class="stat-label">Resolved</span>
          </div>
        </div>
      </div>

      <div class="quick-actions">
        <div class="quick-action-card" data-view="submit-complaint">
          <div class="quick-action-icon">📝</div>
          <div class="quick-action-label">Submit Complaint</div>
        </div>
        <div class="quick-action-card" data-view="my-complaints">
          <div class="quick-action-icon">📋</div>
          <div class="quick-action-label">View All Complaints</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3>Recent Complaints</h3>
          <button class="btn btn-ghost btn-sm" data-view="my-complaints">View all →</button>
        </div>
        ${recent.length === 0
          ? `<div class="empty-state">
               <div class="empty-icon">📭</div>
               <h3>No complaints yet</h3>
               <p>Submit your first complaint to get started.</p>
               <button class="btn btn-primary" data-view="submit-complaint">Submit a Complaint</button>
             </div>`
          : `<div class="table-wrapper">
               <table class="table">
                 <thead><tr>
                   <th>ID</th><th>Title</th><th>Category</th>
                   <th>Status</th><th>Date</th><th></th>
                 </tr></thead>
                 <tbody>${recent.map(c => `
                   <tr>
                     <td><code>${esc(c.complaint_id)}</code></td>
                     <td>${esc(c.title)}</td>
                     <td><span class="category-badge">${esc(c.category)}</span></td>
                     <td>${statusBadge(c.status)}</td>
                     <td>${formatDateShort(c.created_at)}</td>
                     <td><button class="btn btn-outline btn-sm" data-view="complaint-detail" data-id="${esc(c.complaint_id)}">View</button></td>
                   </tr>`).join('')}
                 </tbody>
               </table>
             </div>`}
      </div>
    `);
  } catch (err) {
    setContent(`<div class="alert alert-danger">${esc(err.message)}</div>`);
  }
}

async function renderSubmitComplaint() {
  setPageTitle('Submit Complaint');
  setContent(`
    <div class="page-header">
      <div>
        <h2>Submit a Complaint</h2>
        <p>Describe the civic issue so authorities can address it promptly.</p>
      </div>
    </div>

    <div class="card" style="max-width:680px">
      <div class="card-body">
        <form id="complaint-form">
          <div class="form-group">
            <label for="c-title">Complaint Title *</label>
            <input type="text" id="c-title" placeholder="e.g. Pothole on Main Street" required maxlength="120" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="c-category">Issue Category *</label>
              <select id="c-category" required>
                <option value="">Select category…</option>
                <option>Road & Infrastructure</option>
                <option>Water Supply</option>
                <option>Electricity</option>
                <option>Waste Management</option>
                <option>Public Safety</option>
                <option>Other Civic Issues</option>
              </select>
            </div>
            <div class="form-group">
              <label for="c-location">Location / Address *</label>
              <input type="text" id="c-location" placeholder="Street, area, landmark" required maxlength="200" />
            </div>
          </div>
          <div class="form-group">
            <label for="c-description">Description *</label>
            <textarea id="c-description" placeholder="Describe the issue in detail (what, where, how severe)…" required maxlength="1000" rows="5"></textarea>
          </div>
          <div class="form-group">
            <label for="c-image">Evidence Image URL <small>(optional)</small></label>
            <input type="url" id="c-image" placeholder="https://example.com/image.jpg" />
          </div>
          <div class="flex gap-1 mt-2">
            <button type="submit" class="btn btn-primary">Submit Complaint</button>
            <button type="button" class="btn btn-outline" data-view="citizen-dashboard">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  `);

  document.getElementById('complaint-form').addEventListener('submit', submitComplaint);
}

async function submitComplaint(e) {
  e.preventDefault();
  const title       = document.getElementById('c-title').value.trim();
  const category    = document.getElementById('c-category').value;
  const location    = document.getElementById('c-location').value.trim();
  const description = document.getElementById('c-description').value.trim();
  const image_url   = document.getElementById('c-image').value.trim() || null;

  try {
    setLoading(true);
    const data = await api('POST', '/complaints', { title, category, location, description, image_url });
    toast(`Complaint submitted! ID: ${data.complaintId}`, 'success');
    navigate('my-complaints');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    setLoading(false);
  }
}

async function renderMyComplaints() {
  setPageTitle('My Complaints');
  setContent('<div class="loading-placeholder">Loading…</div>');
  try {
    const complaints = await api('GET', '/complaints');
    setContent(`
      <div class="page-header">
        <h2>My Complaints</h2>
        <button class="btn btn-primary btn-sm" data-view="submit-complaint">+ New Complaint</button>
      </div>

      <div class="filter-bar">
        <input type="text" id="search-input" placeholder="Search by title or ID…" />
        <select id="status-filter">
          <option value="">All Statuses</option>
          <option>Submitted</option>
          <option>Under Review</option>
          <option>Assigned</option>
          <option>In Progress</option>
          <option>Resolved</option>
        </select>
      </div>

      <div class="card">
        ${complaints.length === 0
          ? `<div class="empty-state">
               <div class="empty-icon">📭</div>
               <h3>No complaints yet</h3>
               <p>You haven't submitted any complaints.</p>
               <button class="btn btn-primary" data-view="submit-complaint">Submit your first complaint</button>
             </div>`
          : `<div class="table-wrapper">
               <table class="table" id="complaints-table">
                 <thead><tr>
                   <th>Complaint ID</th><th>Title</th><th>Category</th>
                   <th>Status</th><th>Submitted</th><th>Rating</th><th></th>
                 </tr></thead>
                 <tbody id="complaints-tbody">
                   ${complaintsRows(complaints)}
                 </tbody>
               </table>
             </div>`}
      </div>
    `);

    if (complaints.length > 0) {
      const allData = complaints;
      const searchEl  = document.getElementById('search-input');
      const statusEl  = document.getElementById('status-filter');
      const tbody     = document.getElementById('complaints-tbody');

      function filterTable() {
        const q  = searchEl.value.toLowerCase();
        const st = statusEl.value;
        const filtered = allData.filter(c =>
          (!q  || c.title.toLowerCase().includes(q) || c.complaint_id.toLowerCase().includes(q)) &&
          (!st || c.status === st)
        );
        tbody.innerHTML = filtered.length
          ? complaintsRows(filtered)
          : `<tr><td colspan="7" style="text-align:center;color:var(--gray-400);padding:2rem">No matching complaints.</td></tr>`;
      }

      searchEl.addEventListener('input', filterTable);
      statusEl.addEventListener('change', filterTable);
    }
  } catch (err) {
    setContent(`<div class="alert alert-danger">${esc(err.message)}</div>`);
  }
}

function complaintsRows(list) {
  return list.map(c => `
    <tr>
      <td><code>${esc(c.complaint_id)}</code></td>
      <td>${esc(c.title)}</td>
      <td><span class="category-badge">${esc(c.category)}</span></td>
      <td>${statusBadge(c.status)}</td>
      <td>${formatDateShort(c.created_at)}</td>
      <td>${c.feedback_rating ? starsDisplay(c.feedback_rating) : '<span class="text-muted">—</span>'}</td>
      <td><button class="btn btn-outline btn-sm" data-view="complaint-detail" data-id="${esc(c.complaint_id)}">View</button></td>
    </tr>
  `).join('');
}

async function renderComplaintDetail(complaintId) {
  setPageTitle('Complaint Detail');
  setContent('<div class="loading-placeholder">Loading…</div>');
  try {
    const c = await api('GET', `/complaints/${complaintId}`);
    const backView = state.user.role === 'citizen' ? 'my-complaints'
                   : state.user.role === 'official' ? 'official-complaints'
                   : 'admin-complaints';

    const canUpdate = (state.user.role === 'official' && c.assigned_to === state.user.id) ||
                      state.user.role === 'admin';
    const canAssign = state.user.role === 'admin';
    const canFeedback = state.user.role === 'citizen' && c.status === 'Resolved' && !c.feedback;

    setContent(`
      <div class="breadcrumb">
        <a data-view="${backView}">← Back</a>
        <span class="sep">/</span>
        <span>${esc(c.complaint_id)}</span>
      </div>

      <div class="page-header">
        <div>
          <h2>${esc(c.title)}</h2>
          <p><code>${esc(c.complaint_id)}</code> &nbsp;·&nbsp; ${formatDate(c.created_at)}</p>
        </div>
        <div class="flex gap-1">
          ${statusBadge(c.status)}
          ${canUpdate ? `<button class="btn btn-primary btn-sm" data-action="update-status" data-id="${esc(c.complaint_id)}">Update Status</button>` : ''}
          ${canAssign && c.status === 'Submitted' ? `<button class="btn btn-success btn-sm" data-action="assign-complaint" data-id="${esc(c.complaint_id)}">Assign</button>` : ''}
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>Complaint Details</h3></div>
        <div class="card-body">
          <div class="detail-grid">
            <div class="detail-item">
              <label>Category</label>
              <span><span class="category-badge">${esc(c.category)}</span></span>
            </div>
            <div class="detail-item">
              <label>Location</label>
              <span>${esc(c.location)}</span>
            </div>
            <div class="detail-item">
              <label>Status</label>
              <span>${statusBadge(c.status)}</span>
            </div>
            <div class="detail-item">
              <label>Department</label>
              <span>${c.department ? esc(c.department) : '<span class="text-muted">Unassigned</span>'}</span>
            </div>
            ${state.user.role !== 'citizen' ? `
            <div class="detail-item">
              <label>Citizen</label>
              <span>${esc(c.citizen_name)} <span class="text-muted">(${esc(c.citizen_email)})</span></span>
            </div>
            ` : ''}
            <div class="detail-item">
              <label>Assigned Officer</label>
              <span>${c.assigned_officer ? esc(c.assigned_officer) : '<span class="text-muted">Not assigned</span>'}</span>
            </div>
            <div class="detail-item">
              <label>Last Updated</label>
              <span>${formatDate(c.updated_at)}</span>
            </div>
          </div>
          <div class="form-group mt-2">
            <label>Description</label>
            <p style="background:var(--gray-50);padding:.75rem;border-radius:var(--radius-sm);font-size:.9rem">${esc(c.description)}</p>
          </div>
          ${c.image_url ? `
          <div class="form-group">
            <label>Evidence</label>
            <img src="${esc(c.image_url)}" alt="Evidence" class="evidence-img" onerror="this.style.display='none'" />
          </div>` : ''}
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>Status Timeline</h3></div>
        <div class="card-body">
          <ul class="timeline">
            ${(c.updates || []).map(u => `
              <li class="timeline-item">
                <div class="timeline-dot ${u.status === 'Resolved' ? 'resolved' : u.status === 'Submitted' ? 'submitted' : ''}"></div>
                <div class="timeline-time">${formatDate(u.created_at)} · ${esc(u.updated_by_name)} (${esc(u.updated_by_role)})</div>
                <div class="timeline-title">${statusBadge(u.status)}</div>
                ${u.remark ? `<div class="timeline-remark">${esc(u.remark)}</div>` : ''}
              </li>`).join('')}
          </ul>
        </div>
      </div>

      ${c.feedback ? `
      <div class="card">
        <div class="card-header"><h3>Citizen Feedback</h3></div>
        <div class="card-body">
          <div>${starsDisplay(c.feedback.rating)}</div>
          ${c.feedback.feedback_text ? `<p class="mt-1" style="font-size:.9rem;color:var(--gray-600)">${esc(c.feedback.feedback_text)}</p>` : ''}
          <p class="text-muted mt-1">${formatDate(c.feedback.created_at)}</p>
        </div>
      </div>` : ''}

      ${canFeedback ? `
      <div class="card">
        <div class="card-header"><h3>Rate Resolution</h3></div>
        <div class="card-body">
          <form id="feedback-form">
            <div class="form-group">
              <label>Rating *</label>
              <div class="star-rating" id="star-picker">
                <span class="star" data-val="1">☆</span>
                <span class="star" data-val="2">☆</span>
                <span class="star" data-val="3">☆</span>
                <span class="star" data-val="4">☆</span>
                <span class="star" data-val="5">☆</span>
              </div>
              <input type="hidden" id="feedback-rating" value="0" />
            </div>
            <div class="form-group">
              <label for="feedback-text">Comments <small>(optional)</small></label>
              <textarea id="feedback-text" rows="3" placeholder="How was your experience?"></textarea>
            </div>
            <button type="submit" class="btn btn-primary">Submit Feedback</button>
          </form>
        </div>
      </div>` : ''}
    `);

    // Star picker interaction
    const picker = document.getElementById('star-picker');
    if (picker) {
      picker.addEventListener('mouseover', e => {
        const val = +e.target.dataset.val;
        if (!val) return;
        picker.querySelectorAll('.star').forEach((s, i) => {
          s.textContent = i < val ? '★' : '☆';
          s.classList.toggle('selected', i < val);
        });
      });
      picker.addEventListener('mouseleave', () => {
        const cur = +document.getElementById('feedback-rating').value;
        picker.querySelectorAll('.star').forEach((s, i) => {
          s.textContent = i < cur ? '★' : '☆';
          s.classList.toggle('selected', i < cur);
        });
      });
      picker.addEventListener('click', e => {
        const val = +e.target.dataset.val;
        if (!val) return;
        document.getElementById('feedback-rating').value = val;
        picker.querySelectorAll('.star').forEach((s, i) => {
          s.textContent = i < val ? '★' : '☆';
          s.classList.toggle('filled', i < val);
        });
      });
    }

    const feedbackForm = document.getElementById('feedback-form');
    if (feedbackForm) {
      feedbackForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const rating = +document.getElementById('feedback-rating').value;
        const feedback_text = document.getElementById('feedback-text').value.trim();
        if (!rating) { toast('Please select a star rating', 'error'); return; }
        try {
          setLoading(true);
          await api('POST', `/complaints/${complaintId}/feedback`, { rating, feedback_text });
          toast('Feedback submitted. Thank you!', 'success');
          renderComplaintDetail(complaintId);
        } catch (err) {
          toast(err.message, 'error');
        } finally {
          setLoading(false);
        }
      });
    }
  } catch (err) {
    setContent(`<div class="alert alert-danger">${esc(err.message)}</div>`);
  }
}

// ============================================================
// ────────── OFFICIAL VIEWS ───────────────────────────────────
// ============================================================

async function renderOfficialDashboard() {
  setPageTitle('Dashboard');
  setContent('<div class="loading-placeholder">Loading…</div>');
  try {
    const complaints = await api('GET', '/complaints');
    const total    = complaints.length;
    const pending  = complaints.filter(c => c.status !== 'Resolved').length;
    const resolved = complaints.filter(c => c.status === 'Resolved').length;
    const urgent   = complaints.filter(c => c.status === 'Assigned').length;

    setContent(`
      <div class="page-header">
        <div>
          <h2>Welcome, ${esc(state.user.name)} 👤</h2>
          <p>${esc(state.user.department || 'Department Officer')}</p>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon primary">📋</div>
          <div class="stat-info">
            <span class="stat-value">${total}</span>
            <span class="stat-label">Total Assigned</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon warning">🔔</div>
          <div class="stat-info">
            <span class="stat-value">${urgent}</span>
            <span class="stat-label">Newly Assigned</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon purple">🔧</div>
          <div class="stat-info">
            <span class="stat-value">${pending}</span>
            <span class="stat-label">In Progress</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon success">✅</div>
          <div class="stat-info">
            <span class="stat-value">${resolved}</span>
            <span class="stat-label">Resolved</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3>Recent Complaints</h3>
          <button class="btn btn-ghost btn-sm" data-view="official-complaints">View all →</button>
        </div>
        ${complaints.length === 0
          ? `<div class="empty-state"><div class="empty-icon">🎉</div><h3>No complaints assigned yet</h3></div>`
          : `<div class="table-wrapper">
               <table class="table">
                 <thead><tr><th>ID</th><th>Title</th><th>Category</th><th>Citizen</th><th>Status</th><th>Date</th><th></th></tr></thead>
                 <tbody>${complaints.slice(0, 8).map(officialRow).join('')}</tbody>
               </table>
             </div>`}
      </div>
    `);
  } catch (err) {
    setContent(`<div class="alert alert-danger">${esc(err.message)}</div>`);
  }
}

function officialRow(c) {
  return `
    <tr>
      <td><code>${esc(c.complaint_id)}</code></td>
      <td>${esc(c.title)}</td>
      <td><span class="category-badge">${esc(c.category)}</span></td>
      <td>${esc(c.citizen_name || '—')}</td>
      <td>${statusBadge(c.status)}</td>
      <td>${formatDateShort(c.created_at)}</td>
      <td>
        <button class="btn btn-outline btn-sm" data-view="complaint-detail" data-id="${esc(c.complaint_id)}">View</button>
        ${c.status !== 'Resolved' ? `<button class="btn btn-primary btn-sm" data-action="update-status" data-id="${esc(c.complaint_id)}">Update</button>` : ''}
      </td>
    </tr>`;
}

async function renderOfficialComplaints() {
  setPageTitle('Assigned Complaints');
  setContent('<div class="loading-placeholder">Loading…</div>');
  try {
    const complaints = await api('GET', '/complaints');
    setContent(`
      <div class="page-header"><h2>Assigned Complaints</h2></div>
      <div class="filter-bar">
        <input type="text" id="search-input" placeholder="Search…" />
        <select id="status-filter">
          <option value="">All Statuses</option>
          <option>Under Review</option><option>Assigned</option>
          <option>In Progress</option><option>Resolved</option>
        </select>
      </div>
      <div class="card">
        ${complaints.length === 0
          ? `<div class="empty-state"><div class="empty-icon">✅</div><h3>No complaints assigned</h3></div>`
          : `<div class="table-wrapper">
               <table class="table">
                 <thead><tr><th>ID</th><th>Title</th><th>Category</th><th>Citizen</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
                 <tbody id="off-tbody">${complaints.map(officialRow).join('')}</tbody>
               </table>
             </div>`}
      </div>
    `);
    if (complaints.length > 0) {
      const searchEl = document.getElementById('search-input');
      const statusEl = document.getElementById('status-filter');
      const tbody    = document.getElementById('off-tbody');
      function filter() {
        const q = searchEl.value.toLowerCase();
        const s = statusEl.value;
        const f = complaints.filter(c => (!q || c.title.toLowerCase().includes(q) || c.complaint_id.toLowerCase().includes(q)) && (!s || c.status === s));
        tbody.innerHTML = f.length ? f.map(officialRow).join('') : `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--gray-400)">No matching complaints.</td></tr>`;
      }
      searchEl.addEventListener('input', filter);
      statusEl.addEventListener('change', filter);
    }
  } catch (err) {
    setContent(`<div class="alert alert-danger">${esc(err.message)}</div>`);
  }
}

// ============================================================
// ────────── ADMIN VIEWS ──────────────────────────────────────
// ============================================================

async function renderAdminDashboard() {
  setPageTitle('Admin Dashboard');
  setContent('<div class="loading-placeholder">Loading…</div>');
  try {
    const stats = await api('GET', '/admin/stats');
    const maxCat = stats.categoryStats[0] ? stats.categoryStats[0].count : 1;

    setContent(`
      <div class="page-header">
        <div>
          <h2>System Overview</h2>
          <p>Platform analytics and complaint statistics</p>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon primary">📋</div>
          <div class="stat-info">
            <span class="stat-value">${stats.total}</span>
            <span class="stat-label">Total Complaints</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon indigo">📥</div>
          <div class="stat-info">
            <span class="stat-value">${stats.submitted}</span>
            <span class="stat-label">Submitted</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon warning">🔧</div>
          <div class="stat-info">
            <span class="stat-value">${stats.inProgress}</span>
            <span class="stat-label">In Progress</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon success">✅</div>
          <div class="stat-info">
            <span class="stat-value">${stats.resolved}</span>
            <span class="stat-label">Resolved</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon primary">👤</div>
          <div class="stat-info">
            <span class="stat-value">${stats.citizens}</span>
            <span class="stat-label">Citizens</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon purple">🏢</div>
          <div class="stat-info">
            <span class="stat-value">${stats.officials}</span>
            <span class="stat-label">Officials</span>
          </div>
        </div>
        ${stats.avgRating ? `
        <div class="stat-card">
          <div class="stat-icon warning">⭐</div>
          <div class="stat-info">
            <span class="stat-value">${stats.avgRating}</span>
            <span class="stat-label">Avg. Rating / 5</span>
          </div>
        </div>` : ''}
      </div>

      <div class="card">
        <div class="card-header"><h3>Complaints by Category</h3></div>
        <div class="card-body">
          ${stats.categoryStats.length === 0
            ? `<p class="text-muted">No data yet.</p>`
            : `<div class="category-bars">
                ${stats.categoryStats.map(row => `
                  <div class="cat-bar-row">
                    <div class="cat-bar-label">${esc(row.category)}</div>
                    <div class="cat-bar-track">
                      <div class="cat-bar-fill" style="width:${Math.round((row.count/maxCat)*100)}%"></div>
                    </div>
                    <div class="cat-bar-count">${row.count}</div>
                  </div>`).join('')}
              </div>`}
        </div>
      </div>

      <div class="quick-actions">
        <div class="quick-action-card" data-view="admin-complaints">
          <div class="quick-action-icon">📋</div>
          <div class="quick-action-label">Manage Complaints</div>
        </div>
        <div class="quick-action-card" data-view="admin-users">
          <div class="quick-action-icon">👥</div>
          <div class="quick-action-label">Manage Users</div>
        </div>
        <div class="quick-action-card" data-action="create-official-modal">
          <div class="quick-action-icon">➕</div>
          <div class="quick-action-label">Add Official</div>
        </div>
      </div>
    `);
  } catch (err) {
    setContent(`<div class="alert alert-danger">${esc(err.message)}</div>`);
  }
}

async function renderAdminComplaints() {
  setPageTitle('All Complaints');
  setContent('<div class="loading-placeholder">Loading…</div>');
  try {
    const complaints = await api('GET', '/complaints');
    setContent(`
      <div class="page-header"><h2>All Complaints</h2></div>
      <div class="filter-bar">
        <input type="text" id="search-input" placeholder="Search by title, ID, citizen…" />
        <select id="status-filter">
          <option value="">All Statuses</option>
          <option>Submitted</option><option>Under Review</option>
          <option>Assigned</option><option>In Progress</option><option>Resolved</option>
        </select>
        <select id="cat-filter">
          <option value="">All Categories</option>
          <option>Road & Infrastructure</option><option>Water Supply</option>
          <option>Electricity</option><option>Waste Management</option>
          <option>Public Safety</option><option>Other Civic Issues</option>
        </select>
      </div>
      <div class="card">
        ${complaints.length === 0
          ? `<div class="empty-state"><div class="empty-icon">📭</div><h3>No complaints yet</h3></div>`
          : `<div class="table-wrapper">
               <table class="table">
                 <thead><tr>
                   <th>ID</th><th>Title</th><th>Category</th>
                   <th>Citizen</th><th>Status</th><th>Officer</th><th>Date</th><th>Actions</th>
                 </tr></thead>
                 <tbody id="admin-tbody">${complaints.map(adminComplaintRow).join('')}</tbody>
               </table>
             </div>`}
      </div>
    `);
    if (complaints.length > 0) {
      const searchEl = document.getElementById('search-input');
      const statusEl = document.getElementById('status-filter');
      const catEl    = document.getElementById('cat-filter');
      const tbody    = document.getElementById('admin-tbody');
      function filter() {
        const q = searchEl.value.toLowerCase();
        const s = statusEl.value;
        const cat = catEl.value;
        const f = complaints.filter(c =>
          (!q || c.title.toLowerCase().includes(q) || c.complaint_id.toLowerCase().includes(q) || (c.citizen_name || '').toLowerCase().includes(q)) &&
          (!s || c.status === s) &&
          (!cat || c.category === cat)
        );
        tbody.innerHTML = f.length ? f.map(adminComplaintRow).join('') : `<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--gray-400)">No matching results.</td></tr>`;
      }
      searchEl.addEventListener('input', filter);
      statusEl.addEventListener('change', filter);
      catEl.addEventListener('change', filter);
    }
  } catch (err) {
    setContent(`<div class="alert alert-danger">${esc(err.message)}</div>`);
  }
}

function adminComplaintRow(c) {
  const canAssign = c.status === 'Submitted' || !c.assigned_to;
  return `
    <tr>
      <td><code>${esc(c.complaint_id)}</code></td>
      <td>${esc(c.title)}</td>
      <td><span class="category-badge">${esc(c.category)}</span></td>
      <td>${esc(c.citizen_name || '—')}</td>
      <td>${statusBadge(c.status)}</td>
      <td>${c.assigned_officer ? esc(c.assigned_officer) : '<span class="text-muted">—</span>'}</td>
      <td>${formatDateShort(c.created_at)}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-outline btn-sm" data-view="complaint-detail" data-id="${esc(c.complaint_id)}">View</button>
        ${canAssign ? `<button class="btn btn-success btn-sm" data-action="assign-complaint" data-id="${esc(c.complaint_id)}">Assign</button>` : ''}
        ${c.status !== 'Resolved' ? `<button class="btn btn-primary btn-sm" data-action="update-status" data-id="${esc(c.complaint_id)}">Update</button>` : ''}
      </td>
    </tr>`;
}

async function renderAdminUsers() {
  setPageTitle('Users & Officials');
  setContent('<div class="loading-placeholder">Loading…</div>');
  try {
    const users = await api('GET', '/admin/users');
    const citizens  = users.filter(u => u.role === 'citizen');
    const officials = users.filter(u => u.role === 'official');
    const admins    = users.filter(u => u.role === 'admin');

    setContent(`
      <div class="page-header">
        <h2>Users & Officials</h2>
        <button class="btn btn-primary" data-action="create-official-modal">+ Add Official</button>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon primary">👤</div>
          <div class="stat-info"><span class="stat-value">${citizens.length}</span><span class="stat-label">Citizens</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon success">🏢</div>
          <div class="stat-info"><span class="stat-value">${officials.length}</span><span class="stat-label">Officials</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon danger">🔑</div>
          <div class="stat-info"><span class="stat-value">${admins.length}</span><span class="stat-label">Admins</span></div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>All Registered Users</h3></div>
        <div class="table-wrapper">
          <table class="table">
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Department</th><th>Joined</th></tr></thead>
            <tbody>
              ${users.map(u => `
                <tr>
                  <td>${esc(u.name)}</td>
                  <td>${esc(u.email)}</td>
                  <td>${u.phone ? esc(u.phone) : '<span class="text-muted">—</span>'}</td>
                  <td><span class="role-badge role-${esc(u.role)}">${esc(u.role)}</span></td>
                  <td>${u.department ? esc(u.department) : '<span class="text-muted">—</span>'}</td>
                  <td>${formatDateShort(u.created_at)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `);
  } catch (err) {
    setContent(`<div class="alert alert-danger">${esc(err.message)}</div>`);
  }
}

// ============================================================
// ────────── MODALS ───────────────────────────────────────────
// ============================================================

async function showUpdateStatusModal(complaintId) {
  openModal('Update Complaint Status', `
    <form id="update-status-form">
      <div class="form-group">
        <label for="new-status">New Status *</label>
        <select id="new-status" required>
          <option value="">Select new status…</option>
          <option>Under Review</option>
          <option>In Progress</option>
          <option>Resolved</option>
        </select>
      </div>
      <div class="form-group">
        <label for="update-remark">Remark / Note</label>
        <textarea id="update-remark" rows="3" placeholder="Optional note about the update…"></textarea>
      </div>
      <div class="flex gap-1 mt-2">
        <button type="submit" class="btn btn-primary">Update Status</button>
        <button type="button" class="btn btn-outline" data-action="close-modal">Cancel</button>
      </div>
    </form>
  `);

  document.getElementById('update-status-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = document.getElementById('new-status').value;
    const remark = document.getElementById('update-remark').value.trim();
    if (!status) { toast('Please select a status', 'error'); return; }
    try {
      setLoading(true);
      await api('PUT', `/complaints/${complaintId}/status`, { status, remark });
      toast('Status updated successfully!', 'success');
      closeModal();
      renderComplaintDetail(complaintId);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  });
}

async function showAssignModal(complaintId) {
  try {
    setLoading(true);
    const officials = await api('GET', '/admin/officials');
    setLoading(false);

    if (officials.length === 0) {
      toast('No officials available. Please add officials first.', 'error');
      return;
    }

    openModal('Assign Complaint', `
      <form id="assign-form">
        <p class="text-muted mb-2">Select an official to handle complaint <strong>${esc(complaintId)}</strong>.</p>
        <div class="form-group">
          <label for="official-select">Assign to Officer *</label>
          <select id="official-select" required>
            <option value="">Select officer…</option>
            ${officials.map(o => `
              <option value="${esc(String(o.id))}">${esc(o.name)} — ${esc(o.department)} (${o.active_count} active)</option>
            `).join('')}
          </select>
        </div>
        <div class="flex gap-1 mt-2">
          <button type="submit" class="btn btn-success">Assign</button>
          <button type="button" class="btn btn-outline" data-action="close-modal">Cancel</button>
        </div>
      </form>
    `);

    document.getElementById('assign-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const official_id = +document.getElementById('official-select').value;
      if (!official_id) { toast('Please select an official', 'error'); return; }
      try {
        setLoading(true);
        await api('PUT', `/complaints/${complaintId}/assign`, { official_id });
        toast('Complaint assigned successfully!', 'success');
        closeModal();
        renderComplaintDetail(complaintId);
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        setLoading(false);
      }
    });
  } catch (err) {
    setLoading(false);
    toast(err.message, 'error');
  }
}

function showCreateOfficialModal() {
  const departments = [
    'Road & Infrastructure', 'Water Supply', 'Electricity',
    'Waste Management', 'Public Safety', 'Other'
  ];
  openModal('Add Official Account', `
    <form id="create-official-form">
      <div class="form-group">
        <label for="off-name">Full Name *</label>
        <input type="text" id="off-name" placeholder="Officer name" required />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="off-email">Email *</label>
          <input type="email" id="off-email" placeholder="officer@dept.gov" required />
        </div>
        <div class="form-group">
          <label for="off-phone">Phone</label>
          <input type="tel" id="off-phone" placeholder="+91 …" />
        </div>
      </div>
      <div class="form-group">
        <label for="off-dept">Department *</label>
        <select id="off-dept" required>
          <option value="">Select department…</option>
          ${departments.map(d => `<option>${esc(d)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label for="off-pass">Password * <small>(min 6 chars)</small></label>
        <input type="password" id="off-pass" placeholder="Set a password" required minlength="6" />
      </div>
      <div class="flex gap-1 mt-2">
        <button type="submit" class="btn btn-primary">Create Account</button>
        <button type="button" class="btn btn-outline" data-action="close-modal">Cancel</button>
      </div>
    </form>
  `);

  document.getElementById('create-official-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name       = document.getElementById('off-name').value.trim();
    const email      = document.getElementById('off-email').value.trim();
    const phone      = document.getElementById('off-phone').value.trim();
    const department = document.getElementById('off-dept').value;
    const password   = document.getElementById('off-pass').value;
    try {
      setLoading(true);
      await api('POST', '/admin/officials', { name, email, phone, department, password });
      toast('Official account created successfully!', 'success');
      closeModal();
      renderAdminUsers();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  });
}

// ============================================================
// GLOBAL EVENT DELEGATION
// ============================================================
document.addEventListener('click', (e) => {
  // Sidebar toggle
  const menuBtn = e.target.closest('[data-action="toggle-sidebar"]');
  if (menuBtn) {
    document.getElementById('sidebar').classList.toggle('sidebar-open');
    return;
  }

  // Navigate to view
  const viewTarget = e.target.closest('[data-view]');
  if (viewTarget) {
    const view = viewTarget.dataset.view;
    const id   = viewTarget.dataset.id;
    navigate(view, id);
    // Close sidebar on mobile
    document.getElementById('sidebar').classList.remove('sidebar-open');
    return;
  }

  // Actions
  const actionTarget = e.target.closest('[data-action]');
  if (actionTarget) {
    const action = actionTarget.dataset.action;
    const id     = actionTarget.dataset.id;

    if (action === 'logout')               { handleLogout(); return; }
    if (action === 'close-modal')          { closeModal(); return; }
    if (action === 'toggle-tab')           { toggleAuthTab(actionTarget.dataset.tab); return; }
    if (action === 'update-status')        { showUpdateStatusModal(id); return; }
    if (action === 'assign-complaint')     { showAssignModal(id); return; }
    if (action === 'create-official-modal'){ showCreateOfficialModal(); return; }
  }

  // Close sidebar overlay on mobile
  if (e.target.id === 'sidebar-overlay') {
    document.getElementById('sidebar').classList.remove('sidebar-open');
  }
});

// ============================================================
// FORM SUBMISSIONS (AUTH)
// ============================================================
document.getElementById('login-form').addEventListener('submit', handleLogin);
document.getElementById('register-form').addEventListener('submit', handleRegister);

// Close modal on overlay click
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

// ============================================================
// INIT
// ============================================================
initAuth();
