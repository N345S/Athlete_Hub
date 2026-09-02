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
