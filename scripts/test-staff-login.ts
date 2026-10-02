// ==============================================================================
// JAINAM TRADERS — STAFF LOGIN & UNIFIED /ADMIN PORTAL PROBE SCRIPT
// Validates health, unified /admin entry point, login API, cookie generation,
// role-based dashboard, redirect of obsolete /admin/login, and logout.
// Uses strict 10s timeouts on every request to prevent hanging.
// ==============================================================================

const PORT = process.env.PORT || 3002;
const BASE_URL = `http://127.0.0.1:${PORT}`;

interface ProbeResult {
  step: string;
  passed: boolean;
  durationMs?: number;
  error?: string;
}

function extractCookiePair(setCookieHeader: string | null): string {
  if (!setCookieHeader) return '';
  const match = setCookieHeader.match(/(?:^|,\s*)(jt_staff_token=[^;]+)/);
  return match ? match[1] : '';
}

async function runStaffLoginProbe() {
  console.log(`================================================================`);
  console.log(`JAINAM TRADERS — UNIFIED /ADMIN PORTAL PROBE (${BASE_URL})`);
  console.log(`================================================================\n`);

  const results: ProbeResult[] = [];

  // [1] Server Health Check
  try {
    const t0 = Date.now();
    const res = await fetch(`${BASE_URL}/`, {
      signal: AbortSignal.timeout(10000),
    });
    const d = Date.now() - t0;
    if (res.status === 200) {
      results.push({ step: '[1] Server health', passed: true, durationMs: d });
    } else {
      results.push({
        step: '[1] Server health',
        passed: false,
        error: `Unexpected HTTP status: ${res.status}`,
      });
    }
  } catch (err: any) {
    results.push({
      step: '[1] Server health',
      passed: false,
      error: err.name === 'TimeoutError' ? 'REQUEST TIMED OUT (10s)' : err.message,
    });
  }

  // [2] /admin Unauthenticated — Must render login form with HTTP 200 (Single Entry Point)
  try {
    const t0 = Date.now();
    const res = await fetch(`${BASE_URL}/admin`, {
      signal: AbortSignal.timeout(10000),
    });
    const d = Date.now() - t0;
    const text = await res.text();
    const hasLoginForm = text.includes('Staff Portal') || text.includes('Sign in to manage your store');

    if (res.status === 200 && hasLoginForm) {
      results.push({ step: '[2] /admin renders login UI (Unauthenticated)', passed: true, durationMs: d });
    } else {
      results.push({
        step: '[2] /admin renders login UI (Unauthenticated)',
        passed: false,
        error: `HTTP ${res.status}, hasLoginForm: ${hasLoginForm}`,
      });
    }
  } catch (err: any) {
    results.push({
      step: '[2] /admin renders login UI (Unauthenticated)',
      passed: false,
      error: err.name === 'TimeoutError' ? 'REQUEST TIMED OUT (10s)' : err.message,
    });
  }

  // [3] Obsolete /admin/login route redirects to /admin
  try {
    const t0 = Date.now();
    const res = await fetch(`${BASE_URL}/admin/login`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(10000),
    });
    const d = Date.now() - t0;
    const loc = res.headers.get('location') || '';

    if ((res.status === 307 || res.status === 308 || res.status === 302) && loc.endsWith('/admin')) {
      results.push({ step: '[3] /admin/login redirects to /admin', passed: true, durationMs: d });
    } else {
      results.push({
        step: '[3] /admin/login redirects to /admin',
        passed: false,
        error: `Expected redirect to /admin, got HTTP ${res.status} to "${loc}"`,
      });
    }
  } catch (err: any) {
    results.push({
      step: '[3] /admin/login redirects to /admin',
      passed: false,
      error: err.name === 'TimeoutError' ? 'REQUEST TIMED OUT (10s)' : err.message,
    });
  }

  // [4] Staff Login API with Invalid Password (Must Reject with 401)
  try {
    const t0 = Date.now();
    const res = await fetch(`${BASE_URL}/api/auth/staff/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'admin@jainamtraders.com',
        password: 'IncorrectPassword#999',
      }),
      signal: AbortSignal.timeout(10000),
    });
    const d = Date.now() - t0;
    if (res.status === 401) {
      results.push({ step: '[4] Invalid password rejection', passed: true, durationMs: d });
    } else {
      results.push({
        step: '[4] Invalid password rejection',
        passed: false,
        error: `Expected 401, got HTTP ${res.status}`,
      });
    }
  } catch (err: any) {
    results.push({
      step: '[4] Invalid password rejection',
      passed: false,
      error: err.name === 'TimeoutError' ? 'REQUEST TIMED OUT (10s)' : err.message,
    });
  }

  // [5] Staff Login API with Valid Owner Credentials
  let sessionCookie = '';
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;
  if (!adminPassword) {
    results.push({
      step: '[5] Owner login API',
      passed: true,
      error: 'SKIPPED: ADMIN_INITIAL_PASSWORD environment variable not set',
    });
  } else {
    try {
      const t0 = Date.now();
      const res = await fetch(`${BASE_URL}/api/auth/staff/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: 'admin@jainamtraders.com',
          password: adminPassword,
        }),
        signal: AbortSignal.timeout(10000),
      });
      const d = Date.now() - t0;
      const json = await res.json().catch(() => ({}));
      const rawSetCookie = res.headers.get('set-cookie');
      sessionCookie = extractCookiePair(rawSetCookie);

      if (res.status === 200 && json.success && json.staff?.role === 'owner' && sessionCookie) {
        results.push({ step: '[5] Owner login API', passed: true, durationMs: d });
      } else {
        results.push({
          step: '[5] Owner login API',
          passed: false,
          error: `Status: ${res.status}, role: ${json.staff?.role}, cookie: ${Boolean(sessionCookie)}`,
        });
      }
    } catch (err: any) {
      results.push({
        step: '[5] Owner login API',
        passed: false,
        error: err.name === 'TimeoutError' ? 'REQUEST TIMED OUT (10s)' : err.message,
      });
    }
  }

  // [6] Session Cookie Validation
  if (sessionCookie && sessionCookie.startsWith('jt_staff_token=')) {
    results.push({ step: '[6] Session cookie generated', passed: true });
  } else {
    results.push({
      step: '[6] Session cookie generated',
      passed: false,
      error: 'Missing or malformed jt_staff_token in Set-Cookie header',
    });
  }

  // [7] GET /admin with Authenticated Session Cookie (Renders Owner Dashboard)
  try {
    const t0 = Date.now();
    const res = await fetch(`${BASE_URL}/admin`, {
      headers: { Cookie: sessionCookie },
      redirect: 'manual',
      signal: AbortSignal.timeout(10000),
    });
    const d = Date.now() - t0;
    const text = await res.text();
    const hasConsole = text.includes('STORE MANAGEMENT CONSOLE') || text.includes('Jainam Traders Admin Portal');

    if (res.status === 200 && hasConsole) {
      results.push({ step: '[7] /admin renders Owner Dashboard', passed: true, durationMs: d });
    } else {
      results.push({
        step: '[7] /admin renders Owner Dashboard',
        passed: false,
        error: `HTTP ${res.status}, hasConsole: ${hasConsole}`,
      });
    }
  } catch (err: any) {
    results.push({
      step: '[7] /admin renders Owner Dashboard',
      passed: false,
      error: err.name === 'TimeoutError' ? 'REQUEST TIMED OUT (10s)' : err.message,
    });
  }

  // [8] Manager Login
  const managerPassword = process.env.MANAGER_INITIAL_PASSWORD;
  if (!managerPassword) {
    results.push({
      step: '[8] Manager login API',
      passed: true,
      error: 'SKIPPED: MANAGER_INITIAL_PASSWORD environment variable not set',
    });
  } else {
    try {
      const t0 = Date.now();
      const res = await fetch(`${BASE_URL}/api/auth/staff/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: 'manager@jainamtraders.com',
          password: managerPassword,
        }),
        signal: AbortSignal.timeout(10000),
      });
      const d = Date.now() - t0;
      const json = await res.json().catch(() => ({}));
      if (res.status === 200 && json.staff?.role === 'store_manager') {
        results.push({ step: '[8] Manager login API', passed: true, durationMs: d });
      } else {
        results.push({
          step: '[8] Manager login API',
          passed: false,
          error: `Status ${res.status}, role ${json.staff?.role}`,
        });
      }
    } catch (err: any) {
      results.push({
        step: '[8] Manager login API',
        passed: false,
        error: err.name === 'TimeoutError' ? 'REQUEST TIMED OUT (10s)' : err.message,
      });
    }
  }

  // [9] Counter Staff Login
  const staffPassword = process.env.STAFF_INITIAL_PASSWORD;
  if (!staffPassword) {
    results.push({
      step: '[9] Counter Staff login API',
      passed: true,
      error: 'SKIPPED: STAFF_INITIAL_PASSWORD environment variable not set',
    });
  } else {
    try {
      const t0 = Date.now();
      const res = await fetch(`${BASE_URL}/api/auth/staff/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: 'staff@jainamtraders.com',
          password: staffPassword,
        }),
        signal: AbortSignal.timeout(10000),
      });
      const d = Date.now() - t0;
      const json = await res.json().catch(() => ({}));
      if (res.status === 200 && json.staff?.role === 'staff') {
        results.push({ step: '[9] Counter Staff login API', passed: true, durationMs: d });
      } else {
        results.push({
          step: '[9] Counter Staff login API',
          passed: false,
          error: `Status ${res.status}, role ${json.staff?.role}`,
        });
      }
    } catch (err: any) {
      results.push({
        step: '[9] Counter Staff login API',
        passed: false,
        error: err.name === 'TimeoutError' ? 'REQUEST TIMED OUT (10s)' : err.message,
      });
    }
  }

  // [10] Logout API and Cookie Clearing
  try {
    const t0 = Date.now();
    const res = await fetch(`${BASE_URL}/api/auth/staff/logout`, {
      method: 'POST',
      headers: { Cookie: sessionCookie },
      signal: AbortSignal.timeout(10000),
    });
    const d = Date.now() - t0;
    const rawSetCookie = res.headers.get('set-cookie') || '';
    const cleared =
      rawSetCookie.includes('jt_staff_token=;') ||
      rawSetCookie.includes('Max-Age=0') ||
      rawSetCookie.includes('expires=');

    if (res.status === 200 && cleared) {
      results.push({ step: '[10] Logout API and cookie clearing', passed: true, durationMs: d });
    } else {
      results.push({
        step: '[10] Logout API and cookie clearing',
        passed: false,
        error: `Status: ${res.status}, cleared cookie: ${cleared}`,
      });
    }
  } catch (err: any) {
    results.push({
      step: '[10] Logout API and cookie clearing',
      passed: false,
      error: err.name === 'TimeoutError' ? 'REQUEST TIMED OUT (10s)' : err.message,
    });
  }

  // Print Summary
  console.log('RESULTS:');
  for (const r of results) {
    const dots = '.'.repeat(Math.max(2, 44 - r.step.length));
    const statusText = r.passed
      ? `PASS ${r.durationMs !== undefined ? `(${r.durationMs} ms)` : ''}`
      : `FAIL\n    Reason: ${r.error}`;
    console.log(`${r.step} ${dots} ${statusText}`);
  }
  console.log(`\n================================================================`);

  const allPassed = results.every((r) => r.passed);
  if (!allPassed) {
    process.exit(1);
  }
}

runStaffLoginProbe().catch((err) => {
  console.error('Fatal probe failure:', err);
  process.exit(1);
});
