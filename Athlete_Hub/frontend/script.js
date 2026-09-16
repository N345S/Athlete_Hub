const API_BASE_URL = 'http://localhost:5007';

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const togglePasswordButton = document.querySelector('.toggle-password');

if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value.trim();

    if (!email || !password) {
      loginError.textContent = 'Please enter both email and password.';
      return;
    }

    loginError.textContent = 'Signing in...';

    try {
      const response = await fetch(`${API_BASE_URL}/api/Auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || 'Invalid email or password.');
      }

      const normalizedRole = String(data.role || '').toUpperCase();
      const routeByRole = {
        ATHLETE: 'student-dashboard.html',
        STUDENT: 'student-dashboard.html',
        COACH: 'dashboard.html',
        ADMIN: 'dashboard.html',
        REGISTRAR: 'dashboard.html',
        DIRECTOR: 'dashboard.html'
      };

      const session = {
        email: data.email,
        role: data.role,
        token: data.token,
        userId: data.userId,
        firstName: data.firstName,
        lastName: data.lastName,
        universityId: data.universityId,
        status: 'Active',
        summary: `${data.role} account is authenticated and ready to access the portal.`
      };

      sessionStorage.setItem('athleteHubSession', JSON.stringify(session));
      const targetPage = routeByRole[normalizedRole] || 'student-dashboard.html';
      window.location.href = targetPage;
    } catch (error) {
      loginError.textContent = error.message || 'Unable to sign in. Please try again.';
    }
  });
}

if (togglePasswordButton) {
  togglePasswordButton.addEventListener('click', () => {
    const isHidden = passwordInput.type === 'password';
    passwordInput.type = isHidden ? 'text' : 'password';
    togglePasswordButton.textContent = isHidden ? '◌' : '◉';
    togglePasswordButton.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
  });
}

if (document.body.classList.contains('student-shell')) {
  const session = JSON.parse(sessionStorage.getItem('athleteHubSession') || 'null');

  if (!session || !['ATHLETE', 'STUDENT'].includes(String(session.role || '').toUpperCase())) {
    window.location.href = 'index.html';
  } else {
    const fullName = `${session.firstName || 'Student'} ${session.lastName || 'Athlete'}`.trim();
    document.querySelectorAll('.profile-meta strong').forEach((element) => {
      element.textContent = fullName;
    });
    document.querySelectorAll('.profile-mini strong').forEach((element) => {
      element.textContent = session.firstName || 'Student';
    });
    document.querySelectorAll('.avatar').forEach((element) => {
      element.textContent = `${(session.firstName || 'S').slice(0, 1)}${(session.lastName || 'A').slice(0, 1)}`;
    });
    document.querySelectorAll('.logout-button').forEach((button) => {
      button.addEventListener('click', () => {
        sessionStorage.removeItem('athleteHubSession');
        window.location.href = 'index.html';
      });
    });
  }
}

if (document.body.classList.contains('dashboard-page')) {
  const session = JSON.parse(sessionStorage.getItem('athleteHubSession') || 'null');

  if (!session) {
    window.location.href = 'index.html';
    return;
  }

  const welcomeTitle = document.getElementById('welcomeTitle');
  const userBadge = document.getElementById('userBadge');
  const roleLabel = document.getElementById('roleLabel');
  const roleSummary = document.getElementById('roleSummary');
  const statusValue = document.getElementById('statusValue');
  const statusDescription = document.getElementById('statusDescription');
  const completionValue = document.getElementById('completionValue');
  const completionDescription = document.getElementById('completionDescription');
  const recordsValue = document.getElementById('recordsValue');
  const recordsDescription = document.getElementById('recordsDescription');

  const roleMetrics = {
    ATHLETE: {
      label: 'Student',
      completion: '86%',
      completionText: 'Portfolio is on track',
      records: '12',
      recordsText: 'Latest updates this month',
      statusText: 'Ready for updates'
    },
    COACH: {
      label: 'Coach',
      completion: '92%',
      completionText: 'Athlete goals are progressing',
      records: '18',
      recordsText: 'Sessions reviewed this week',
      statusText: 'Monitoring roster'
    },
    ADMIN: {
      label: 'Admin',
      completion: '95%',
      completionText: 'System oversight is active',
      records: '27',
      recordsText: 'User actions reviewed today',
      statusText: 'System management'
    },
    REGISTRAR: {
      label: 'Registrar',
      completion: '94%',
      completionText: 'Academic records are current',
      records: '31',
      recordsText: 'Enrollment updates processed',
      statusText: 'Records verified'
    }
  };

  const normalizedRole = session.role ? String(session.role).toUpperCase() : 'ATHLETE';
  const metrics = roleMetrics[normalizedRole] || roleMetrics.ATHLETE;
  const displayRole = metrics.label;

  welcomeTitle.textContent = session.firstName ? `Welcome, ${session.firstName}` : `Welcome, ${displayRole}`;
  userBadge.textContent = displayRole;
  roleLabel.textContent = displayRole;
  roleSummary.textContent = session.summary || `${displayRole} account is authenticated and ready to access the portal.`;
  statusValue.textContent = session.status || 'Active';
  statusDescription.textContent = metrics.statusText;
  completionValue.textContent = metrics.completion;
  completionDescription.textContent = metrics.completionText;
  recordsValue.textContent = metrics.records;
  recordsDescription.textContent = metrics.recordsText;

  const logoutBtn = document.getElementById('logoutBtn');
  logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem('athleteHubSession');
    window.location.href = 'index.html';
  });
}

const documentList = document.getElementById('documentList');
const documentDropZone = document.getElementById('documentDropZone');
const documentFileInput = document.getElementById('documentFileInput');
const stagedDocumentList = document.getElementById('stagedDocumentList');
const documentMessage = document.getElementById('documentMessage');
const uploadDocumentsButton = document.getElementById('uploadDocumentsButton');

if (documentList && documentDropZone && documentFileInput) {
  const session = JSON.parse(sessionStorage.getItem('athleteHubSession') || 'null');
  const stagedFiles = [];
  const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx'];
  const maxFileSize = 10 * 1024 * 1024;

  const showDocumentMessage = (message, isError = false) => {
    documentMessage.textContent = message;
    documentMessage.className = `legacy-message${isError ? ' error' : ''}`;
  };

  const renderStagedFiles = () => {
    stagedDocumentList.innerHTML = stagedFiles.length ? stagedFiles.map((item, index) => `<div class="staged-document ${item.error ? 'invalid' : ''}"><span><strong>${item.file.name}</strong><small>${(item.file.size / 1024 / 1024).toFixed(2)} MB${item.error ? ` · ${item.error}` : ''}</small></span><button type="button" data-remove-file="${index}">Remove</button></div>`).join('') : '';
    stagedDocumentList.querySelectorAll('[data-remove-file]').forEach((button) => button.addEventListener('click', () => { stagedFiles.splice(Number(button.dataset.removeFile), 1); renderStagedFiles(); }));
  };

  const addFiles = (files) => {
    Array.from(files).forEach((file) => {
      const extension = `.${file.name.split('.').pop().toLowerCase()}`;
      stagedFiles.push({ file, error: !allowedExtensions.includes(extension) ? 'Unsupported file type' : file.size > maxFileSize ? 'File exceeds 10 MB' : '' });
    });
    renderStagedFiles();
  };

  documentFileInput.addEventListener('change', (event) => addFiles(event.target.files));
  documentDropZone.addEventListener('dragover', (event) => { event.preventDefault(); documentDropZone.classList.add('dragging'); });
  documentDropZone.addEventListener('dragleave', () => documentDropZone.classList.remove('dragging'));
  documentDropZone.addEventListener('drop', (event) => { event.preventDefault(); documentDropZone.classList.remove('dragging'); addFiles(event.dataTransfer.files); });

  const loadDocuments = async () => {
    const response = await fetch(`${API_BASE_URL}/api/Documents/me`, { headers: { Authorization: `Bearer ${session.token}` } });
    const documents = await response.json();
    if (!response.ok) throw new Error(documents?.message || 'Unable to load documents.');
    documentList.innerHTML = documents.length ? documents.map((document) => `<div class="document-row"><div class="doc-info"><div><strong>${document.documentName}</strong><small>${document.documentType} · ${document.status} · ${new Date(document.uploadedAt).toLocaleDateString()}</small></div></div><div class="doc-actions"><a href="${API_BASE_URL}${document.fileUrl}" target="_blank" rel="noreferrer">Open</a><button type="button" data-delete-document="${document.documentId}">Delete</button></div></div>`).join('') : '<p class="empty-copy">No documents uploaded yet.</p>';
    documentList.querySelectorAll('[data-delete-document]').forEach((button) => button.addEventListener('click', async () => { if (!window.confirm('Delete this document?')) return; const result = await fetch(`${API_BASE_URL}/api/Documents/${button.dataset.deleteDocument}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.token}` } }); if (result.ok) loadDocuments(); else showDocumentMessage('Unable to delete this document.', true); }));
  };

  uploadDocumentsButton.addEventListener('click', async () => {
    const validFiles = stagedFiles.filter((item) => !item.error);
    if (!validFiles.length) { showDocumentMessage('Add at least one valid document before uploading.', true); return; }
    uploadDocumentsButton.disabled = true;
    showDocumentMessage('Uploading documents...');
    try {
      for (const item of validFiles) {
        const body = new FormData();
        body.append('documentType', document.getElementById('documentTypeInput').value);
        body.append('file', item.file);
        const response = await fetch(`${API_BASE_URL}/api/Documents`, { method: 'POST', headers: { Authorization: `Bearer ${session.token}` }, body });
        const result = await response.json().catch(() => null);
        if (!response.ok) throw new Error(result?.message || `Unable to upload ${item.file.name}.`);
      }
      stagedFiles.splice(0, stagedFiles.length);
      renderStagedFiles();
      showDocumentMessage('Documents uploaded and awaiting review.');
      loadDocuments();
    } catch (error) { showDocumentMessage(error.message, true); } finally { uploadDocumentsButton.disabled = false; }
  });

  loadDocuments().catch((error) => showDocumentMessage(error.message, true));
}

const scheduleCalendar = document.getElementById('scheduleCalendar');

if (scheduleCalendar) {
  const session = JSON.parse(sessionStorage.getItem('athleteHubSession') || 'null');
  let calendarDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let calendarView = 'calendar';
  let activeTypes = new Set(['TRAINING', 'SPORTS_EVENT', 'COMPETITION']);
  let events = [];

  const displayDate = (value) => new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const displayTime = (value) => { if (!value) return 'Time TBA'; const [hour, minute] = value.split(':'); return new Date(2000, 0, 1, Number(hour), Number(minute)).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); };
  const filteredEvents = () => events.filter((event) => activeTypes.has(event.type)).sort((a, b) => `${a.startDate}${a.startTime || ''}`.localeCompare(`${b.startDate}${b.startTime || ''}`));

  const renderCalendar = () => {
    const monthName = calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const visibleEvents = filteredEvents();
    const filters = ['TRAINING', 'SPORTS_EVENT', 'COMPETITION'].map((type) => `<button class="legacy-filter ${activeTypes.has(type) ? 'active' : ''} type-${type.toLowerCase()}" data-calendar-filter="${type}" type="button">${type.replace('_', ' ')}</button>`).join('');
    const controls = `<div class="legacy-calendar-controls"><div><button type="button" data-calendar-prev>‹</button><strong>${monthName}</strong><button type="button" data-calendar-next>›</button></div><div><button class="${calendarView === 'calendar' ? 'active' : ''}" type="button" data-calendar-view="calendar">Calendar</button><button class="${calendarView === 'list' ? 'active' : ''}" type="button" data-calendar-view="list">List</button></div></div><div class="legacy-calendar-filters">${filters}</div>`;
    if (calendarView === 'list') {
      scheduleCalendar.innerHTML = `${controls}<div class="legacy-event-list">${visibleEvents.length ? visibleEvents.map((event) => `<article class="legacy-event type-${event.type.toLowerCase()}"><strong>${event.title}</strong><span>${event.type} · ${displayDate(event.startDate)} · ${displayTime(event.startTime)}${event.endTime ? `–${displayTime(event.endTime)}` : ''}</span><small>${event.location || 'Location TBA'}${event.teamName ? ` · ${event.teamName}` : ''}</small></article>`).join('') : '<p class="empty-copy">No events match the selected filters.</p>'}</div>`;
    } else {
      const firstDay = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1).getDay();
      const daysInMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0).getDate();
      const cells = Array.from({ length: Math.ceil((firstDay + daysInMonth) / 7) * 7 }, (_, index) => { const day = index - firstDay + 1; if (day < 1 || day > daysInMonth) return '<div class="legacy-calendar-day blank"></div>'; const date = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; const dayEvents = visibleEvents.filter((event) => event.startDate === date); return `<div class="legacy-calendar-day"><strong>${day}</strong>${dayEvents.map((event) => `<div class="legacy-calendar-event type-${event.type.toLowerCase()}" title="${event.title}">${event.title}</div>`).join('')}</div>`; }).join('');
      scheduleCalendar.innerHTML = `${controls}<div class="legacy-weekdays">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => `<strong>${day}</strong>`).join('')}</div><div class="legacy-calendar-days">${cells}</div>`;
    }
    scheduleCalendar.querySelector('[data-calendar-prev]').addEventListener('click', () => { calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1); renderCalendar(); });
    scheduleCalendar.querySelector('[data-calendar-next]').addEventListener('click', () => { calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1); renderCalendar(); });
    scheduleCalendar.querySelectorAll('[data-calendar-view]').forEach((button) => button.addEventListener('click', () => { calendarView = button.dataset.calendarView; renderCalendar(); }));
    scheduleCalendar.querySelectorAll('[data-calendar-filter]').forEach((button) => button.addEventListener('click', () => { const type = button.dataset.calendarFilter; activeTypes.has(type) ? activeTypes.delete(type) : activeTypes.add(type); renderCalendar(); }));
  };

  fetch(`${API_BASE_URL}/api/Schedules/athlete`, { headers: { Authorization: `Bearer ${session.token}` } }).then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result?.message || 'Unable to load schedule.'); events = result.map((event) => ({ ...event, type: String(event.type || 'OTHER').toUpperCase() })); renderCalendar(); }).catch((error) => { scheduleCalendar.innerHTML = `<p class="legacy-message error">${error.message}</p>`; });
}
