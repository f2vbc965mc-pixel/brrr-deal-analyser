const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const AUTH_STORAGE_KEY = 'acquiraiq-supabase-session';

function getAuthHeaders(accessToken) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken || SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };
}

function assertConfigured() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase environment variables are missing.');
  }
}

async function requestAuth(path, body, accessToken) {
  assertConfigured();
  const response = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: 'POST',
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error_description || data.msg || data.message || 'Supabase auth request failed.');
  }
  return data;
}

function saveSession(session) {
  if (!session?.access_token) return null;
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  return session;
}

export function getStoredSession() {
  try {
    const session = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY));
    return session?.access_token ? session : null;
  } catch {
    return null;
  }
}

export function getCurrentUserFromSession(session = getStoredSession()) {
  return session?.user || null;
}

export async function signUpWithEmail(email, password) {
  const data = await requestAuth('signup', { email, password });
  if (data.access_token) saveSession(data);
  return data;
}

export async function signInWithEmail(email, password) {
  const data = await requestAuth('token?grant_type=password', { email, password });
  saveSession(data);
  return data;
}

export async function sendPasswordReset(email) {
  return requestAuth('recover', { email });
}

export async function signOutSession() {
  const session = getStoredSession();
  if (session?.access_token && SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      await requestAuth('logout', {}, session.access_token);
    } catch {
      // Local logout should still complete if the remote session has already expired.
    }
  }
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export const supabaseConfig = {
  isConfigured: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),
};
