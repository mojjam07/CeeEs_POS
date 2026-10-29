import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api.js';
import Login from './pages/Login.jsx';
import Sell from './pages/Sell.jsx';
import Products from './pages/Products.jsx';
import Sales from './pages/Sales.jsx';
import Reports from './pages/Reports.jsx';
import Admin from './pages/Admin.jsx';

const Ctx = createContext();
export const useApp = () => useContext(Ctx);

export default function App() {
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(null);
  const [ready, setReady] = useState(!getToken());
  const [page, setPage] = useState('sell');
  const [toast, setToast] = useState('');

  const boot = async () => {
    try { setUser(await api('/auth/me')); setSettings(await api('/settings')); } catch { setToken(null); }
    setReady(true);
  };
  useEffect(() => { if (getToken()) boot(); }, []);
  const flash = m => { setToast(m); clearTimeout(flash.t); flash.t = setTimeout(() => setToast(''), 2800); };

  if (!ready) return <div className="empty">Loading…</div>;
  if (!user || !settings) return <Login onDone={(t, u) => { setToken(t); setUser(u); api('/settings').then(setSettings); }} />;

  const isAdmin = user.role === 'admin';
  const tabs = [['sell', 'Sell'], ...(isAdmin ? [['products', 'Products']] : []), ['sales', 'Sales'], ...(isAdmin ? [['reports', 'Reports'], ['admin', 'Team & settings']] : [])];
  const Page = { sell: Sell, products: Products, sales: Sales, reports: Reports, admin: Admin }[page] || Sell;

  return (
    <Ctx.Provider value={{ user, settings, setSettings, flash, cur: settings.currency }}>
      <header>
        <h1>{settings.store_name}</h1>
        <nav>{tabs.map(([k, l]) => <button key={k} className={k === page ? 'on' : ''} onClick={() => setPage(k)}>{l}</button>)}</nav>
        <span className="who">{user.name} · {user.role}</span>
        <button className="out" onClick={() => { setToken(null); location.reload(); }}>Sign out</button>
      </header>
      <main><Page /></main>
      {toast && <div id="toast" role="status">{toast}</div>}
    </Ctx.Provider>
  );
}
