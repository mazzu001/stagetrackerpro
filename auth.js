// Minimal client-side auth (demo only). Replace with Firebase/Auth0 for production.
const KEY = 'stp_session';

export function getSession() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.email) return null;
    return { email: String(data.email), createdAt: data.createdAt || Date.now() };
  } catch {
    return null;
  }
}

export function signIn(email, password) {
  // Demo validation: non-empty email/password; basic email shape
  const ok = typeof email === 'string' && /.+@.+\..+/.test(email) && typeof password === 'string' && password.length >= 4;
  if (!ok) {
    const err = new Error('Invalid email or password');
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }
  const sess = { email, createdAt: Date.now() };
  localStorage.setItem(KEY, JSON.stringify(sess));
  return sess;
}

export function signOut() {
  localStorage.removeItem(KEY);
}

export function requireAuth(redirectUrl = 'dashboard.html') {
  const s = getSession();
  if (!s) {
    const next = new URLSearchParams({ next: location.pathname.replace(/^\/+/, '') }).toString();
    location.replace(`${redirectUrl}?${next}`);
    return false;
  }
  return true;
}
