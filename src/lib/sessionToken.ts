// Stable per-browser session id used to claim seat locks for guest users.
const KEY = "rl_session_token";

export function getSessionToken(): string {
  try {
    let t = localStorage.getItem(KEY);
    if (!t || t.length < 20) {
      t = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)) + "-" + Date.now();
      localStorage.setItem(KEY, t);
    }
    return t;
  } catch {
    // Fallback if localStorage unavailable
    return "anon-" + Math.random().toString(36).slice(2) + "-" + Date.now();
  }
}
