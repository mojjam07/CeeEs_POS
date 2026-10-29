import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';

const TYPES = { retail: ['Retail shop', false, 'Tab'], supermarket: ['Supermarket', false, 'Tab'], restaurant: ['Restaurant / bar', true, 'Table'], pharmacy: ['Pharmacy', false, 'Tab'], salon: ['Salon / services', true, 'Client'], other: ['Other', true, 'Tab'] };

export default function Admin() {
  const { settings, setSettings, user, flash } = useApp();
  const [s, setS] = useState(settings), [users, setUsers] = useState([]), [u, setU] = useState(null);
  const loadU = () => api('/users').then(setUsers).catch(e => flash(e.message));
  useEffect(() => { loadU(); }, []);
  const set = (k, v) => setS(x => ({ ...x, [k]: v }));
  const pickType = t => setS(x => ({ ...x, store_type: t, tabs_on: TYPES[t][1], tab_noun: TYPES[t][2] }));
  const saveS = async e => { e.preventDefault(); try { setSettings({ ...(await api('/settings', { method: 'PUT', body: s })), paystack_ready: settings.paystack_ready }); flash('Settings saved'); } catch (x) { flash(x.message); } };
  const saveU = async e => {
    e.preventDefault();
    try { await api(u.id ? '/users/' + u.id : '/users', { method: u.id ? 'PUT' : 'POST', body: u }); setU(null); loadU(); } catch (x) { flash(x.message); }
  };
  return (
    <div className="cols">
      <form className="card" onSubmit={saveS}>
        <h3>Store settings</h3>
        <label>Store type<select value={s.store_type} onChange={e => pickType(e.target.value)}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select></label>
        <label>Store name<input value={s.store_name} onChange={e => set('store_name', e.target.value)} required /></label>
        <label>Address<input value={s.address} onChange={e => set('address', e.target.value)} /></label>
        <label>Phone<input value={s.phone} onChange={e => set('phone', e.target.value)} /></label>
        <div className="two-col">
          <label>Currency symbol<input value={s.currency} onChange={e => set('currency', e.target.value)} maxLength="4" /></label>
          <label>Time zone<input value={s.timezone} onChange={e => set('timezone', e.target.value)} /></label>
        </div>
        <label className="check"><input type="checkbox" checked={s.tabs_on} onChange={e => set('tabs_on', e.target.checked)} /> Let cashiers hold open orders</label>
        {s.tabs_on && <label>What do you call an open order?<input value={s.tab_noun} onChange={e => set('tab_noun', e.target.value)} placeholder="Table, Tab, Client…" /></label>}
        <label className="check"><input type="checkbox" checked={s.vat_on} onChange={e => set('vat_on', e.target.checked)} /> Add VAT to sales</label>
        {s.vat_on && <label>VAT rate (%)<input type="number" step="0.1" min="0" value={s.vat_rate} onChange={e => set('vat_rate', e.target.value)} /></label>}
        <label>Receipt footer<input value={s.receipt_footer} onChange={e => set('receipt_footer', e.target.value)} /></label>
        <button className="btn">Save settings</button>
        <p className="mut small">Card payments: {settings.paystack_ready ? 'Paystack is connected.' : 'add PAYSTACK_SECRET_KEY and PAYSTACK_PUBLIC_KEY in your Render environment to turn them on.'}</p>
      </form>
      <div className="card wrap">
        <div className="row head"><h3 className="grow">Team</h3><button className="btn sm" onClick={() => setU({ name: '', email: '', password: '', role: 'cashier' })}>Add person</button></div>
        <table><thead><tr><th>Name</th><th>Role</th><th /></tr></thead><tbody>{users.map(x => (
          <tr key={x.id} style={{ opacity: x.active ? 1 : .5 }}><td><b>{x.name}</b><br /><small className="mut">{x.email}</small></td><td>{x.role}{!x.active && <span className="tag">disabled</span>}</td>
            <td className="r"><button className="btn alt sm" onClick={() => setU({ ...x, password: '' })}>Edit</button></td></tr>))}</tbody></table>
      </div>
      {u && <div className="modal" onClick={e => e.target === e.currentTarget && setU(null)}>
        <form className="mbox" onSubmit={saveU}>
          <h3>{u.id ? 'Edit person' : 'Add person'}</h3>
          <label>Name<input value={u.name} onChange={e => setU({ ...u, name: e.target.value })} required autoFocus /></label>
          {!u.id && <label>Email<input type="email" value={u.email} onChange={e => setU({ ...u, email: e.target.value })} required /></label>}
          <label>{u.id ? 'New password (leave empty to keep)' : 'Password (6+ characters)'}<input type="password" value={u.password} onChange={e => setU({ ...u, password: e.target.value })} required={!u.id} minLength={u.id && !u.password ? 0 : 6} autoComplete="new-password" /></label>
          <label>Role<select value={u.role} disabled={u.id === user.id} onChange={e => setU({ ...u, role: e.target.value })}><option value="cashier">Cashier — sells and views own sales</option><option value="admin">Admin — full access</option></select></label>
          {u.id && u.id !== user.id && <label className="check"><input type="checkbox" checked={u.active} onChange={e => setU({ ...u, active: e.target.checked })} /> Account is active</label>}
          <div className="row"><span className="grow" /><button type="button" className="btn alt" onClick={() => setU(null)}>Cancel</button><button className="btn">Save</button></div>
        </form></div>}
    </div>
  );
}
