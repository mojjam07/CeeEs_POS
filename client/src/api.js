const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, ''); // empty = same domain
const KEY = 'ceees_token';
export const getToken = () => localStorage.getItem(KEY);
export const setToken = t => (t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY));

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + '/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/auth/login') { setToken(null); location.reload(); }
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}
export const money = (n, cur = '₦') => cur + (+n || 0).toLocaleString('en-NG', { maximumFractionDigits: 2 });
