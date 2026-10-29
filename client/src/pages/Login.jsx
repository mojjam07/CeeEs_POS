import { useState } from 'react';
import { api } from '../api.js';

export default function Login({ onDone }) {
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault(); setBusy(true); setErr('');
    try { const d = await api('/auth/login', { method: 'POST', body: { email, password } }); onDone(d.token, d.user); }
    catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <div className="login">
      <form className="card" onSubmit={submit}>
        <h1>CeeEs</h1>
        <p className="mut">Sign in to start selling.</p>
        <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required autoFocus /></label>
        <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required /></label>
        {err && <p className="err">{err}</p>}
        <button className="btn" disabled={busy} style={{ width: '100%' }}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
